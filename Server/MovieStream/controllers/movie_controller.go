package controllers

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/generative-ai-go/genai"
	"github.com/joho/godotenv"
	"github.com/noketchup21/MovieStream/Server/MovieStream/database"
	model "github.com/noketchup21/MovieStream/Server/MovieStream/models"
	"github.com/noketchup21/MovieStream/Server/MovieStream/utils"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"google.golang.org/api/option"
)

var validate = validator.New()

// GetMovies godoc
// @Summary Get all movies
// @Tags Movies
// @Produce json
// @Param page query int false "Page number (default: 1)"
// @Param limit query int false "Items per page (default: 8)"
// @Success 200 {object} map[string]interface{} "movies, total, page, limit, totalPages"
// @Router /movies [get]
func GetMovies(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c, 100*time.Second)
		defer cancel()

		movieCollection := database.OpenCollection("movies", client)

		// Get page and limit from query parameters
		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "8"))

		// Ensure minimum values
		if page < 1 {
			page = 1
		}
		if limit < 1 {
			limit = 8
		}

		// Calculate skip
		skip := (page - 1) * limit

		// Get total count
		total, err := movieCollection.CountDocuments(ctx, bson.M{})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count movies"})
			return
		}

		// Calculate total pages
		totalPages := int((total + int64(limit) - 1) / int64(limit))

		// Set up find options with pagination
		findOptions := options.Find()
		findOptions.SetSkip(int64(skip))
		findOptions.SetLimit(int64(limit))

		var movies []model.Movie
		cursor, err := movieCollection.Find(ctx, bson.M{}, findOptions)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch movies"})
			return
		}
		defer cursor.Close(ctx)

		if err = cursor.All(ctx, &movies); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode movies"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"movies":     movies,
			"total":      total,
			"page":       page,
			"limit":      limit,
			"totalPages": totalPages,
		})
	}
}

// GetMovie godoc
// @Summary Get movie by IMDb ID
// @Tags Movies
// @Param imdb_id path string true "IMDb ID"
// @Produce json
// @Success 200 {object} model.Movie
// @Failure 404 {object} map[string]string
// @Router /movies/{imdb_id} [get]
func GetMovie(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c, 100*time.Second)
		defer cancel()

		var movieCollection *mongo.Collection = database.OpenCollection("movies", client)

		movieId := c.Param("imdb_id")
		if movieId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Movie ID is required"})
			return
		}

		var movie model.Movie
		err := movieCollection.FindOne(ctx, bson.M{"imdb_id": movieId}).Decode(&movie)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Movie not found (.FindOne)"})
			return
		}

		c.JSON(http.StatusOK, movie)
	}
}

// CreateMovie godoc
// @Summary Create a movie
// @Tags Movies
// @Accept json
// @Produce json
// @Param movie body model.Movie true "Movie"
// @Success 201 {object} map[string]interface{}
// @Router /createmovie [post]
func CreateMovie(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c, 100*time.Second)
		defer cancel()

		var movieCollection *mongo.Collection = database.OpenCollection("movies", client)

		var movie model.Movie
		if err := c.ShouldBindJSON(&movie); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
			return
		}

		if err := validate.Struct(movie); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Validation failed",
				"details": err.Error(),
			})
			return
		}

		result, err := movieCollection.InsertOne(ctx, movie)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create movie"})
			return
		}

		c.JSON(http.StatusCreated, result)
	}
}

// AdminReviewMovie godoc
// @Summary Admin reviews a movie
// @Description Admin submits a review for a movie and updates its ranking based on sentiment analysis
// @Tags Movies
// @Accept json
// @Produce json
// @Param imdb_id path string true "IMDb ID of the movie"
// @Param review body object true "Admin review body" example({"admin_review":"Unexpectedly good with strong performances"})
// @Success 200 {object} map[string]string "Updated review and ranking"
// @Failure 400 {object} map[string]string "Invalid input or Movie ID missing"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 404 {object} map[string]string "Movie not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Router /updatereview/{imdb_id} [patch]
func AdminReviewMovie(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, err := utils.GetRoleFromContext(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Role not found in context"})
			return
		}

		if role != "ADMIN" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: Admins only"})
			return
		}

		movieId := c.Param("imdb_id")
		if movieId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Movie ID is required"})
			return
		}

		var req struct {
			AdminReview string `json:"admin_review"`
		}
		var resp struct {
			RankingName string `json:"ranking_name"`
			AdminReview string `json:"admin_review"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
			return
		}

		sentiment, rankVal, err := GetReviewRanking(req.AdminReview, client, c)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get review ranking"})
			return
		}

		filter := bson.D{{Key: "imdb_id", Value: movieId}}
		update := bson.M{
			"$set": bson.M{
				"admin_review": req.AdminReview,
				"ranking": bson.M{
					"ranking_name":  sentiment,
					"ranking_value": rankVal,
				},
			},
		}

		ctx, cancel := context.WithTimeout(c, 100*time.Second)
		defer cancel()

		var movieCollection *mongo.Collection = database.OpenCollection("movies", client)

		result, err := movieCollection.UpdateOne(ctx, filter, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update movie review"})
			return
		}
		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Movie not found (.UpdateOne)"})
			return
		}

		resp.RankingName = sentiment
		resp.AdminReview = req.AdminReview
		c.JSON(http.StatusOK, resp)
	}
}

func CallGemini(prompt string, c *gin.Context) (string, error) {
	ctx := c.Request.Context()

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", errors.New("GEMINI_API_KEY missing")
	}

	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		return "", err
	}
	defer client.Close()

	model := client.GenerativeModel("gemini-flash-latest")

	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", err
	}

	if len(resp.Candidates) == 0 ||
		len(resp.Candidates[0].Content.Parts) == 0 {
		return "", errors.New("empty Gemini response")
	}

	var result string
	for _, part := range resp.Candidates[0].Content.Parts {
		if text, ok := part.(genai.Text); ok {
			result += string(text)
		}
	}

	if result == "" {
		return "", errors.New("Gemini returned empty text")
	}

	return result, nil
}

func GetReviewRanking(admin_review string, client *mongo.Client, c *gin.Context) (string, int, error) {
	rankings, err := GetRankings(client, c)
	if err != nil {
		return "", 0, err
	}
	sentimentDetail := ""

	for _, ranking := range rankings {
		if ranking.RankingValue != 999 {
			sentimentDetail = sentimentDetail + ranking.RankingName + ","
		}
	}
	sentimentDetail = strings.Trim(sentimentDetail, ",")

	// Load .env file
	err = godotenv.Load(".env")
	if err != nil {
		log.Print("Warning! .env file not found")
	}
	// Get OpenAI API key from environment variables
	GeminiApiKey := os.Getenv("GEMINI_API_KEY")
	if GeminiApiKey == "" {
		return "", 0, errors.New("can't read GEMINI_API_KEY")
	}

	// Prepare prompt
	base_prompt_template := os.Getenv("BASE_PROMPT_TEMPLATE")
	if base_prompt_template == "" {
		return "", 0, errors.New("can't read BASE_PROMPT_TEMPLATE")
	}
	base_prompt := strings.Replace(base_prompt_template, "{rankings}", sentimentDetail, 1)

	// Call Gemini API
	response, err := CallGemini(base_prompt+admin_review, c)
	if err != nil {
		log.Println("[ReviewRanking] Gemini call failed:", err)
		return "", 0, err
	}

	// Find ranking value
	response = strings.TrimSpace(response)

	rankVal := 0
	found := false
	for _, ranking := range rankings {
		if ranking.RankingName == response {
			rankVal = ranking.RankingValue
			found = true
			break
		}
	}
	if !found {
		return "", 0, errors.New("LLM returned unknown ranking: " + response)
	}
	if rankVal == 0 {
		return "", 0, errors.New("ranking value is zero for ranking: " + response)
	}
	return response, rankVal, nil
}

func GetRankings(client *mongo.Client, c *gin.Context) ([]model.Ranking, error) {
	var rankings []model.Ranking

	ctx, cancel := context.WithTimeout(c, 100*time.Second)
	defer cancel()

	var rankingCollection *mongo.Collection = database.OpenCollection("rankings", client)

	// Fetch all rankings
	cursor, err := rankingCollection.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	// Decode all rankings
	if err = cursor.All(ctx, &rankings); err != nil {
		return nil, err
	}
	return rankings, nil
}

// GetRecommendMovies godoc
// @Summary Get recommended movies for the logged-in user
// @Description Returns a list of recommended movies based on the user's favorite genres, sorted by ranking
// @Tags Movies
// @Produce json
// @Success 200 {array} model.Movie
// @Failure 400 {object} map[string]string "User ID not found in context"
// @Failure 500 {object} map[string]string "Internal server error"
// @Security BearerAuth
// @Router /recommendedmovies [get]
func GetRecommendMovies(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId, err := utils.GetUserIdFromContext(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User ID not found in context"})
			return
		}

		favorite_genres, err := GetUserFavoriteGenres(userId, client, c)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user favorite genres"})
			return
		}

		_ = godotenv.Load(".env")

		var recommendedMovieLimitVal int64 = 5
		if v := os.Getenv("RECOMMENDED_MOVIE_LIMIT"); v != "" {
			recommendedMovieLimitVal, _ = strconv.ParseInt(v, 10, 64)
		}

		findOptions := options.Find()
		findOptions.SetSort(bson.D{{Key: "ranking.ranking_value", Value: 1}})
		findOptions.SetLimit(recommendedMovieLimitVal)

		filter := bson.M{"genre.genre_name": bson.M{"$in": favorite_genres}}

		ctx, cancel := context.WithTimeout(c, 100*time.Second)
		defer cancel()

		var movieCollection *mongo.Collection = database.OpenCollection("movies", client)

		cursor, err := movieCollection.Find(ctx, filter, findOptions)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recommended movies"})
			return
		}
		defer cursor.Close(ctx)

		var recommendedMovies []model.Movie
		if err = cursor.All(ctx, &recommendedMovies); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode recommended movies"})
			return
		}

		c.JSON(http.StatusOK, recommendedMovies)
	}
}

func GetUserFavoriteGenres(userId string, client *mongo.Client, c *gin.Context) ([]string, error) {
	ctx, cancel := context.WithTimeout(c, 100*time.Second)
	defer cancel()

	var userCollection *mongo.Collection = database.OpenCollection("users", client)

	filter := bson.M{"user_id": userId}

	projection := bson.M{"favorite_genres": 1, "_id": 0}

	opts := options.FindOne().SetProjection(projection)

	var result bson.M

	err := userCollection.FindOne(ctx, filter, opts).Decode(&result)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			return []string{}, errors.New("user not found")
		}
		return []string{}, err
	}

	favGenresArray, ok := result["favorite_genres"].(bson.A)

	if !ok {
		return []string{}, errors.New("invalid favorite genres format")
	}

	var genereNames []string

	for _, item := range favGenresArray {
		if genreMap, ok := item.(bson.D); ok {
			for _, elem := range genreMap {
				if elem.Key == "genre_name" {
					if name, ok := elem.Value.(string); ok {
						genereNames = append(genereNames, name)
					}
				}
			}
		}
	}

	// Alternative approach using bson.M
	// for _, item := range favGenresArray {
	// 	if m, ok := item.(bson.M); ok {
	// 		if name, ok := m["genre_name"].(string); ok {
	// 			genereNames = append(genereNames, name)
	// 		}
	// 	}
	// }
	return genereNames, nil
}

// GetGenres godoc
// @Summary      Get all genres
// @Description  Retrieve the list of all movie genres
// @Tags         Genres
// @Accept       json
// @Produce      json
// @Success      200  {array}   model.Genre
// @Failure      500  {object}  map[string]string  "Internal server error"
// @Router       /genres [get]
func GetGenres(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var ctx, cancel = context.WithTimeout(c, 100*time.Second)
		defer cancel()

		var genreCollection *mongo.Collection = database.OpenCollection("genres", client)

		var genres []model.Genre

		cursor, err := genreCollection.Find(ctx, bson.M{})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch genres"})
			return
		}
		defer cursor.Close(ctx)

		if err = cursor.All(ctx, &genres); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode genres"})
			return
		}
		c.JSON(http.StatusOK, genres)
	}
}

func BuildMovieEmbedURL(imdb, tmdb, subURL, dsLang string, autoplay bool) (string, error) {
	base := "https://vidsrc.ru/movie"
	params := url.Values{}

	if imdb != "" {
		params.Add("imdb", imdb)
	} else if tmdb != "" {
		params.Add("tmdb", tmdb)
	} else {
		return "", errors.New("imdb or tmdb is required")
	}

	if subURL != "" {
		params.Add("sub_url", subURL)
	}
	if dsLang != "" {
		params.Add("ds_lang", dsLang)
	}
	if autoplay {
		params.Add("autoplay", "1")
	}

	return fmt.Sprintf("%s?%s", base, params.Encode()), nil
}

// GetMovieEmbed godoc
// @Summary      Get movie embed URL
// @Description  Generate a movie embed URL using IMDb or TMDB ID
// @Tags         Movies
// @Accept       json
// @Produce      json
// @Param        imdb      query     string  false  "IMDb ID (e.g. tt5433140)"
// @Param        tmdb      query     string  false  "TMDB ID (e.g. 385687)"
// @Param        sub_url   query     string  false  "Subtitle URL (.srt or .vtt, URL-encoded, CORS enabled)"
// @Param        ds_lang   query     string  false  "Default subtitle language (ISO639 code)"
// @Param        autoplay query     int     false  "Autoplay (1 = enable, 0 = disable)"
// @Success      200 {object} map[string]string "Embed URL generated"
// @Failure      400 {object} map[string]string "Invalid request"
// @Router       /getembedmovie [get]
func GetMovieEmbed(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		imdb := c.Query("imdb")
		tmdb := c.Query("tmdb")
		subURL := c.Query("sub_url")
		dsLang := c.Query("ds_lang")
		autoplay := c.DefaultQuery("autoplay", "0") == "1"

		embedURL, err := BuildMovieEmbedURL(imdb, tmdb, subURL, dsLang, autoplay)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"embed_url": embedURL,
		})
	}
}

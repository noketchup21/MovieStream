package controllers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
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

		searchQuery := strings.TrimSpace(c.Query("search"))
		activeMoviesFilter := bson.M{
			"$or": bson.A{
				bson.M{"is_disabled": bson.M{"$exists": false}},
				bson.M{"is_disabled": false},
			},
		}

		filter := activeMoviesFilter
		if searchQuery != "" {
			escapedSearch := regexp.QuoteMeta(searchQuery)
			searchRegex := bson.M{"$regex": escapedSearch, "$options": "i"}
			searchFilter := bson.M{
				"$or": bson.A{
					bson.M{"title": searchRegex},
					bson.M{"imdb_id": searchRegex},
					bson.M{"description": searchRegex},
				},
			}

			filter = bson.M{
				"$and": bson.A{activeMoviesFilter, searchFilter},
			}
		}

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
		total, err := movieCollection.CountDocuments(ctx, filter)
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
		cursor, err := movieCollection.Find(ctx, filter, findOptions)
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
		filter := bson.M{
			"imdb_id": movieId,
			"$or": bson.A{
				bson.M{"is_disabled": bson.M{"$exists": false}},
				bson.M{"is_disabled": false},
			},
		}

		err := movieCollection.FindOne(ctx, filter).Decode(&movie)
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

// UpdateMovieByAdmin godoc
// @Summary Update movie details (admin only)
// @Description Admin updates movie fields like title, description, poster, trailer and genres
// @Tags Movies
// @Accept json
// @Produce json
// @Param imdb_id path string true "IMDb ID"
// @Param payload body object true "Movie fields to update"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Security BearerAuth
// @Router /updatemovie/{imdb_id} [patch]
func UpdateMovieByAdmin(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, err := utils.GetRoleFromContext(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Role not found in context"})
			return
		}

		if !strings.EqualFold(role, "ADMIN") {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: Admins only"})
			return
		}

		movieId := c.Param("imdb_id")
		if movieId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Movie ID is required"})
			return
		}

		var req struct {
			Title       *string        `json:"title"`
			Description *string        `json:"description"`
			PosterPath  *string        `json:"poster_path"`
			YouTubeID   *string        `json:"youtube_id"`
			Genre       *[]model.Genre `json:"genre"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
			return
		}

		updateFields := bson.M{}

		if req.Title != nil {
			title := strings.TrimSpace(*req.Title)
			if title == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "title cannot be empty"})
				return
			}
			updateFields["title"] = title
		}

		if req.Description != nil {
			updateFields["description"] = strings.TrimSpace(*req.Description)
		}

		if req.PosterPath != nil {
			posterPath := strings.TrimSpace(*req.PosterPath)
			if posterPath == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "poster_path cannot be empty"})
				return
			}

			if _, err := url.ParseRequestURI(posterPath); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "poster_path must be a valid URL"})
				return
			}

			updateFields["poster_path"] = posterPath
		}

		if req.YouTubeID != nil {
			youTubeID := strings.TrimSpace(*req.YouTubeID)
			if youTubeID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "youtube_id cannot be empty"})
				return
			}
			updateFields["youtube_id"] = youTubeID
		}

		if req.Genre != nil {
			if len(*req.Genre) == 0 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "genre must contain at least one item"})
				return
			}
			updateFields["genre"] = *req.Genre
		}

		if len(updateFields) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No fields provided for update"})
			return
		}

		ctx, cancel := context.WithTimeout(c, 100*time.Second)
		defer cancel()

		movieCollection := database.OpenCollection("movies", client)

		filter := bson.M{"imdb_id": movieId}
		update := bson.M{"$set": updateFields}

		result, err := movieCollection.UpdateOne(ctx, filter, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update movie"})
			return
		}

		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Movie not found"})
			return
		}

		var updatedMovie model.Movie
		err = movieCollection.FindOne(ctx, bson.M{"imdb_id": movieId}).Decode(&updatedMovie)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Movie updated but failed to fetch updated data"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Movie updated successfully",
			"movie":   updatedMovie,
		})
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

		if !strings.EqualFold(role, "ADMIN") {
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

// DisableMovieByAdmin godoc
// @Summary Disable movie (admin only)
// @Description Soft-disables a movie so it no longer appears in browse and edit listings
// @Tags Movies
// @Produce json
// @Param imdb_id path string true "IMDb ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Security BearerAuth
// @Router /disablemovie/{imdb_id} [patch]
func DisableMovieByAdmin(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, err := utils.GetRoleFromContext(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Role not found in context"})
			return
		}

		if !strings.EqualFold(role, "ADMIN") {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: Admins only"})
			return
		}

		rawMovieID := c.Param("imdb_id")
		movieId := strings.TrimSpace(rawMovieID)
		if movieId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Movie ID is required"})
			return
		}

		ctx, cancel := context.WithTimeout(c, 100*time.Second)
		defer cancel()

		movieCollection := database.OpenCollection("movies", client)

		lookupFilter := bson.M{"imdb_id": movieId}
		if rawMovieID != movieId {
			lookupFilter = bson.M{
				"$or": bson.A{
					bson.M{"imdb_id": rawMovieID},
					bson.M{"imdb_id": movieId},
				},
			}
		}

		var movie model.Movie
		err = movieCollection.FindOne(ctx, lookupFilter).Decode(&movie)
		if err != nil {
			if errors.Is(err, mongo.ErrNoDocuments) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Movie not found"})
				return
			}

			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch movie"})
			return
		}

		if movie.IsDisabled {
			c.JSON(http.StatusOK, gin.H{"message": "Movie is already disabled"})
			return
		}

		filter := lookupFilter
		update := bson.M{"$set": bson.M{"is_disabled": true}}

		result, err := movieCollection.UpdateOne(ctx, filter, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to disable movie"})
			return
		}

		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Movie not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Movie disabled successfully"})
	}
}

// EnableMovieByAdmin godoc
// @Summary Enable movie (admin only)
// @Description Re-enables a previously disabled movie
// @Tags Movies
// @Produce json
// @Param imdb_id path string true "IMDb ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Security BearerAuth
// @Router /enablemovie/{imdb_id} [patch]
func EnableMovieByAdmin(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, err := utils.GetRoleFromContext(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Role not found in context"})
			return
		}

		if !strings.EqualFold(role, "ADMIN") {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: Admins only"})
			return
		}

		rawMovieID := c.Param("imdb_id")
		movieId := strings.TrimSpace(rawMovieID)
		if movieId == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Movie ID is required"})
			return
		}

		ctx, cancel := context.WithTimeout(c, 100*time.Second)
		defer cancel()

		movieCollection := database.OpenCollection("movies", client)

		lookupFilter := bson.M{"imdb_id": movieId}
		if rawMovieID != movieId {
			lookupFilter = bson.M{
				"$or": bson.A{
					bson.M{"imdb_id": rawMovieID},
					bson.M{"imdb_id": movieId},
				},
			}
		}

		var movie model.Movie
		err = movieCollection.FindOne(ctx, lookupFilter).Decode(&movie)
		if err != nil {
			if errors.Is(err, mongo.ErrNoDocuments) {
				c.JSON(http.StatusNotFound, gin.H{"error": "Movie not found"})
				return
			}

			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch movie"})
			return
		}

		if !movie.IsDisabled {
			c.JSON(http.StatusOK, gin.H{"message": "Movie is already active"})
			return
		}

		result, err := movieCollection.UpdateOne(
			ctx,
			lookupFilter,
			bson.M{"$set": bson.M{"is_disabled": false}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to enable movie"})
			return
		}

		if result.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Movie not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Movie enabled successfully"})
	}
}

// GetDisabledMoviesByAdmin godoc
// @Summary Get disabled movies (admin only)
// @Description Returns paginated disabled movies for admin re-activation
// @Tags Movies
// @Produce json
// @Param page query int false "Page number (default: 1)"
// @Param limit query int false "Items per page (default: 8)"
// @Param search query string false "Search by title, imdb_id, description"
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Security BearerAuth
// @Router /disabledmovies [get]
func GetDisabledMoviesByAdmin(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, err := utils.GetRoleFromContext(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Role not found in context"})
			return
		}

		if !strings.EqualFold(role, "ADMIN") {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: Admins only"})
			return
		}

		ctx, cancel := context.WithTimeout(c, 100*time.Second)
		defer cancel()

		movieCollection := database.OpenCollection("movies", client)

		searchQuery := strings.TrimSpace(c.Query("search"))
		baseFilter := bson.M{"is_disabled": true}
		filter := baseFilter

		if searchQuery != "" {
			escapedSearch := regexp.QuoteMeta(searchQuery)
			searchRegex := bson.M{"$regex": escapedSearch, "$options": "i"}
			searchFilter := bson.M{
				"$or": bson.A{
					bson.M{"title": searchRegex},
					bson.M{"imdb_id": searchRegex},
					bson.M{"description": searchRegex},
				},
			}

			filter = bson.M{
				"$and": bson.A{baseFilter, searchFilter},
			}
		}

		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "8"))

		if page < 1 {
			page = 1
		}
		if limit < 1 {
			limit = 8
		}

		skip := (page - 1) * limit

		total, err := movieCollection.CountDocuments(ctx, filter)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count disabled movies"})
			return
		}

		totalPages := int((total + int64(limit) - 1) / int64(limit))

		findOptions := options.Find()
		findOptions.SetSkip(int64(skip))
		findOptions.SetLimit(int64(limit))

		var movies []model.Movie
		cursor, err := movieCollection.Find(ctx, filter, findOptions)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch disabled movies"})
			return
		}
		defer cursor.Close(ctx)

		if err = cursor.All(ctx, &movies); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode disabled movies"})
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
		filter = bson.M{
			"$and": bson.A{
				filter,
				bson.M{
					"$or": bson.A{
						bson.M{"is_disabled": bson.M{"$exists": false}},
						bson.M{"is_disabled": false},
					},
				},
			},
		}

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

func BuildMovieEmbedURL(imdb, tmdb string) (string, error) {
	base := "https://vidsrc.to/embed/movie/"

	if imdb != "" {
		// validate IMDb format
		if !strings.HasPrefix(imdb, "tt") {
			return "", errors.New("invalid imdb id (must start with 'tt')")
		}
		return base + imdb, nil
	}

	if tmdb != "" {
		// optional: validate tmdb is numeric
		return base + tmdb, nil
	}

	return "", errors.New("imdb or tmdb is required")
}

func GetMovieEmbed(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		imdb := c.Query("imdb")
		tmdb := c.Query("tmdb")

		embedURL, err := BuildMovieEmbedURL(imdb, tmdb)
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

func EditMovie(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {

	}
}

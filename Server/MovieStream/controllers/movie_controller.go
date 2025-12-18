package controllers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/joho/godotenv"
	"github.com/noketchup21/MovieStream/Server/MovieStream/database"
	model "github.com/noketchup21/MovieStream/Server/MovieStream/models"
	"github.com/noketchup21/MovieStream/Server/MovieStream/utils"
	"github.com/tmc/langchaingo/llms/openai"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var movieCollection *mongo.Collection = database.OpenCollection("movies")
var validate = validator.New()
var rankingCollection *mongo.Collection = database.OpenCollection("rankings")

// GetMovies godoc
// @Summary Get all movies
// @Tags Movies
// @Produce json
// @Success 200 {array} model.Movie
// @Router /movies [get]
func GetMovies(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Second)
	defer cancel()

	var movies []model.Movie

	cursor, err := movieCollection.Find(ctx, bson.M{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch movies"})
		return
	}
	defer cursor.Close(ctx)

	if err = cursor.All(ctx, &movies); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode movies"})
		return
	}

	c.JSON(http.StatusOK, movies)
}

// GetMovie godoc
// @Summary Get movie by IMDb ID
// @Tags Movies
// @Param imdb_id path string true "IMDb ID"
// @Produce json
// @Success 200 {object} model.Movie
// @Failure 404 {object} map[string]string
// @Router /movies/{imdb_id} [get]
func GetMovie(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Second)
	defer cancel()

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

// CreateMovie godoc
// @Summary Create a movie
// @Tags Movies
// @Accept json
// @Produce json
// @Param movie body model.Movie true "Movie"
// @Success 201 {object} map[string]interface{}
// @Router /createmovie [post]
func CreateMovie(c *gin.Context) {
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Second)
	defer cancel()

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
// @Router /movies/{imdb_id}/review [put]
func AdminReviewMovie(c *gin.Context) {
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

	sentiment, rankVal, err := GetReviewRanking(req.AdminReview)
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
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Second)
	defer cancel()

	result, err := movieCollection.UpdateOne(ctx, filter, update)
	// log.Println("Updating movie with imdb_id:", movieId)
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

func GetReviewRanking(admin_review string) (string, int, error) {
	rankings, err := GetRankings()
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
	OpenAiApiKey := os.Getenv("OPENAI_API_KEY")
	if OpenAiApiKey == "" {
		return "", 0, errors.New("can't read OPENAI_API_KEY")
	}

	// Initialize OpenAI LLM
	llm, err := openai.New(openai.WithToken(OpenAiApiKey))
	if err != nil {
		return "", 0, err
	}

	// Prepare prompt
	base_prompt_template := os.Getenv("BASE_PROMPT_TEMPLATE")
	if base_prompt_template == "" {
		return "", 0, errors.New("can't read BASE_PROMPT_TEMPLATE")
	}
	base_prompt := strings.Replace(base_prompt_template, "{rankings}", sentimentDetail, 1)

	// Call LLM
	response, err := llm.Call(context.Background(), base_prompt+admin_review)
	if err != nil {
		return "", 0, err
	}

	// Find ranking value
	rankVal := 0
	for _, ranking := range rankings {
		if ranking.RankingName == response {
			rankVal = ranking.RankingValue
			break
		}
	}
	if rankVal == 0 {
		return "", 0, errors.New("LLM returned unknown ranking")
	}
	return response, rankVal, nil
}

func GetRankings() ([]model.Ranking, error) {
	var rankings []model.Ranking

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Second)
	defer cancel()

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
// @Router /movies/recommendations [get]
func GetRecommendMovies(c *gin.Context) {
	userId, err := utils.GetUserIdFromContext(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID not found in context"})
		return
	}
	favorite_genres, err := GetUserFavoriteGenres(userId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user favorite genres"})
		return
	}

	err = godotenv.Load(".env")
	if err != nil {
		log.Print("Warning! .env file not found")
	}

	var recommendedMovieLimitVal int64 = 5
	recommendedMovieLimitValStr := os.Getenv("RECOMMENDED_MOVIE_LIMIT")

	if recommendedMovieLimitValStr != "" {
		recommendedMovieLimitVal, _ = strconv.ParseInt(recommendedMovieLimitValStr, 10, 64)
	}

	// Build filter for favorite genres
	findOptions := options.Find()
	findOptions.SetSort(bson.D{{Key: "ranking.ranking_value", Value: 1}})
	findOptions.SetLimit(recommendedMovieLimitVal)

	filter := bson.M{"genre.genre_name": bson.M{"$in": favorite_genres}}
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Second)
	defer cancel()

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

func GetUserFavoriteGenres(userId string) ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Second)
	defer cancel()

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

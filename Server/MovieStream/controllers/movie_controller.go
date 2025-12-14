package controllers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/noketchup21/MovieStream/Server/MovieStream/database"
	model "github.com/noketchup21/MovieStream/Server/MovieStream/models"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

var movieCollection *mongo.Collection = database.OpenCollection("movies")
var validate = validator.New()

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
		c.JSON(http.StatusNotFound, gin.H{"error": "Movie not found"})
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

	movie.ID = result.InsertedID.(bson.ObjectID)

	c.JSON(http.StatusCreated, result)
}

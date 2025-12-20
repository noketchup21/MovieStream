package routes

import (
	"time"

	"github.com/gin-gonic/gin"
	controller "github.com/noketchup21/MovieStream/Server/MovieStream/controllers"
	"github.com/noketchup21/MovieStream/Server/MovieStream/middleware"
)

func SetupProtectedRoutes(router *gin.Engine) {
	router.Use(middleware.AuthMiddleware())

	router.GET("/recommendedmovies", middleware.RateLimit(25, time.Minute), controller.GetRecommendMovies)
	router.GET("/movies/:imdb_id", middleware.RateLimit(25, time.Minute), controller.GetMovie)
	router.POST("/createmovie", middleware.RateLimit(15, time.Minute), controller.CreateMovie)
	router.PATCH("/updatereview/:imdb_id", middleware.RateLimit(15, time.Minute), controller.AdminReviewMovie)
}

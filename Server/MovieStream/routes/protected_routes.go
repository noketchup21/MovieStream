package routes

import (
	"time"

	"github.com/gin-gonic/gin"
	controller "github.com/noketchup21/MovieStream/Server/MovieStream/controllers"
	"github.com/noketchup21/MovieStream/Server/MovieStream/middleware"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

func SetupProtectedRoutes(router *gin.Engine, client *mongo.Client) {
	router.Use(middleware.AuthMiddleware())

	router.GET("/recommendedmovies", middleware.RateLimit(25, time.Minute), controller.GetRecommendMovies(client))
	router.GET("/movies/:imdb_id", middleware.RateLimit(25, time.Minute), controller.GetMovie(client))
	router.POST("/createmovie", middleware.RateLimit(15, time.Minute), controller.CreateMovie(client))
	router.PATCH("/updatemovie/:imdb_id", middleware.RateLimit(20, time.Minute), controller.UpdateMovieByAdmin(client))
	router.PATCH("/updatereview/:imdb_id", middleware.RateLimit(15, time.Minute), controller.AdminReviewMovie(client))
	router.GET("/disabledmovies", middleware.RateLimit(20, time.Minute), controller.GetDisabledMoviesByAdmin(client))
	router.PATCH("/disablemovie/:imdb_id", middleware.RateLimit(15, time.Minute), controller.DisableMovieByAdmin(client))
	router.PATCH("/enablemovie/:imdb_id", middleware.RateLimit(15, time.Minute), controller.EnableMovieByAdmin(client))
	router.GET("/getembedmovie", middleware.RateLimit(60, time.Minute), controller.GetMovieEmbed(client))
	router.GET("/profile", middleware.RateLimit(30, time.Minute), controller.GetMyProfile(client))
	router.PATCH("/profile", middleware.RateLimit(20, time.Minute), controller.UpdateMyProfile(client))
	router.POST("/profile/2fa/setup", middleware.RateLimit(10, time.Minute), controller.TwoFactorSetupHandler(client))
	router.POST("/profile/2fa/confirm", middleware.RateLimit(10, time.Minute), controller.ConfirmTwoFactorHandler(client))
	router.POST("/profile/2fa/disable", middleware.RateLimit(10, time.Minute), controller.DisableTwoFactorHandler(client))
}

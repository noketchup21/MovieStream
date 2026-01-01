package routes

import (
	"time"

	"github.com/gin-gonic/gin"
	controller "github.com/noketchup21/MovieStream/Server/MovieStream/controllers"
	"github.com/noketchup21/MovieStream/Server/MovieStream/middleware"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

func SetupUnProtectedRoutes(router *gin.Engine, client *mongo.Client) {

	router.GET("/movies", middleware.RateLimit(60, time.Minute), controller.GetMovies(client))
	router.POST("/register", middleware.RateLimit(3, time.Minute), controller.RegisterUser(client))
	router.POST("/login", middleware.RateLimit(6, time.Minute), controller.LoginUser(client))
	router.POST("/verify-email", middleware.RateLimit(10, time.Minute), controller.VerifyEmail(client))
	router.POST("/resend-verification-email", middleware.RateLimit(5, time.Minute), controller.ResendVerificationEmail(client))
	router.POST("/resetpassword-send-code", middleware.RateLimit(5, time.Minute), controller.SendResetPasswordEmail(client))
	router.POST("/resetpassword-verify-code", middleware.RateLimit(5, time.Minute), controller.VerifyResetPasswordCode(client))
	router.POST("/resetpassword", middleware.RateLimit(5, time.Minute), controller.ResetPassword(client))
	router.GET("/genres", middleware.RateLimit(20, time.Minute), controller.GetGenres(client))
}

package routes

import (
	"time"

	"github.com/gin-gonic/gin"
	controller "github.com/noketchup21/MovieStream/Server/MovieStream/controllers"
	"github.com/noketchup21/MovieStream/Server/MovieStream/middleware"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

func SetupUnProtectedRoutes(router *gin.Engine, client *mongo.Client) {

	router.GET("/movies", middleware.RateLimit(45, time.Minute), controller.GetMovies(client))
	router.POST("/register", middleware.RateLimit(3, time.Minute), controller.RegisterUser(client))
	router.POST("/login", middleware.RateLimit(6, time.Minute), controller.LoginUser(client))
	router.POST("/auth/verify-email", middleware.RateLimit(5, time.Minute), controller.VerifyEmail(client))
	router.POST("/auth/resend-verification-email", middleware.RateLimit(5, time.Minute), controller.ResendVerificationEmail(client))
	router.POST("/auth/resetpassword-send-code", middleware.RateLimit(5, time.Minute), controller.SendResetPasswordEmail(client))
	router.POST("/auth/resetpassword-verify-code", middleware.RateLimit(5, time.Minute), controller.VerifyResetPasswordCode(client))
	router.POST("/auth/resetpassword", middleware.RateLimit(5, time.Minute), controller.ResetPassword(client))
}

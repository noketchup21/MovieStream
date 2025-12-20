package routes

import (
	"time"

	"github.com/gin-gonic/gin"
	controller "github.com/noketchup21/MovieStream/Server/MovieStream/controllers"
	"github.com/noketchup21/MovieStream/Server/MovieStream/middleware"
)

func SetupUnProtectedRoutes(router *gin.Engine) {

	router.GET("/movies", middleware.RateLimit(45, time.Minute), controller.GetMovies)
	router.POST("/register", middleware.RateLimit(3, time.Minute), controller.RegisterUser)
	router.POST("/login", middleware.RateLimit(6, time.Minute), controller.LoginUser)
	router.POST("/auth/verify-email", middleware.RateLimit(5, time.Minute), controller.VerifyEmail)
	router.POST("/auth/resend-verification", middleware.RateLimit(5, time.Minute), controller.ResendVerificationEmail)
}

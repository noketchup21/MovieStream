package routes

import (
	"github.com/gin-gonic/gin"
	controller "github.com/noketchup21/MovieStream/Server/MovieStream/controllers"
	"github.com/noketchup21/MovieStream/Server/MovieStream/middleware"
)

func SetupProtectedRoutes(router *gin.Engine) {
	router.Use(middleware.AuthMiddleware())
	router.GET("/movies/:imdb_id", controller.GetMovie)
	router.POST("/createmovie", controller.CreateMovie)
}

package main

import (
	"fmt"

	"github.com/gin-gonic/gin"
	_ "github.com/noketchup21/MovieStream/Server/MovieStream/docs"
	"github.com/noketchup21/MovieStream/Server/MovieStream/routes"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// @title MovieStream API
// @version 1.0
// @description Movie API using Gin
// @host localhost:8080
// @BasePath /
func main() {
	router := gin.Default()
	// Swagger endpoint
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	router.GET("/hello", func(c *gin.Context) {
		c.String(200, "Hello, World!")
	})

	routes.SetupUnProtectedRoutes(router)
	routes.SetupProtectedRoutes(router)

	if err := router.Run(":8080"); err != nil {
		fmt.Println("Failed to start server:", err)
	}
}

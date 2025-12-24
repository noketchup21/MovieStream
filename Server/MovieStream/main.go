package main

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/noketchup21/MovieStream/Server/MovieStream/database"
	_ "github.com/noketchup21/MovieStream/Server/MovieStream/docs"
	"github.com/noketchup21/MovieStream/Server/MovieStream/routes"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"go.mongodb.org/mongo-driver/v2/mongo"
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

	var client *mongo.Client = database.Connect()

	routes.SetupUnProtectedRoutes(router, client)
	routes.SetupProtectedRoutes(router, client)

	if err := router.Run(":8080"); err != nil {
		fmt.Println("Failed to start server:", err)
	}
}

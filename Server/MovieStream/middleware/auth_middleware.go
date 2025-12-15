package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/noketchup21/MovieStream/Server/MovieStream/utils"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := utils.GetAccessToken(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: " + err.Error()})
			c.Abort()
			return
		}
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: No token provided"})
			c.Abort()
			return
		}

		claims, err := utils.ValidateToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: " + err.Error()})
			c.Abort()
			return
		}
		// Set user information in context
		c.Set("email", claims.Email)
		c.Set("userID", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Next()
	}
}

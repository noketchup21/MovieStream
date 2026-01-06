package controllers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/noketchup21/MovieStream/Server/MovieStream/database"
	model "github.com/noketchup21/MovieStream/Server/MovieStream/models"
	"github.com/noketchup21/MovieStream/Server/MovieStream/utils"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
	HashPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(HashPassword), nil
}

// RegisterUser godoc
// @Summary Register a new user
// @Description Create a new user account with email and password
// @Tags Auth
// @Accept json
// @Produce json
// @Param user body model.User true "User registration data"
// @Success 201 {object} map[string]interface{} "User created successfully"
// @Failure 400 {object} map[string]string "Invalid input or validation error"
// @Failure 409 {object} map[string]string "Email already in use"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /register [post]
func RegisterUser(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var user model.User

		if err := c.ShouldBindJSON(&user); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input data" + err.Error()})
			return
		}

		if err := validate.Struct(user); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed: " + err.Error()})
			return
		}

		if len(user.Password) < 5 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Password must be at least 5 characters long"})
			return
		}

		hashedPassword, err := HashPassword(user.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error hashing password"})
			return
		}

		ctx, cancel := context.WithTimeout(c, 10*time.Second)
		defer cancel()

		userCollection := database.OpenCollection("users", client)

		count, err := userCollection.CountDocuments(ctx, bson.M{"email": user.Email})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error checking for existing user"})
			return
		}
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already in use"})
			return
		}

		user.UserID = bson.NewObjectID().Hex()
		user.Password = hashedPassword
		user.CreatedAt = time.Now()
		user.UpdatedAt = time.Now()
		user.IsValidated = false

		plainCode, hashedCode := utils.GenerateVerificationCode()
		user.VerificationCode = hashedCode
		user.VerificationExpiry = utils.SetVerificationExpiry(15)

		result, err := userCollection.InsertOne(ctx, user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating user"})
			return
		}

		if err := utils.SendVerificationEmail(user.Email, user.Username, plainCode); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"result": result})
	}
}

// VerifyEmail godoc
// @Summary Verify user email
// @Description Verify email using the verification code sent to the user's email
// @Tags Auth
// @Accept json
// @Produce json
// @Param data body object{email=string,code=string} true "Email verification payload"
// @Success 200 {object} map[string]string "Email verified successfully"
// @Failure 400 {object} map[string]string "Invalid input or expired code"
// @Failure 401 {object} map[string]string "Invalid verification code"
// @Failure 404 {object} map[string]string "User not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /verify-email [post]
func VerifyEmail(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Email string `json:"email" validate:"required,email"`
			Code  string `json:"code" validate:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
			return
		}

		ctx, cancel := context.WithTimeout(c, 10*time.Second)
		defer cancel()

		userCollection := database.OpenCollection("users", client)

		var user model.User
		if err := userCollection.FindOne(ctx, bson.M{"email": req.Email}).Decode(&user); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		if user.IsValidated {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Email already verified"})
			return
		}

		if user.VerificationExpiry == nil || time.Now().After(*user.VerificationExpiry) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Verification code expired"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(*user.VerificationCode), []byte(req.Code)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid verification code"})
			return
		}

		update := bson.M{
			"$set": bson.M{
				"is_validated": true,
				"updated_at":   time.Now(),
			},
			"$unset": bson.M{
				"verification_code":   "",
				"verification_expiry": "",
			},
		}

		_, err := userCollection.UpdateOne(ctx, bson.M{"email": req.Email}, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify email"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
	}
}

// ResendVerificationEmail godoc
// @Summary Resend verification email
// @Description Generate a new verification code and resend it to the user's email
// @Tags Auth
// @Accept json
// @Produce json
// @Param data body object{email=string} true "Resend verification payload"
// @Success 200 {object} map[string]string "Verification email resent"
// @Failure 400 {object} map[string]string "Invalid input or email already verified"
// @Failure 404 {object} map[string]string "User not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /resend-verification-email [post]
func ResendVerificationEmail(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Email string `json:"email" binding:"required,email"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
			return
		}

		ctx, cancel := context.WithTimeout(c, 10*time.Second)
		defer cancel()

		userCollection := database.OpenCollection("users", client)

		var user model.User
		if err := userCollection.FindOne(ctx, bson.M{"email": req.Email}).Decode(&user); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}

		if user.IsValidated {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Email already verified"})
			return
		}

		plainCode, hashedCode := utils.GenerateVerificationCode()
		expiry := utils.SetVerificationExpiry(15)

		update := bson.M{
			"$set": bson.M{
				"verification_code":   hashedCode,
				"verification_expiry": expiry,
				"updated_at":          time.Now(),
			},
		}

		_, err := userCollection.UpdateOne(ctx, bson.M{"email": req.Email}, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update verification code"})
			return
		}

		if err := utils.SendVerificationEmail(user.Email, user.Username, plainCode); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Verification email resent successfully"})
	}
}

// SendResetPasswordEmail godoc
// @Summary      Send reset password verification code
// @Description  Send a reset password verification code to the user's email
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        request  body      object{email=string}  true  "User email"
// @Success      200  {object}  map[string]string  "Reset password email sent successfully"
// @Failure      400  {object}  map[string]string  "Invalid input or email not verified"
// @Failure      404  {object}  map[string]string  "User not found"
// @Failure      500  {object}  map[string]string  "Internal server error"
// @Router       /resetpassword-send-code [post]
func SendResetPasswordEmail(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Email string `json:"email" binding:"required,email"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
			return
		}

		ctx, cancel := context.WithTimeout(c, 100*time.Second)
		defer cancel()

		var userCollection *mongo.Collection = database.OpenCollection("users", client)

		var user model.User
		err := userCollection.FindOne(ctx, bson.M{"email": req.Email}).Decode(&user)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		if user.IsValidated == false {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Email not verified"})
			return
		}

		plain, hashed := utils.GenerateVerificationCode()

		err = utils.SendVerificationEmail(user.Email, user.Username, plain)
		if err != nil {
			log.Println("Send email error:", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send reset password email"})
			return
		}

		expiry := utils.SetVerificationExpiry(15)
		update := bson.M{
			"$set": bson.M{
				"verification_code":   hashed,
				"verification_expiry": expiry,
				"updated_at":          time.Now(),
			},
		}

		_, err = userCollection.UpdateOne(ctx, bson.M{"email": req.Email}, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set reset password code"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Reset password email sent successfully"})
	}
}

// VerifyResetPasswordCode godoc
// @Summary      Verify reset password code
// @Description  Verify the reset password verification code sent to user's email
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Security 	 none
// @Param        request  body      object{email=string,code=string}  true  "Email and reset password code"
// @Success      200  {object}  map[string]string  "Reset password code verified successfully"
// @Failure      400  {object}  map[string]string  "Invalid input, expired code, or email not verified"
// @Failure      401  {object}  map[string]string  "Invalid reset password code"
// @Failure      404  {object}  map[string]string  "User not found"
// @Failure      500  {object}  map[string]string  "Internal server error"
// @Router       /resetpassword-verify-code [post]
func VerifyResetPasswordCode(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Email string `json:"email" binding:"required,email"`
			Code  string `json:"code" validate:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
			return
		}
		if err := validate.Struct(req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed: " + err.Error()})
			return
		}

		ctx, cancel := context.WithTimeout(c, 10*time.Second)
		defer cancel()

		var userCollection *mongo.Collection = database.OpenCollection("users", client)

		var user model.User
		err := userCollection.FindOne(ctx, bson.M{"email": req.Email}).Decode(&user)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		if user.VerificationExpiry == nil || time.Now().After(*user.VerificationExpiry) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Reset password code expired"})
			return
		}
		if user.IsValidated == false {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Email not verified"})
			return
		}

		if err := bcrypt.CompareHashAndPassword(
			[]byte(*user.VerificationCode),
			[]byte(req.Code),
		); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid reset password code"})
			return
		}

		update := bson.M{
			"$set": bson.M{
				"updated_at": time.Now(),
			},
			"$unset": bson.M{
				"verification_code":   "",
				"verification_expiry": "",
			},
		}

		_, err = userCollection.UpdateOne(ctx, bson.M{"email": req.Email}, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify code with given email"})
			return
		}

		resetToken, resetTokenHash := utils.GenerateResetPasswordToken()
		resetTokenExpiry := utils.SetVerificationExpiry(15)

		update = bson.M{
			"$set": bson.M{
				"updated_at":                  time.Now(),
				"reset_password_token":        resetTokenHash,
				"reset_password_token_expiry": resetTokenExpiry,
			},
		}

		_, err = userCollection.UpdateOne(ctx, bson.M{"email": req.Email}, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set reset password token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":     "Reset password code verified successfully",
			"reset_token": resetToken,
		})
	}
}

func HashResetToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// ResetPassword godoc
// @Summary      Reset user password
// @Description  Reset password using a valid reset password token
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Security     none
// @Param        request  body  model.ResetPasswordRequest  true  "Reset password request body"
// @Success      200  {object}  map[string]string
// @Failure      400  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /resetpassword [post]
func ResetPassword(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req model.ResetPasswordRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
			return
		}

		ctx, cancel := context.WithTimeout(c, 10*time.Second)
		defer cancel()

		var userCollection *mongo.Collection = database.OpenCollection("users", client)

		var user model.User
		tokenHash := HashResetToken(req.ResetToken)
		err := userCollection.FindOne(ctx, bson.M{"reset_password_token": tokenHash}).Decode(&user)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "User with reset token not found"})
			return
		}
		if user.ResetPasswordTokenExpiry == nil || time.Now().After(*user.ResetPasswordTokenExpiry) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Reset password token expired"})
			return
		}
		if user.IsValidated == false {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Email not verified"})
			return
		}
		if req.NewPassword != req.ConfirmPassword {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Passwords do not match"})
			return
		}

		hashedPassword, err := HashPassword(req.NewPassword)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error hashing new password"})
			return
		}

		update := bson.M{
			"$set": bson.M{
				"password":   hashedPassword,
				"updated_at": time.Now(),
			},
			"$unset": bson.M{
				"reset_password_token":        "",
				"reset_password_token_expiry": "",
			},
		}

		_, err = userCollection.UpdateOne(ctx, bson.M{"email": user.Email}, update)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset password"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully"})
	}
}

// LoginUser godoc
// @Summary Login user
// @Description Authenticate user and return access & refresh tokens
// @Tags Auth
// @Accept json
// @Produce json
// @Param login body model.UserLogin true "Login credentials"
// @Success 200 {object} model.UserResponse
// @Failure 400 {object} map[string]string "Invalid input / validation error"
// @Failure 401 {object} map[string]string "Invalid email or password"
// @Failure 500 {object} map[string]string "Server error"
// @Router /login [post]
func LoginUser(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var userLogin model.UserLogin

		if err := c.ShouldBindJSON(&userLogin); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input data" + err.Error()})
			return
		}
		if err := validate.Struct(userLogin); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed: " + err.Error()})
			return
		}

		ctx, cancel := context.WithTimeout(c, 100*time.Second)
		defer cancel()

		var userCollection *mongo.Collection = database.OpenCollection("users", client)

		var foundUser model.User
		err := userCollection.FindOne(ctx, bson.M{"email": userLogin.Email}).Decode(&foundUser)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
			return
		}

		err = bcrypt.CompareHashAndPassword([]byte(foundUser.Password), []byte(userLogin.Password))
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
			return
		}

		if !foundUser.IsValidated {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Email not verified. Please verify your email before logging in."})
			return
		}

		token, refreshToken, err := utils.GenerateAllTokens(
			foundUser.Email,
			foundUser.UserID,
			foundUser.Username,
			foundUser.Role,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error generating tokens"})
			return
		}

		err = utils.UpdateAllTokens(client, foundUser.UserID, token, refreshToken)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating tokens"})
			return
		}

		http.SetCookie(c.Writer, &http.Cookie{
			Name:     "access_token",
			Value:    token,
			Path:     "/",
			MaxAge:   86400,
			Secure:   true,
			HttpOnly: true,
			SameSite: http.SameSiteNoneMode,
		})
		http.SetCookie(c.Writer, &http.Cookie{
			Name:     "refresh_token",
			Value:    token,
			Path:     "/",
			MaxAge:   604800,
			Secure:   true,
			HttpOnly: true,
			SameSite: http.SameSiteNoneMode,
		})

		c.JSON(http.StatusOK, model.UserResponse{
			UserID:         foundUser.UserID,
			Username:       foundUser.Username,
			Email:          foundUser.Email,
			Role:           foundUser.Role,
			IsValidated:    foundUser.IsValidated,
			FavoriteGenres: foundUser.FavoriteGenres,
		})
	}
}

// LogoutHandler godoc
// @Summary      Logout user
// @Description  Logs out a user by clearing access & refresh tokens from cookies and database
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param        request  body  object{user_id=string}  true  "User ID"
// @Success      200  {object}  map[string]string  "Logged out successfully"
// @Failure      400  {object}  map[string]string  "Invalid request payload"
// @Failure      401  {object}  map[string]string  "Unauthorized"
// @Failure      500  {object}  map[string]string  "Error logging out"
// @Security     BearerAuth
func LogoutHandler(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Clear the access_token cookie

		var UserLogout struct {
			UserId string `json:"user_id"`
		}

		err := c.ShouldBindJSON(&UserLogout)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
			return
		}

		fmt.Println("User ID from Logout request:", UserLogout.UserId)

		err = utils.UpdateAllTokens(client, UserLogout.UserId, "", "") // Clear tokens in the database
		// Optionally, you can also remove the user session from the database if needed

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error logging out"})
			return
		}
		// c.SetCookie(
		// 	"access_token",
		// 	"",
		// 	-1, // MaxAge negative → delete immediately
		// 	"/",
		// 	"localhost", // Adjust to your domain
		// 	true,        // Use true in production with HTTPS
		// 	true,        // HttpOnly
		// )
		http.SetCookie(c.Writer, &http.Cookie{
			Name:  "access_token",
			Value: "",
			Path:  "/",
			// Domain:   "localhost",
			MaxAge:   -1,
			Secure:   true,
			HttpOnly: true,
			SameSite: http.SameSiteNoneMode,
		})

		// // Clear the refresh_token cookie
		// c.SetCookie(
		// 	"refresh_token",
		// 	"",
		// 	-1,
		// 	"/",
		// 	"localhost",
		// 	true,
		// 	true,
		// )
		http.SetCookie(c.Writer, &http.Cookie{
			Name:     "refresh_token",
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			Secure:   true,
			HttpOnly: true,
			SameSite: http.SameSiteNoneMode,
		})

		c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
	}
}

// RefreshTokenHandler godoc
// @Summary      Refresh access token
// @Description  Refresh access and refresh tokens using the refresh_token cookie
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Success      200  {object}  map[string]string  "Tokens refreshed successfully"
// @Failure      401  {object}  map[string]string  "Invalid or expired refresh token / User not found"
// @Failure      500  {object}  map[string]string  "Error updating tokens"
// @Router       /refresh [post]
func RefreshTokenHandler(client *mongo.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var ctx, cancel = context.WithTimeout(c, 100*time.Second)
		defer cancel()

		refreshToken, err := c.Cookie("refresh_token")

		if err != nil {
			fmt.Println("error", err.Error())
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unable to retrieve refresh token from cookie"})
			return
		}

		claim, err := utils.ValidateRefreshToken(refreshToken)
		if err != nil || claim == nil {
			fmt.Println("error", err.Error())
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired refresh token"})
			return
		}

		var userCollection *mongo.Collection = database.OpenCollection("users", client)

		var user model.User
		err = userCollection.FindOne(ctx, bson.D{{Key: "user_id", Value: claim.UserID}}).Decode(&user)

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}

		newToken, newRefreshToken, _ := utils.GenerateAllTokens(user.Email, user.UserID, user.Username, user.Role)
		err = utils.UpdateAllTokens(client, user.UserID, newToken, newRefreshToken)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating tokens"})
			return
		}

		c.SetCookie("access_token", newToken, 86400, "/", "localhost", true, true)          // expires in 24 hours
		c.SetCookie("refresh_token", newRefreshToken, 604800, "/", "localhost", true, true) //expires in 1 week

		c.JSON(http.StatusOK, gin.H{"message": "Tokens refreshed"})
	}
}

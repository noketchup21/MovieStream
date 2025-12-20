package controllers

import (
	"context"
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

var userCollection *mongo.Collection = database.OpenCollection("users")

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
func RegisterUser(c *gin.Context) {
	var user model.User

	// Bind JSON input to user model
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

	//Hash password
	hasedPassword, err := HashPassword(user.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error hashing password"})
		return
	}

	// Timeout context
	var ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Check if email already exists
	count, err := userCollection.CountDocuments(ctx, bson.M{"email": user.Email})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error checking for existing user"})
		return
	}
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already in use"})
		return
	}

	// Create user
	user.UserID = bson.NewObjectID().Hex()
	user.Password = hasedPassword
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()
	user.IsValidated = false

	plainCode, hashedCode := utils.GenerateVerificationCode()

	user.VerificationCode = hashedCode
	user.VerificationExpiry = utils.SetVerificationExpiry(15) // 15 minutes expiry

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
// @Router /auth/verify-email [post]
func VerifyEmail(c *gin.Context) {
	var req struct {
		Email string `json:"email" validate:"required,email"`
		Code  string `json:"code" validate:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user model.User
	err := userCollection.FindOne(ctx, bson.M{"email": req.Email}).Decode(&user)
	if err != nil {
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

	//Compare plain input with hashed code
	if err := bcrypt.CompareHashAndPassword(
		[]byte(*user.VerificationCode),
		[]byte(req.Code),
	); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid verification code"})
		return
	}

	// Mark verified
	update := bson.M{
		"$set": bson.M{
			"is_validated":        true,
			"updated_at":          time.Now(),
			"verification_code":   "",
			"verification_expiry": "",
		},
	}

	_, err = userCollection.UpdateOne(ctx, bson.M{"email": req.Email}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully"})
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
// @Router /auth/resend-verification [post]
func ResendVerificationEmail(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user model.User
	err := userCollection.FindOne(ctx, bson.M{"email": req.Email}).Decode(&user)
	if err != nil {
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

	_, err = userCollection.UpdateOne(ctx, bson.M{"email": req.Email}, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update verification code"})
		return
	}

	if err := utils.SendVerificationEmail(user.Email, user.Username, plainCode); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send verification email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Verification email resent successfully",
	})
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
func LoginUser(c *gin.Context) {
	var userLogin model.UserLogin

	// Bind JSON input to user model
	if err := c.ShouldBindJSON(&userLogin); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input data" + err.Error()})
		return
	}
	if err := validate.Struct(userLogin); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed: " + err.Error()})
		return
	}

	var ctx, cancel = context.WithTimeout(context.Background(), 100*time.Second)
	defer cancel()

	// Find user by email
	var foundUser model.User
	err := userCollection.FindOne(ctx, bson.M{"email": userLogin.Email}).Decode(&foundUser)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Compare password
	err = bcrypt.CompareHashAndPassword([]byte(foundUser.Password), []byte(userLogin.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Check if email is verified
	if !foundUser.IsValidated {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email not verified. Please verify your email before logging in."})
		return
	}

	token, refreshToken, err := utils.GenerateAllTokens(foundUser.Email, foundUser.UserID, foundUser.Username, foundUser.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error generating tokens"})
		return
	}
	err = utils.UpdateAllTokens(foundUser.UserID, token, refreshToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating tokens"})
		return
	}
	c.JSON(http.StatusOK, model.UserResponse{
		UserID:         foundUser.UserID,
		Username:       foundUser.Username,
		Email:          foundUser.Email,
		Role:           foundUser.Role,
		Token:          token,
		RefreshToken:   refreshToken,
		FavoriteGenres: foundUser.FavoriteGenres,
	})
}

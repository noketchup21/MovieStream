package model

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type User struct {
	ID                       bson.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	UserID                   string        `bson:"user_id" json:"user_id"`
	Username                 string        `bson:"username" json:"username" validate:"required,min=3,max=50"`
	Email                    string        `bson:"email" json:"email" validate:"required,email"`
	Password                 string        `bson:"password" json:"password" validate:"required,min=5"`
	Role                     string        `bson:"role" json:"role" validate:"required,oneof=ADMIN USER"`
	IsValidated              bool          `bson:"is_validated" json:"is_validated"`
	VerificationCode         *string       `bson:"verification_code" json:"verification_code"`
	VerificationExpiry       *time.Time    `bson:"verification_expiry" json:"verification_expiry"`
	ResetPasswordToken       *string       `bson:"reset_password_token" json:"reset_password_token"`
	ResetPasswordTokenExpiry *time.Time    `bson:"reset_password_token_expiry" json:"reset_password_token_expiry"`
	CreatedAt                time.Time     `bson:"created_at" json:"created_at"`
	UpdatedAt                time.Time     `bson:"updated_at" json:"updated_at"`
	Token                    string        `bson:"token" json:"token"`
	RefreshToken             string        `bson:"refresh_token" json:"refresh_token"`
	FavoriteGenres           []Genre       `bson:"favorite_genres" json:"favorite_genres" validate:"dive,required"`
}

type UserLogin struct {
	Email    string `bson:"email" json:"email" validate:"required,email"`
	Password string `bson:"password" json:"password" validate:"required,min=5"`
}

type UserResponse struct {
	UserID         string  `bson:"user_id" json:"user_id"`
	Username       string  `bson:"username" json:"username"`
	Email          string  `bson:"email" json:"email"`
	Role           string  `bson:"role" json:"role"`
	IsValidated    bool    `bson:"is_validated" json:"is_validated"`
	Token          string  `bson:"token" json:"token"`
	RefreshToken   string  `bson:"refresh_token" json:"refresh_token"`
	FavoriteGenres []Genre `bson:"favorite_genres" json:"favorite_genres"`
}

type ResetPasswordRequest struct {
	ResetToken      string `json:"reset_token" example:"abc123"`
	NewPassword     string `json:"new_password" example:"Password@123"`
	ConfirmPassword string `json:"confirm_password" example:"Password@123"`
}

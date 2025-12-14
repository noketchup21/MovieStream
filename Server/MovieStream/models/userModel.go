package model

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type User struct {
	ID             bson.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	UserID         string        `bson:"user_id" json:"user_id"`
	Username       string        `bson:"username" json:"username" validate:"required,min=3,max=50"`
	Email          string        `bson:"email" json:"email" validate:"required,email"`
	Password       string        `bson:"password" json:"password" validate:"required,min=5"`
	Role           string        `bson:"role" json:"role" validate:"required,oneof=ADMIN USER"`
	CreatedAt      time.Time     `bson:"created_at" json:"created_at"`
	UpdatedAt      time.Time     `bson:"updated_at" json:"updated_at"`
	Token          string        `bson:"token" json:"token"`
	RefreshToken   string        `bson:"refresh_token" json:"refresh_token"`
	FavoriteGenres []Genre       `bson:"favorite_genres" json:"favorite_genres" validate:"dive,required"`
}

package model

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type User struct {
	ID             bson.ObjectID `bson:"_id,omitempty" json:"_id,omitempty"`
	UserID         string        `bson:"user_id" json:"user_id" validate:"required"`
	Username       string        `bson:"username" json:"username" validate:"required,min=3,max=50"`
	Email          string        `bson:"email" json:"email" validate:"required,email"`
	Password       string        `bson:"password" json:"password" validate:"required,min=5"`
	Role           string        `bson:"role" json:"role" validate:"required,oneof=admin user"`
	CreatedAt      time.Time     `bson:"created_at" json:"created_at"`
	UpdatedAt      time.Time     `bson:"updated_at" json:"updated_at"`
	Token          string        `bson:"token,omitempty" json:"token,omitempty"`
	RefreshToken   string        `bson:"refresh_token,omitempty" json:"refresh_token,omitempty"`
	FavoriteGenres []Genre       `bson:"favorite_genres" json:"favorite_genres" validate:"dive,required"`
}

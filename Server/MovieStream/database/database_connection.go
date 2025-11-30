package database

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func Connect() *mongo.Client {
	err := godotenv.Load(".env")

	fmt.Println("MONGODB:", os.Getenv("MONGODB_URI"))

	if err != nil {
		log.Println("Unable to find .env file")
	}

	MongoDb := os.Getenv("MONGODB_URI")

	if MongoDb == "" {
		log.Fatal("MONGODB_URI not found in environment variables")
	}

	fmt.Println("Connecting to MongoDB at", MongoDb)

	clientOptions := options.Client().ApplyURI(MongoDb)

	client, err := mongo.Connect(nil, clientOptions)

	if err != nil {
		return nil
	}
	return client
}

var Client *mongo.Client = Connect()

func OpenCollection(collectionName string) *mongo.Collection {
	err := godotenv.Load(".env")

	if err != nil {
		log.Println("Unable to find .env file")
	}

	databaseName := os.Getenv("DATABASE_NAME")
	if databaseName == "" {
		log.Fatal("DATABASE_NAME not found in environment variables")
	}
	collection := Client.Database(databaseName).Collection(collectionName)
	if collection == nil {
		log.Fatalf("Collection %s not found in database %s", collectionName, databaseName)
	}
	return collection
}

package utils

import (
	"crypto/rand"
	"math/big"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// GenerateRandomString creates a random string of specified length
const charset = "abcdefghijklmnopqrstuvwxyz" +
	"ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
	"0123456789" +
	"!@#$%^&*()-_=+[]{}<>?"

func GenerateRandomString(length int) string {
	result := make([]byte, length)
	for i := range result {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return ""
		}
		result[i] = charset[n.Int64()]
	}
	return string(result)
}

func GenerateVerificationCode() (plain string, hashed *string) {
	plain = GenerateRandomString(10)

	bytes, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return "", nil
	}

	hashedStr := string(bytes)
	hashed = &hashedStr
	return
}

func SetVerificationExpiry(minutes int) *time.Time {
	expiry := time.Now().Add(time.Duration(minutes) * time.Minute)
	return &expiry
}

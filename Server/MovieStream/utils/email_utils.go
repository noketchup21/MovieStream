package utils

import (
	"bytes"
	"html/template"
	"os"

	"github.com/resend/resend-go/v2"
)

func BuildEmailBody(username, code string) (string, error) {
	tpl, err := template.ParseFiles("templates/email_template.html")
	if err != nil {
		return "", err
	}

	var body bytes.Buffer
	err = tpl.Execute(&body, map[string]string{
		"Username":      username,
		"Code":          code,
		"ExpiryMinutes": "15",
	})
	if err != nil {
		return "", err
	}

	return body.String(), nil
}

func SendVerificationEmail(toEmail string, username string, code string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	fromEmail := os.Getenv("RESEND_FROM_EMAIL")

	htmlBody, err := BuildEmailBody(username, code)
	if err != nil {
		return err
	}

	client := resend.NewClient(apiKey)

	params := &resend.SendEmailRequest{
		From:    fromEmail,
		To:      []string{toEmail},
		Subject: "Email Verification Code From MovieStream",
		Html:    htmlBody,
	}

	_, err = client.Emails.Send(params)
	return err
}

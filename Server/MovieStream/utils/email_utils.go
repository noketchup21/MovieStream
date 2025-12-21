package utils

import (
	"bytes"
	"html/template"
	"os"

	"gopkg.in/gomail.v2"
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
	senderMail := os.Getenv("SMTP_EMAIL")
	senderPassword := os.Getenv("SMTP_PASSWORD")
	smtpHost := os.Getenv("SMTP_HOST")

	htmlBody, err := BuildEmailBody(username, code)
	if err != nil {
		return err
	}

	m := gomail.NewMessage()
	m.SetHeader("From", senderMail)
	m.SetHeader("To", toEmail)
	m.SetHeader("Subject", "Email Verification Code From MovieStream")
	m.SetBody("text/html", htmlBody)

	d := gomail.NewDialer(
		smtpHost,
		587,
		senderMail,
		senderPassword,
	)

	return d.DialAndSend(m)
}

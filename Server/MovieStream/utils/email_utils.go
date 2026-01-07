package utils

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"html/template"
	"log"
	"net"
	"net/smtp"
	"os"
	"time"
)

const (
	maxRetries     = 3
	initialBackoff = 2 * time.Second
	smtpTimeout    = 30 * time.Second
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
	smtpHost := os.Getenv("SMTP_HOST")
	smtpPort := os.Getenv("SMTP_PORT")
	smtpUser := os.Getenv("SMTP_USER")
	smtpPass := os.Getenv("SMTP_PASS")
	fromEmail := os.Getenv("SMTP_FROM_EMAIL")
	fromName := os.Getenv("SMTP_FROM_NAME")

	if fromName == "" {
		fromName = "MovieStream"
	}

	htmlBody, err := BuildEmailBody(username, code)
	if err != nil {
		return fmt.Errorf("failed to build email body: %w", err)
	}

	// Build email message with MIME headers for HTML
	message := buildMIMEMessage(fromName, fromEmail, toEmail, "Email Verification Code From MovieStream", htmlBody)

	// Retry logic with exponential backoff
	var lastErr error
	for attempt := 1; attempt <= maxRetries; attempt++ {
		log.Printf("[Email] Attempt %d/%d: Sending email to %s", attempt, maxRetries, toEmail)

		err = sendEmailWithTimeout(smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, toEmail, message)
		if err == nil {
			log.Printf("[Email] Successfully sent email to %s on attempt %d", toEmail, attempt)
			return nil
		}

		lastErr = err
		log.Printf("[Email] Attempt %d failed: %v", attempt, err)

		if attempt < maxRetries {
			backoff := initialBackoff * time.Duration(1<<(attempt-1)) // Exponential backoff: 2s, 4s, 8s
			log.Printf("[Email] Retrying in %v...", backoff)
			time.Sleep(backoff)
		}
	}

	return fmt.Errorf("failed to send email after %d attempts: %w", maxRetries, lastErr)
}

func buildMIMEMessage(fromName, fromEmail, toEmail, subject, htmlBody string) []byte {
	headers := make(map[string]string)
	headers["From"] = fmt.Sprintf("%s <%s>", fromName, fromEmail)
	headers["To"] = toEmail
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=UTF-8"

	var msg bytes.Buffer
	for k, v := range headers {
		msg.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	msg.WriteString("\r\n")
	msg.WriteString(htmlBody)

	return msg.Bytes()
}

func sendEmailWithTimeout(smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, toEmail string, message []byte) error {
	ctx, cancel := context.WithTimeout(context.Background(), smtpTimeout)
	defer cancel()

	errChan := make(chan error, 1)

	go func() {
		errChan <- sendEmailViaSMTP(smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, toEmail, message)
	}()

	select {
	case <-ctx.Done():
		return fmt.Errorf("email sending timed out after %v", smtpTimeout)
	case err := <-errChan:
		return err
	}
}

func sendEmailViaSMTP(smtpHost, smtpPort, smtpUser, smtpPass, fromEmail, toEmail string, message []byte) error {
	addr := fmt.Sprintf("%s:%s", smtpHost, smtpPort)

	// Create a dialer with timeout
	dialer := &net.Dialer{
		Timeout: 10 * time.Second,
	}

	// Connect to SMTP server with TLS
	conn, err := tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{
		ServerName: smtpHost,
	})
	if err != nil {
		return fmt.Errorf("failed to connect to SMTP server: %w", err)
	}
	defer conn.Close()

	// Create SMTP client
	client, err := smtp.NewClient(conn, smtpHost)
	if err != nil {
		return fmt.Errorf("failed to create SMTP client: %w", err)
	}
	defer client.Close()

	// Authenticate
	auth := smtp.PlainAuth("", smtpUser, smtpPass, smtpHost)
	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("SMTP authentication failed: %w", err)
	}

	// Set sender
	if err = client.Mail(fromEmail); err != nil {
		return fmt.Errorf("failed to set sender: %w", err)
	}

	// Set recipient
	if err = client.Rcpt(toEmail); err != nil {
		return fmt.Errorf("failed to set recipient: %w", err)
	}

	// Send email body
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("failed to get data writer: %w", err)
	}

	_, err = w.Write(message)
	if err != nil {
		return fmt.Errorf("failed to write email body: %w", err)
	}

	err = w.Close()
	if err != nil {
		return fmt.Errorf("failed to close data writer: %w", err)
	}

	return client.Quit()
}

package utils

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"net"
	"net/http"
	"net/smtp"
	"os"
	"time"
)

const (
	maxRetries     = 3
	initialBackoff = 2 * time.Second
	smtpTimeout    = 30 * time.Second
	lambdaTimeout  = 30 * time.Second
)

// LambdaEmailRequest represents the request payload for Lambda email sender
type LambdaEmailRequest struct {
	ToEmail  string `json:"to_email"`
	Username string `json:"username"`
	Code     string `json:"code"`
	APIKey   string `json:"api_key"`
}

// LambdaEmailResponse represents the response from Lambda email sender
type LambdaEmailResponse struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	MessageID string `json:"messageId,omitempty"`
	Error     string `json:"error,omitempty"`
	Details   string `json:"details,omitempty"`
}

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

// SendVerificationEmail sends a verification email using either Lambda or direct SMTP
func SendVerificationEmail(toEmail string, username string, code string) error {
	// Check if Lambda email URL is configured
	lambdaURL := os.Getenv("LAMBDA_EMAIL_URL")
	if lambdaURL != "" {
		return sendEmailViaLambda(toEmail, username, code)
	}

	// Fallback to direct SMTP
	return sendEmailViaSMTPDirect(toEmail, username, code)
}

// sendEmailViaLambda sends email through AWS Lambda function
func sendEmailViaLambda(toEmail, username, code string) error {
	lambdaURL := os.Getenv("LAMBDA_EMAIL_URL")
	lambdaAPIKey := os.Getenv("LAMBDA_API_KEY")

	if lambdaURL == "" {
		return fmt.Errorf("LAMBDA_EMAIL_URL is not configured")
	}

	requestBody := LambdaEmailRequest{
		ToEmail:  toEmail,
		Username: username,
		Code:     code,
		APIKey:   lambdaAPIKey,
	}

	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	// Retry logic with exponential backoff
	var lastErr error
	for attempt := 1; attempt <= maxRetries; attempt++ {
		log.Printf("[Lambda Email] Attempt %d/%d: Sending email to %s", attempt, maxRetries, toEmail)

		err = sendLambdaRequest(lambdaURL, jsonBody)
		if err == nil {
			log.Printf("[Lambda Email] Successfully sent email to %s on attempt %d", toEmail, attempt)
			return nil
		}

		lastErr = err
		log.Printf("[Lambda Email] Attempt %d failed: %v", attempt, err)

		if attempt < maxRetries {
			backoff := initialBackoff * time.Duration(1<<(attempt-1))
			log.Printf("[Lambda Email] Retrying in %v...", backoff)
			time.Sleep(backoff)
		}
	}

	return fmt.Errorf("failed to send email via Lambda after %d attempts: %w", maxRetries, lastErr)
}

func sendLambdaRequest(lambdaURL string, jsonBody []byte) error {
	ctx, cancel := context.WithTimeout(context.Background(), lambdaTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", lambdaURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request to Lambda: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var lambdaResp LambdaEmailResponse
		if json.Unmarshal(body, &lambdaResp) == nil && lambdaResp.Error != "" {
			return fmt.Errorf("Lambda error (status %d): %s - %s", resp.StatusCode, lambdaResp.Error, lambdaResp.Details)
		}
		return fmt.Errorf("Lambda returned status %d: %s", resp.StatusCode, string(body))
	}

	var lambdaResp LambdaEmailResponse
	if err := json.Unmarshal(body, &lambdaResp); err != nil {
		return fmt.Errorf("failed to parse Lambda response: %w", err)
	}

	if !lambdaResp.Success {
		return fmt.Errorf("Lambda email failed: %s", lambdaResp.Error)
	}

	log.Printf("[Lambda Email] Email sent successfully, messageId: %s", lambdaResp.MessageID)
	return nil
}

// sendEmailViaSMTPDirect sends email directly via SMTP (fallback for local development)
func sendEmailViaSMTPDirect(toEmail, username, code string) error {
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

# Lambda Email Sender

AWS Lambda function for sending verification emails via Gmail SMTP. This acts as a middleman between your Render-deployed backend and Gmail SMTP.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Deployment Package

```bash
zip -r function.zip index.js node_modules package.json
```

Or on Windows PowerShell:
```powershell
Compress-Archive -Path index.js, node_modules, package.json -DestinationPath function.zip
```

### 3. Create AWS Lambda Function

1. Go to AWS Lambda Console
2. Click "Create function"
3. Choose "Author from scratch"
4. Set:
   - Function name: `moviestream-email-sender`
   - Runtime: `Node.js 20.x`
   - Architecture: `x86_64`
5. Click "Create function"

### 4. Upload Code

1. In the Lambda function page, go to "Code" tab
2. Click "Upload from" → ".zip file"
3. Upload the `function.zip` file

### 5. Configure Environment Variables

In the Lambda console, go to "Configuration" → "Environment variables" and add:

| Key | Value |
|-----|-------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `your_gmail@gmail.com` |
| `SMTP_PASS` | `your_app_password` |
| `SMTP_FROM_EMAIL` | `your_gmail@gmail.com` |
| `SMTP_FROM_NAME` | `MovieStream` |
| `LAMBDA_API_KEY` | `your_secure_random_api_key` |

### 6. Configure Function URL (Recommended) or API Gateway

#### Option A: Function URL (Simpler)
1. Go to "Configuration" → "Function URL"
2. Click "Create function URL"
3. Auth type: `NONE` (we handle auth with API key)
4. Configure CORS if needed
5. Copy the Function URL

#### Option B: API Gateway
1. Create a new REST API in API Gateway
2. Create a POST method
3. Integrate with Lambda function
4. Deploy the API
5. Copy the invoke URL

### 7. Update Your Go Backend

Add to your `.env` file:
```
LAMBDA_EMAIL_URL=https://your-lambda-url.lambda-url.region.on.aws/
LAMBDA_API_KEY=your_secure_random_api_key
```

### 8. Increase Timeout (Optional)

SMTP operations can take time. In "Configuration" → "General configuration":
- Set timeout to 30 seconds

## Gmail App Password

To use Gmail SMTP, you need an App Password:

1. Enable 2-Factor Authentication on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Generate a new app password for "Mail"
4. Use this password as `SMTP_PASS`

## Testing

You can test the Lambda function directly in the console with this test event:

```json
{
  "to_email": "test@example.com",
  "username": "TestUser",
  "code": "123456",
  "api_key": "your_lambda_api_key"
}
```

## Security Notes

- The `LAMBDA_API_KEY` prevents unauthorized access to your email function
- Never expose your API key in client-side code
- Consider adding rate limiting via AWS WAF if using API Gateway

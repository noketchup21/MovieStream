const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 465,
        secure: true, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

// Build HTML email body
const buildEmailBody = (username, code, expiryMinutes) => {
    return `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table width="500" cellpadding="20" cellspacing="0" style="background-color: #ffffff; border-radius: 6px;">
            <tr>
              <td>
                <h2 style="margin-top: 0;">Verification Required</h2>

                <p>Hello <strong>${username}</strong>,</p>

                <p>
                  We received a request that requires verification.  
                  Please use the verification code below to continue:
                </p>

                <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; margin: 20px 0;">
                  ${code}
                </div>

                <p style="color: #555;">
                  This code will expire in <strong>${expiryMinutes} minutes</strong>.
                </p>

                <p style="font-size: 12px; color: #999;">
                  If you did not request this action, please ignore this email.
                </p>

                <p>— MovieStream</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

exports.handler = async (event) => {
    // Parse the incoming request
    let body;
    try {
        body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || event;
    } catch (error) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Invalid JSON payload' }),
        };
    }

    const { to_email, username, code, api_key } = body;

    // Validate API key for security
    if (api_key !== process.env.LAMBDA_API_KEY) {
        return {
            statusCode: 401,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Unauthorized' }),
        };
    }

    // Validate required fields
    if (!to_email || !username || !code) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Missing required fields: to_email, username, code' }),
        };
    }

    const transporter = createTransporter();
    const fromName = process.env.SMTP_FROM_NAME || 'MovieStream';
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

    const mailOptions = {
        from: `${fromName} <${fromEmail}>`,
        to: to_email,
        subject: 'Email Verification Code From MovieStream',
        html: buildEmailBody(username, code, 15),
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: true, 
                message: 'Email sent successfully',
                messageId: info.messageId 
            }),
        };
    } catch (error) {
        console.error('Failed to send email:', error);
        
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                error: 'Failed to send email', 
                details: error.message 
            }),
        };
    }
};

# Email Service Setup Guide

This guide explains how to set up the event-driven order confirmation email system using Google Gmail API.

## Google Gmail API Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API:
   - Go to "APIs & Services" → "Library"
   - Search for "Gmail API"
   - Click "Enable"

### 2. Create Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Fill in service account details:
   - Name: `grailseekers-email-service`
   - Description: `Service account for sending order confirmation emails`
4. Click "Create and Continue"
5. Add roles:
   - `Service Account User`
   - Or create a custom role with Gmail send permissions
6. Click "Continue" then "Done"

### 3. Generate Service Account Key

1. Click on the created service account
2. Go to "Keys" tab
3. Click "Add Key" → "Create New Key"
4. Select "JSON" format
5. Download the JSON file
6. **Keep this file secure - it contains your private key**

### 4. Enable Domain-Wide Delegation (Optional)

If you want to send emails from your custom domain:

1. In the service account settings, check "Enable Google Workspace Domain-wide Delegation"
2. Note the "Client ID"
3. In your Google Workspace Admin Console:
   - Go to Security → API Controls → Domain-wide Delegation
   - Add the Client ID with scope: `https://www.googleapis.com/auth/gmail.send`

## Environment Variables Setup

Add these variables to your `.env` file:

```env
# Google Gmail API Configuration
GOOGLE_PROJECT_ID=your-google-cloud-project-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Content\n-----END PRIVATE KEY-----"

# Email Configuration
EMAIL_FROM_ADDRESS=noreply@grailseekers.com
```

### Getting the Values:

From your downloaded JSON service account key file:

```json
{
  "type": "service_account",
  "project_id": "your-project-id", // → GOOGLE_PROJECT_ID
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n", // → GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  "client_email": "service-account@project.iam.gserviceaccount.com", // → GOOGLE_SERVICE_ACCOUNT_EMAIL
  "client_id": "...",
  "auth_uri": "...",
  "token_uri": "...",
  "auth_provider_x509_cert_url": "...",
  "client_x509_cert_url": "..."
}
```

## Testing the Email Service

### 1. Test API Connection

```bash
curl -X GET http://localhost:3000/api/test-email
```

### 2. Test Gmail API Connection

```bash
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{
    "testType": "connection",
    "email": "your@email.com"
  }'
```

### 3. Send Test Email

```bash
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{
    "testType": "simple",
    "email": "your@email.com"
  }'
```

### 4. Test Order Confirmation Flow

```bash
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{
    "testType": "order-confirmation",
    "email": "your@email.com"
  }'
```

## How It Works

```
Order Created (Payment Intent API)
    ↓
OrderConfirmed Event Emitted
    ↓
Email Service Listens for Event
    ↓
Gmail API Sends Email
    ↓
Customer Receives Order Confirmation
```

### Event Flow:

1. **Order Creation**: When a payment is successful, the `create-payment-intent` API creates an order
2. **Event Emission**: The API emits an `OrderConfirmed` event with all order details
3. **Email Service**: The email service listens for this event and generates an email
4. **Gmail API**: Uses Google's Gmail API to send the email via native fetch
5. **Delivery**: Customer receives a beautifully formatted order confirmation email

### Features:

- ✅ Event-driven architecture
- ✅ Native fetch (no external email libraries)
- ✅ Google Gmail API integration
- ✅ Service fee support in emails
- ✅ Discount code support
- ✅ Responsive HTML email templates
- ✅ Error handling and logging
- ✅ Test endpoints for debugging

## Troubleshooting

### Common Issues:

1. **"Missing Google service account credentials"**
   - Check that all environment variables are set
   - Ensure the private key includes the full `-----BEGIN/END PRIVATE KEY-----` wrapper
   - Make sure there are no extra spaces or newlines

2. **"Failed to get access token"**
   - Verify the service account has Gmail API permissions
   - Check that the Gmail API is enabled in your Google Cloud project
   - Ensure the private key format is correct

3. **"Gmail API error: 403"**
   - The service account might not have permission to send emails
   - If using domain-wide delegation, verify the delegation is set up correctly

4. **"Gmail API error: 400"**
   - Check the email format and content
   - Verify the `from` email address is properly configured

### Debug Logs:

The email service provides detailed console logs:
- `🔄 Emitting ORDER_CONFIRMED event`
- `📧 Processing order confirmation email`
- `✅ Email sent successfully`
- `❌ Failed to send email`

Check your server logs for these indicators to diagnose issues.

## Production Considerations

1. **Rate Limiting**: Gmail API has usage limits - implement exponential backoff for retries
2. **Monitoring**: Set up monitoring for failed email sends
3. **Fallback**: Consider a fallback email service (SendGrid, AWS SES) for high availability
4. **Templates**: You can extend the template system for other email types (shipping, returns, etc.)
5. **Personalization**: Add more dynamic content based on user preferences or order history

## Security Notes

- Keep your service account key secure and never commit it to version control
- Use environment variables for all sensitive configuration
- Regularly rotate your service account keys
- Monitor your Google Cloud logs for unusual activity
- Consider using Google Secret Manager for storing sensitive data in production
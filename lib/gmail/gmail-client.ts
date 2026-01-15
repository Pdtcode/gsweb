import { secretManager } from '../secrets/secret-manager';

interface GmailCredentials {
  client_email: string;
  private_key: string;
  project_id: string;
}

interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
}

interface GmailSendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

class GmailClient {
  private credentials: GmailCredentials | null = null;
  private credentialsPromise: Promise<GmailCredentials> | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    // Credentials will be loaded lazily when needed
  }

  private async loadCredentials(): Promise<GmailCredentials> {
    if (this.credentials) {
      return this.credentials;
    }

    if (this.credentialsPromise) {
      return this.credentialsPromise;
    }

    this.credentialsPromise = (async () => {
      try {
        // Try to get the full service account JSON from Secret Manager
        // This contains client_email, private_key, and project_id
        const serviceAccountJson = await secretManager.getSecret('gmail-service-account');

        console.log('🔍 Gmail service account JSON fetched from Secret Manager');

        // Parse the JSON
        const serviceAccount = JSON.parse(serviceAccountJson);

        this.credentials = {
          client_email: serviceAccount.client_email,
          private_key: serviceAccount.private_key.replace(/\\n/g, '\n'),
          project_id: serviceAccount.project_id,
        };

        console.log('✅ Gmail credentials loaded:', this.credentials.client_email);

        if (!this.credentials.client_email || !this.credentials.private_key) {
          throw new Error('Missing Google service account credentials');
        }

        return this.credentials;
      } catch (error) {
        console.log('⚠️ Failed to get credentials from Secret Manager, falling back to env vars:', error);

        // Fallback to environment variables
        const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const projectId = process.env.GOOGLE_PROJECT_ID;
        const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

        if (!clientEmail || !projectId || !privateKey) {
          throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PROJECT_ID, and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY must be set');
        }

        this.credentials = {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'),
          project_id: projectId,
        };

        this.credentialsPromise = null;
        return this.credentials;
      }
    })();

    return this.credentialsPromise;
  }

  private async getAccessToken(): Promise<string> {
    // Check if current token is still valid (with 5 minute buffer)
    if (this.accessToken && this.tokenExpiry > Date.now() + 300000) {
      return this.accessToken;
    }

    // Ensure credentials are loaded
    const credentials = await this.loadCredentials();

    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hour

    // Create JWT header
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    // Get email from address from env var
    const emailFromAddress = process.env.EMAIL_FROM_ADDRESS || credentials.client_email;

    // Create JWT payload
    const payload = {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/gmail.send',
      aud: 'https://oauth2.googleapis.com/token',
      exp: expiry,
      iat: now,
      // Add subject for domain delegation (if using custom domain)
      sub: emailFromAddress,
    };

    try {
      // Create JWT token
      const jwt = await this.createJWT(header, payload);

      // Exchange JWT for access token
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get access token: ${error}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);

      if (!this.accessToken) {
        throw new Error('Failed to obtain access token from Google');
      }

      return this.accessToken;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  }

  private async createJWT(header: any, payload: any): Promise<string> {
    // Ensure credentials are loaded
    const credentials = await this.loadCredentials();

    // Encode header and payload
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    // Create signature using Web Crypto API (available in Node.js 16+)
    const data = `${encodedHeader}.${encodedPayload}`;

    // Import private key
    const key = await this.importPrivateKey(credentials.private_key);

    // Sign the data
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(data)
    );

    const encodedSignature = Buffer.from(signature).toString('base64url');
    return `${data}.${encodedSignature}`;
  }

  private async importPrivateKey(privateKeyPem?: string): Promise<CryptoKey> {
    // Get credentials if privateKeyPem is not provided
    const credentials = privateKeyPem ? { private_key: privateKeyPem } : await this.loadCredentials();
    const keyToUse = privateKeyPem || credentials.private_key;

    // Remove PEM headers and newlines
    const pemContents = keyToUse
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '');

    // Convert base64 to ArrayBuffer
    const keyData = Buffer.from(pemContents, 'base64');

    // Import the key
    return await crypto.subtle.importKey(
      'pkcs8',
      keyData,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );
  }

  private createRawEmail(message: EmailMessage): string {
    const lines = [
      `To: ${message.to}`,
      `From: ${message.from}`,
      `Subject: ${message.subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      message.html,
    ];

    return lines.join('\r\n');
  }

  async sendEmail(message: EmailMessage): Promise<GmailSendResponse> {
    try {
      const accessToken = await this.getAccessToken();
      const rawEmail = this.createRawEmail(message);
      const encodedEmail = Buffer.from(rawEmail).toString('base64url');

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encodedEmail,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Gmail API error:', error);
        return {
          success: false,
          error: `Gmail API error: ${response.status} ${error}`,
        };
      }

      const result = await response.json();
      console.log('✅ Email sent successfully:', result.id);

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error) {
      console.error('Error sending email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getAccessToken();
      console.log('✅ Gmail API connection successful');
      return true;
    } catch (error) {
      console.error('❌ Gmail API connection failed:', error);
      return false;
    }
  }
}

// Global Gmail client instance
export const gmailClient = new GmailClient();

export type { EmailMessage, GmailSendResponse };
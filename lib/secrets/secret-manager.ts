import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

interface SecretCache {
  [key: string]: {
    value: string;
    timestamp: number;
  };
}

class SecretManager {
  private client: SecretManagerServiceClient | null = null;
  private cache: SecretCache = {};
  private cacheExpiryMs = 5 * 60 * 1000; // 5 minutes
  private projectId: string;
  private isEnabled: boolean;

  constructor() {
    // Check if we're using Secret Manager or falling back to env vars
    // Support both split credentials (recommended) and full JSON (backwards compatible)
    const hasClientEmail = !!process.env.GCP_SERVICE_ACCOUNT_EMAIL;
    const hasPrivateKey = !!process.env.GCP_SERVICE_ACCOUNT_PRIVATE_KEY;
    const hasFullCredentials = !!process.env.NETLIFY_SECRET_READER_CREDENTIALS;

    this.isEnabled = (hasClientEmail && hasPrivateKey) || hasFullCredentials;
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';

    if (this.isEnabled) {
      this.initializeClient();
    } else {
      console.log('⚠️ Secret Manager not configured - using environment variables');
    }
  }

  private initializeClient() {
    try {
      let serviceAccount: any;

      // Option 1: Use split credentials (recommended - smaller size)
      // Only requires email and private key, not the full JSON
      if (process.env.GCP_SERVICE_ACCOUNT_EMAIL && process.env.GCP_SERVICE_ACCOUNT_PRIVATE_KEY) {
        serviceAccount = {
          client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GCP_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
        console.log('✅ Using split service account credentials (recommended)');
      }
      // Option 2: Use full credentials JSON (backwards compatible)
      else if (process.env.NETLIFY_SECRET_READER_CREDENTIALS) {
        serviceAccount = JSON.parse(process.env.NETLIFY_SECRET_READER_CREDENTIALS);
        console.log('✅ Using full service account credentials JSON');
      } else {
        throw new Error('No valid service account credentials found');
      }

      // Initialize the Secret Manager client with the service account
      this.client = new SecretManagerServiceClient({
        credentials: serviceAccount,
        projectId: this.projectId,
      });

      console.log('✅ Secret Manager client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Secret Manager client:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Get a secret from Google Secret Manager or fall back to environment variable
   * @param secretName - The name of the secret in Secret Manager (e.g., 'firebase-admin-private-key')
   * @param envVarName - The fallback environment variable name (e.g., 'FIREBASE_ADMIN_PRIVATE_KEY')
   * @param version - The version of the secret (defaults to 'latest')
   */
  async getSecret(secretName: string, envVarName?: string, version: string = 'latest'): Promise<string> {
    // If Secret Manager is not enabled, fall back to environment variable
    if (!this.isEnabled || !this.client) {
      if (envVarName && process.env[envVarName]) {
        return process.env[envVarName];
      }
      throw new Error(`Secret Manager not available and environment variable ${envVarName} not set`);
    }

    // Check cache first
    const cacheKey = `${secretName}:${version}`;
    const cached = this.cache[cacheKey];
    if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
      return cached.value;
    }

    try {
      // Construct the secret path
      const secretPath = `projects/${this.projectId}/secrets/${secretName}/versions/${version}`;
      console.log(`🔍 Fetching secret from: ${secretPath}`);

      // Access the secret
      const [accessResponse] = await this.client.accessSecretVersion({
        name: secretPath,
      });

      const secretValue = accessResponse.payload?.data?.toString() || '';

      if (!secretValue) {
        throw new Error(`Secret ${secretName} is empty`);
      }

      console.log(`✅ Secret ${secretName} fetched, length: ${secretValue.length}`);

      // Cache the secret
      this.cache[cacheKey] = {
        value: secretValue,
        timestamp: Date.now(),
      };

      return secretValue;
    } catch (error) {
      console.error(`❌ Failed to access secret ${secretName}:`, error);

      // Fall back to environment variable if available
      if (envVarName && process.env[envVarName]) {
        console.log(`⚠️ Falling back to environment variable ${envVarName}`);
        return process.env[envVarName];
      }

      throw error;
    }
  }

  /**
   * Clear the secret cache
   */
  clearCache() {
    this.cache = {};
  }

  /**
   * Check if Secret Manager is enabled
   */
  isSecretManagerEnabled(): boolean {
    return this.isEnabled;
  }
}

// Export a singleton instance
export const secretManager = new SecretManager();

// Export the class for testing
export { SecretManager };

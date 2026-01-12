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
    this.isEnabled = !!process.env.NETLIFY_SECRET_READER_CREDENTIALS;
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';

    if (this.isEnabled) {
      this.initializeClient();
    } else {
      console.log('⚠️ Secret Manager not configured - using environment variables');
    }
  }

  private initializeClient() {
    try {
      const credentials = process.env.NETLIFY_SECRET_READER_CREDENTIALS;

      if (!credentials) {
        throw new Error('NETLIFY_SECRET_READER_CREDENTIALS not found');
      }

      // Parse the service account JSON
      const serviceAccount = JSON.parse(credentials);

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

      // Access the secret
      const [accessResponse] = await this.client.accessSecretVersion({
        name: secretPath,
      });

      const secretValue = accessResponse.payload?.data?.toString() || '';

      if (!secretValue) {
        throw new Error(`Secret ${secretName} is empty`);
      }

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

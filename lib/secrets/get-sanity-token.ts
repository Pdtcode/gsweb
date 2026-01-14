import { secretManager } from './secret-manager';

let cachedToken: string | null = null;

/**
 * Get Sanity API token from Secret Manager or environment variable
 * Caches the result to avoid repeated Secret Manager calls
 */
export async function getSanityApiToken(): Promise<string> {
  if (cachedToken) {
    return cachedToken;
  }

  try {
    // Try to get from Secret Manager with fallback to env var
    cachedToken = await secretManager.getSecret('sanity-api-token', 'SANITY_API_TOKEN');
    return cachedToken;
  } catch (error) {
    console.error('Failed to get Sanity API token:', error);
    throw new Error('SANITY_API_TOKEN not available from Secret Manager or environment variables');
  }
}

/**
 * Get Sanity API token synchronously from environment variable only
 * Use this for non-async contexts or when Secret Manager is not needed
 */
export function getSanityApiTokenSync(): string {
  const token = process.env.SANITY_API_TOKEN;
  if (!token) {
    throw new Error('SANITY_API_TOKEN environment variable is not set');
  }
  return token;
}

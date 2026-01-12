/**
 * Environment Variable Loader
 *
 * Decodes a base64-encoded JSON blob containing environment variables
 * This allows us to bypass AWS Lambda's 4KB environment variable limit
 */

let envLoaded = false;
let decodedEnv: Record<string, string> = {};

export function loadEncodedEnv() {
  // Only load once
  if (envLoaded) {
    return decodedEnv;
  }

  const encodedEnv = process.env.ENCODED_ENV;

  if (encodedEnv) {
    try {
      // Decode base64 to JSON string
      const jsonString = Buffer.from(encodedEnv, 'base64').toString('utf8');
      // Parse JSON
      decodedEnv = JSON.parse(jsonString);

      // Merge decoded env vars into process.env
      Object.entries(decodedEnv).forEach(([key, value]) => {
        if (!process.env[key]) {
          process.env[key] = value;
        }
      });

      console.log('✅ Loaded encoded environment variables');
    } catch (error) {
      console.error('❌ Failed to decode ENCODED_ENV:', error);
    }
  }

  envLoaded = true;
  return decodedEnv;
}

// Auto-load on import (for server-side code)
if (typeof window === 'undefined') {
  loadEncodedEnv();
}

import {
  getApps,
  initializeApp,
  cert,
  App,
  ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/**
 * Decode Firebase private key from base64 or use directly
 * This allows us to store the key as base64 in Netlify to reduce env var size
 */
function getFirebasePrivateKey(): string {
  const key = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!key) {
    throw new Error('FIREBASE_ADMIN_PRIVATE_KEY environment variable is not set');
  }

  // If the key is base64 encoded (shorter for env vars), decode it
  if (!key.includes('BEGIN PRIVATE KEY')) {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf8');
      // After decoding, also replace literal \n with actual newlines
      return decoded.replace(/\\n/g, "\n");
    } catch (error) {
      console.error('Failed to decode base64 private key:', error);
      throw error;
    }
  }

  // Otherwise, it's already in the correct format, just replace literal \n with newlines
  return key.replace(/\\n/g, "\n");
}

// Initialize Firebase Admin SDK
export function initFirebaseAdmin(): App {
  const apps = getApps();

  if (apps.length > 0) {
    return apps[0];
  }

  const serviceAccount: ServiceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
    privateKey: getFirebasePrivateKey(),
  };

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

// Helper function to get the Auth instance
export function getAdminAuth() {
  return getAuth(initFirebaseAdmin());
}

// Export the initialized app
export const app = initFirebaseAdmin();

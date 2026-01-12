import {
  getApps,
  initializeApp,
  cert,
  App,
  ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { secretManager } from "./secrets/secret-manager";

/**
 * Decode Firebase private key from base64 or use directly
 * This allows us to store the key as base64 in Netlify to reduce env var size
 */
function decodePrivateKey(key: string): string {
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

/**
 * Get Firebase credentials from Secret Manager (for private key) and environment variables
 */
async function getFirebaseCredentials(): Promise<ServiceAccount> {
  try {
    // Get project ID and client email from environment variables (small values)
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

    if (!projectId || !clientEmail) {
      throw new Error('FIREBASE_ADMIN_PROJECT_ID and FIREBASE_ADMIN_CLIENT_EMAIL must be set in environment variables');
    }

    // Get private key from Secret Manager (large value) with fallback to env var
    const privateKey = await secretManager.getSecret('firebase-admin-private-key', 'FIREBASE_ADMIN_PRIVATE_KEY');

    return {
      projectId,
      clientEmail,
      privateKey: decodePrivateKey(privateKey),
    };
  } catch (error) {
    console.error('Error loading Firebase credentials:', error);
    throw new Error('Failed to load Firebase Admin credentials from Secret Manager or environment variables');
  }
}

// Initialize Firebase Admin SDK
export async function initFirebaseAdmin(): Promise<App> {
  const apps = getApps();

  if (apps.length > 0) {
    return apps[0];
  }

  const serviceAccount = await getFirebaseCredentials();

  return initializeApp({
    credential: cert(serviceAccount),
  });
}

// Helper function to get the Auth instance
export async function getAdminAuth() {
  const app = await initFirebaseAdmin();
  return getAuth(app);
}

// Lazy-initialized app promise
let appPromise: Promise<App> | null = null;

// Export a function to get the initialized app
export function getFirebaseAdminApp(): Promise<App> {
  if (!appPromise) {
    appPromise = initFirebaseAdmin();
  }
  return appPromise;
}

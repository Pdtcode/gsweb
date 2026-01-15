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
 * Get Firebase credentials from Secret Manager or environment variables
 */
async function getFirebaseCredentials(): Promise<ServiceAccount> {
  try {
    // Try to get the full service account JSON from Secret Manager
    const serviceAccountJson = await secretManager.getSecret('firebase-service-account-private-key');

    console.log('🔍 Firebase service account JSON fetched from Secret Manager');

    // Parse the JSON
    const serviceAccount = JSON.parse(serviceAccountJson);

    const credentials = {
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: decodePrivateKey(serviceAccount.private_key),
    };

    console.log('✅ Firebase credentials loaded:', credentials.clientEmail);

    return credentials;
  } catch (error) {
    console.log('⚠️ Failed to get Firebase credentials from Secret Manager, falling back to env vars:', error);

    // Fallback to environment variables
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY must be set');
    }

    return {
      projectId,
      clientEmail,
      privateKey: decodePrivateKey(privateKey),
    };
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

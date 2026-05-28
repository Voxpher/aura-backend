import admin from 'firebase-admin';

/**
 * Initialises the Firebase Admin SDK using environment variables.
 * Safe to call multiple times — skips initialisation if already done.
 */
export function initFirebase(): void {
  if (admin.apps.length > 0) {
    // Already initialised
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      '[Firebase] Environment variables not fully set — push notifications will be unavailable until configured.'
    );
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      // Replace escaped newlines that may come from .env files
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });

  console.log('Firebase Admin SDK initialised');
}

export { admin };

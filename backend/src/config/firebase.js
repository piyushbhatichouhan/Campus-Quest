const {
  initializeApp,
  applicationDefault,
  cert,
  getApps,
} = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

function resolveCredential() {
  // Option 1: Render Secret Environment Variable (Full JSON string)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed =
        typeof process.env.FIREBASE_SERVICE_ACCOUNT_JSON === "string"
          ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim())
          : process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

      if (!parsed.client_email || !parsed.private_key) {
        throw new Error(
          "Service account JSON must contain client_email and private_key."
        );
      }

      // Handle escaped newlines in private key if present
      if (
        typeof parsed.private_key === "string" &&
        parsed.private_key.includes("\\n")
      ) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      }

      return cert(parsed);
    } catch (err) {
      console.error(
        "[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:",
        err.message
      );
      throw err;
    }
  }

  // Option 2: Individual environment variables
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
  }

  // Option 3: Local file via GOOGLE_APPLICATION_CREDENTIALS or Google Cloud ADC
  return applicationDefault();
}

if (getApps().length === 0) {
  try {
    const credential = resolveCredential();
    const config = { credential };
    if (process.env.FIREBASE_PROJECT_ID) {
      config.projectId = process.env.FIREBASE_PROJECT_ID;
    }
    initializeApp(config);
  } catch (error) {
    console.error("[Firebase Admin] Initialization error:", error.message);
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
  }
}

const db = getFirestore();
const auth = getAuth();

module.exports = {
  db,
  auth,
};

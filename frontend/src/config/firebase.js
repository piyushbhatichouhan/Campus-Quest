import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getConfig } from "../config";

export let app = null;
export let auth = null;

let firebaseInitPromise = null;

export async function initializeFirebase() {
  if (app && auth) {
    return { app, auth };
  }

  if (!firebaseInitPromise) {
    firebaseInitPromise = (async () => {
      const config = await getConfig();
      const firebaseConfig = config.firebaseConfig || {
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      };

      app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      auth = getAuth(app);
      return { app, auth };
    })().catch((err) => {
      firebaseInitPromise = null;
      throw err;
    });
  }

  return firebaseInitPromise;
}

const RENDER_BACKEND_URL = "https://campus-quest-cqa8.onrender.com/api";
const LOCAL_BACKEND_URL = "http://localhost:5000/api";

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBhoeX1soM8UFXCfs9VNb1ConGlh9LYzm0",
  authDomain: "campusquest-877f2.firebaseapp.com",
  projectId: "campusquest-877f2",
  storageBucket: "campusquest-877f2.firebasestorage.app",
  messagingSenderId: "719452934708",
  appId: "1:719452934708:web:a4e29462d405e47716b061",
};

export function normalizeApiUrl(rawUrl) {
  const trimmedUrl = String(rawUrl).trim().replace(/\/+$/, "");
  return trimmedUrl.endsWith("/api") ? trimmedUrl : `${trimmedUrl}/api`;
}

function isLocalhostEnv() {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  );
}

function getCandidateConfigUrls() {
  const urls = [];
  const envUrl =
    import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL;

  if (envUrl && String(envUrl).trim()) {
    urls.push(`${normalizeApiUrl(envUrl)}/config`);
  }

  if (isLocalhostEnv()) {
    urls.push(`${LOCAL_BACKEND_URL}/config`);
  }

  urls.push(`${RENDER_BACKEND_URL}/config`);
  return Array.from(new Set(urls));
}

async function fetchBackendConfig() {
  const urls = getCandidateConfigUrls();

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Try next candidate URL
    }
  }

  return null;
}

async function fetchFirebaseHostingInitJson() {
  try {
    const res = await fetch("/__/firebase/init.json", { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Ignore when not running on Firebase Hosting
  }
  return null;
}

let configPromise = null;

export function getConfig() {
  if (!configPromise) {
    configPromise = (async () => {
      const backendData = await fetchBackendConfig();
      const backendFb = backendData?.firebaseConfig || backendData || {};

      let hostingFb = null;
      if (!backendFb.apiKey && !import.meta.env?.VITE_FIREBASE_API_KEY) {
        hostingFb = await fetchFirebaseHostingInitJson();
      }

      const envApiBaseUrl =
        import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL;
      const defaultApiBaseUrl = isLocalhostEnv()
        ? LOCAL_BACKEND_URL
        : RENDER_BACKEND_URL;

      const apiBaseUrl = normalizeApiUrl(
        envApiBaseUrl || backendData?.apiBaseUrl || defaultApiBaseUrl,
      );

      const firebaseConfig = {
        apiKey:
          backendFb.apiKey ||
          import.meta.env?.VITE_FIREBASE_API_KEY ||
          hostingFb?.apiKey ||
          DEFAULT_FIREBASE_CONFIG.apiKey,
        authDomain:
          backendFb.authDomain ||
          import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN ||
          hostingFb?.authDomain ||
          DEFAULT_FIREBASE_CONFIG.authDomain,
        projectId:
          backendFb.projectId ||
          import.meta.env?.VITE_FIREBASE_PROJECT_ID ||
          hostingFb?.projectId ||
          DEFAULT_FIREBASE_CONFIG.projectId,
        storageBucket:
          backendFb.storageBucket ||
          import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET ||
          hostingFb?.storageBucket ||
          DEFAULT_FIREBASE_CONFIG.storageBucket,
        messagingSenderId:
          backendFb.messagingSenderId ||
          import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID ||
          hostingFb?.messagingSenderId ||
          DEFAULT_FIREBASE_CONFIG.messagingSenderId,
        appId:
          backendFb.appId ||
          import.meta.env?.VITE_FIREBASE_APP_ID ||
          hostingFb?.appId ||
          DEFAULT_FIREBASE_CONFIG.appId,
      };

      return {
        apiBaseUrl,
        ...firebaseConfig,
        firebaseConfig,
      };
    })().catch((err) => {
      configPromise = null;
      throw err;
    });
  }

  return configPromise;
}

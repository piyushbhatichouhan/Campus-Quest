# Campus Quest — Render Backend Deployment Guide

This runbook provides the complete, production-grade instructions for deploying the **Campus Quest Express backend** to **Render** and connecting it with the **React + Vite frontend**.

---

## 1. Environment Variable Reference

The backend reads the following environment variables. Set them in the Render Dashboard (**Environment** tab) or via Blueprint:

| Variable Name | Required | Description | Origin / Source | Secret? | Environment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | Server execution environment. Set to `production`. | Render Dashboard | No | Render Backend |
| `PORT` | **Automatic** | Port Express listens on. Render automatically injects this (e.g. `10000`). Express defaults to `5000` locally. | Render Platform | No | Render Backend |
| `ALLOWED_ORIGINS` | **Yes** | Comma-separated list of permitted frontend URLs for CORS (e.g., `https://campus-quest.vercel.app,http://localhost:5173`). | Frontend Hosting URL | No | Render Backend |
| `FIREBASE_PROJECT_ID` | **Yes** | Firebase project identifier (e.g. `campusquest-877f2`). | Firebase Console | No | Render Backend |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **Yes\*** | Raw string of Firebase Admin service account key JSON file. | Firebase Console Service Account Key | **YES** | Render Backend Secret |
| `GOOGLE_APPLICATION_CREDENTIALS` | *Alternative | Path to service account key file (e.g., `/etc/secrets/firebase-admin-key.json` if using Render Secret File). | Render Secret Files | No (path only) | Render Backend |

> \* **Note on Firebase Credentials:** You can either provide `FIREBASE_SERVICE_ACCOUNT_JSON` as an Environment Variable (easiest) or upload the JSON as a Render **Secret File** and point `GOOGLE_APPLICATION_CREDENTIALS` to `/etc/secrets/firebase-admin-key.json`.

### Frontend Environment Variables (Hosting Provider e.g. Vercel / Netlify / Cloudflare Pages)

| Variable Name | Required | Description | Origin / Source | Secret? | Environment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | **Yes** | Base URL of deployed Render backend (e.g., `https://campus-quest-backend.onrender.com/api`). | Render Web Service URL | No | Frontend Hosting |
| `VITE_FIREBASE_API_KEY` | **Yes** | Firebase client Web SDK API key. | Firebase Console (Web App) | Public | Frontend Hosting |
| `VITE_FIREBASE_AUTH_DOMAIN` | **Yes** | Firebase client Auth domain. | Firebase Console (Web App) | Public | Frontend Hosting |
| `VITE_FIREBASE_PROJECT_ID` | **Yes** | Firebase client project ID. | Firebase Console (Web App) | Public | Frontend Hosting |
| `VITE_FIREBASE_STORAGE_BUCKET`| **Yes** | Firebase storage bucket. | Firebase Console (Web App) | Public | Frontend Hosting |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | **Yes** | Firebase messaging sender ID. | Firebase Console (Web App) | Public | Frontend Hosting |
| `VITE_FIREBASE_APP_ID` | **Yes** | Firebase Web application ID. | Firebase Console (Web App) | Public | Frontend Hosting |

---

## 2. Step-by-Step Deployment Runbook

### Step A: Prepare and Push Changes to GitHub

1. Review the git working tree to make sure no local keys or `.env` files are tracked:
   ```bash
   git status
   ```
2. Confirm `.gitignore` protects secrets:
   - `backend/.env`, `frontend/.env`
   - `*.json.secret`, `backend/firebase-admin-key.json`, `*service-account*.json`
3. Stage and commit the repository deployment changes:
   ```bash
   git add backend/src/server.js backend/src/app.js backend/src/config/firebase.js backend/package.json backend/.env.example frontend/src/services/gameApi.js frontend/.env.example render.yaml .gitignore docs/RENDER_DEPLOYMENT.md backend/src/tests/
   git commit -m "feat(deploy): configure Express backend and gameApi for Render production deployment"
   git push origin main
   ```

---

### Step B: Create the Render Web Service

You can deploy using either the **Render Dashboard (Manual)** or **Render Blueprint (`render.yaml`)**.

#### Method 1: Manual Dashboard Setup (Recommended)
1. Go to [dashboard.render.com](https://dashboard.render.com/) and sign in.
2. Click **New +** > **Web Service**.
3. Under **Connect a repository**, select `piyushbhatichouhan/Campus-Quest`.
4. Configure the service settings:
   - **Name:** `campus-quest-backend` (or your preferred service name)
   - **Region:** Choose the region closest to your users (e.g., Singapore or Frankfurt).
   - **Branch:** `main`
   - **Root Directory:** `backend` *(CRITICAL: Must be set to `backend`)*
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free` (or Starter for 24/7 always-on)
5. Expand **Advanced Settings**:
   - **Health Check Path:** `/health`
   - **Auto-Deploy:** `Yes`
6. Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `FIREBASE_PROJECT_ID`: `campusquest-877f2`
   - `ALLOWED_ORIGINS`: `https://YOUR-FRONTEND.vercel.app,http://localhost:5173` *(Update with your real frontend domain)*
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: Paste the entire JSON content of your `firebase-admin-key.json` file.
7. Click **Create Web Service**.

#### Method 2: Blueprint Setup
1. In Render Dashboard, click **New +** > **Blueprint**.
2. Select `piyushbhatichouhan/Campus-Quest`.
3. Render will detect `render.yaml` and prompt you to fill in the missing environment variables (`FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `ALLOWED_ORIGINS`).
4. Click **Apply**.

---

### Step C: Secure Firebase Admin Configuration

1. **Service Account Credentials:**
   - In [Firebase Console](https://console.firebase.google.com/):
     - Open **Project Settings** > **Service accounts**.
     - Verify the Project ID matches `campusquest-877f2`.
     - Click **Generate new private key** if you don't already have one saved locally.
   - Open the generated `.json` file in a text editor.
   - Copy the full content and paste it into the `FIREBASE_SERVICE_ACCOUNT_JSON` variable in Render.
   - *Never commit this file or paste its content in public issues/chats.*

2. **Database & Firestore Security Rules:**
   - The backend uses Firebase Admin SDK which has privileged administrative access to Firestore.
   - Existing client rules in `firestore.rules` intentionally block direct unauthorized client writes to ensure all game logic, XP awards, and riddle validations pass through backend transactional verification.
   - **Do not alter or weaken Firestore rules** for the deployment.

---

### Step D: Deploy and Verify Backend

1. **Monitor Build Logs:**
   - Watch the build in the Render Dashboard. Ensure `npm install` completes and the service starts:
     ```text
     DAVV Quest backend running on port 10000 (host: 0.0.0.0)
     ```
2. **Verify Public Health Check:**
   - In browser or terminal, request the public health endpoint:
     ```bash
     curl -i https://YOUR-SERVICE-NAME.onrender.com/health
     ```
   - Expected response (HTTP 200):
     ```json
     {
       "status": "ok",
       "uptime": 12,
       "timestamp": "2026-10-10T18:00:00.000Z"
     }
     ```
3. **Verify Public Game Endpoints:**
   - Test checkpoints endpoint:
     ```bash
     curl -i https://YOUR-SERVICE-NAME.onrender.com/api/checkpoints
     ```
   - Verify that 10 campus checkpoints are returned and that challenge answers (`challenge.answer`) are **strictly excluded**.
4. **Verify Authentication & Rejection of Unauthenticated Requests:**
   - Test a protected endpoint without an Authorization token:
     ```bash
     curl -i https://YOUR-SERVICE-NAME.onrender.com/api/game/state
     ```
   - Expected response: HTTP 401 with `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required."}}`.

---

### Step E: Connect the Frontend to the Deployed Backend

1. **Configure Frontend Environment Variable:**
   - In your frontend hosting platform (e.g., Vercel, Netlify, Cloudflare Pages, GitHub Pages):
     - Add environment variable:
       ```env
       VITE_API_BASE_URL=https://YOUR-SERVICE-NAME.onrender.com/api
       ```
     *(Or `VITE_API_URL=https://YOUR-SERVICE-NAME.onrender.com/api`)*
2. **Configure CORS on Render:**
   - In the Render Dashboard under **Environment Variables**, ensure `ALLOWED_ORIGINS` contains the exact URL of your deployed frontend (no trailing slash):
     ```env
     ALLOWED_ORIGINS=https://campus-quest.vercel.app,http://localhost:5173
     ```
3. **Re-trigger Frontend Build:**
   - Since Vite compiles `import.meta.env` values at build time, trigger a **Redeploy** on Vercel/Netlify after setting `VITE_API_BASE_URL`.
4. **End-to-End In-Browser Verification:**
   - Open your deployed frontend in the browser.
   - Open Developer Tools > Network tab.
   - Test the complete game loop:
     1. **Login / Register**: Account creation works and Firebase ID token is received.
     2. **Map Tab**: Checkpoints load and render on the Leaflet map from Render backend.
     3. **Quest Tab**: Discovery clues display accurately.
     4. **Claim Checkpoint & Answer Riddle**: Submit challenge answer; backend validates answer and awards XP atomically.
     5. **Leaderboard Tab**: Player rank and XP update without leaking emails.
     6. **Inventory & Profile Tabs**: Collected artifacts and player stats display properly.

---

### Step F: Production Considerations & Limitations

1. **Free Tier Inactivity Spin-Down:**
   - Render's Free Web Service spins down after **15 minutes of inactivity**.
   - The first request after idling may experience a **"cold start" delay of 30–50 seconds**.
   - Once awake, subsequent requests respond in milliseconds.
   - For an uninterrupted 24/7 experience, consider upgrading to the Render Starter instance ($7/month).
2. **Ephemeral File System:**
   - Render containers have an ephemeral file system. Files written to local disk are wiped on service redeploy or container restart.
   - **Campus Quest is completely safe**: All persistent player state, checkpoints, XP, items, and accounts are stored durably in **Cloud Firestore** and **Firebase Authentication**, not local disk.
3. **Logging & Security Auditing:**
   - Server logs never print Firebase service account private keys or raw client credentials.
   - Helmet HTTP headers (`X-Content-Type-Options: nosniff`, CSP) and Express Rate Limiting are active across all endpoints.

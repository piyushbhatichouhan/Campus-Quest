# Campus Quest — DAVV Indore

Campus Quest is a location-based campus exploration game for DAVV, Indore, built with React, Vite, Leaflet, Node.js, Express, and Firebase.

## Account System & Authentication Setup

The game features a complete, secure account system powered by Firebase Authentication (Email/Password) and Firebase Admin SDK.

### 1. Frontend Setup

1. Copy `frontend/.env.example` to `frontend/.env`:
   ```bash
   cp frontend/.env.example frontend/.env
   ```

2. Obtain your Firebase Web App configuration from the [Firebase Console](https://console.firebase.google.com/):
   - Open **Project Settings** > **General** > **Your apps** > **Web App**.
   - Copy the configuration keys into `frontend/.env`:
     ```env
     VITE_API_URL=http://localhost:5000/api
     VITE_FIREBASE_API_KEY=AIzaSy...
     VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
     VITE_FIREBASE_PROJECT_ID=your-project-id
     VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
     VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
     VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
     ```

3. Install dependencies and start the dev server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### 2. Backend Setup

1. Copy `backend/.env.example` to `backend/.env`:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Ensure Email/Password authentication is enabled under **Firebase Console** > **Authentication** > **Sign-in method**.

3. Download a Service Account private key JSON from **Firebase Console** > **Project Settings** > **Service accounts** > **Generate new private key**. Save it outside source control (e.g. `backend/firebase-admin-key.json`).

4. Configure `backend/.env`:
   ```env
   PORT=5000
   FIREBASE_PROJECT_ID=your-project-id
   GOOGLE_APPLICATION_CREDENTIALS=D:\path\to\firebase-admin-key.json
   ```

5. Install dependencies and start the backend server:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

### 3. How Authentication & Security Work

- **Frontend Auth**: Handled via `AuthContext` using Firebase Client SDK (`createUserWithEmailAndPassword`, `signInWithEmailAndPassword`, `onAuthStateChanged`).
- **Protected API Requests**: Every gameplay request (starting game, getting game state, claiming checkpoints, submitting challenge answers) attaches a Bearer ID Token in the `Authorization` header.
- **Backend Verification**: `requireAuth` middleware verifies the ID token using `firebase-admin/auth` (`verifyIdToken`).
- **Authorization & XP Security**: The player identity is derived strictly from `req.user.uid` in the verified token. Requests cannot specify or forge a target `playerId`. Challenge answers are checked atomically on the backend, and XP is awarded within Firestore transactions to prevent duplicate score exploits.
- **Leaderboard Security**: Public leaderboards expose display names, ranks, and XP while keeping email addresses private.

### 4. Git & Security Practices

- Secret environment files (`frontend/.env`, `backend/.env`) and service account keys (`firebase-admin-key.json`) are listed in `.gitignore` and must never be committed.

### 5. Verification & Testing Steps

1. **Register**: Navigate to `/register`, enter a display name, valid email, and password (at least 6 characters).
2. **Login**: Log out and log back in using `/login`.
3. **Session Persistence**: Refresh the browser page — session remains restored automatically.
4. **Gameplay & Progress**: Claim active checkpoints, solve challenges, and view updated XP on the profile and leaderboard.
5. **Cross-device / Multi-browser**: Log into the same account on a different browser window to see identical progress restored.

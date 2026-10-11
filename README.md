# Campus Quest — DAVV Indore

**Campus Quest** is a location-based campus exploration and orientation game designed for college students at Devi Ahilya Vishwavidyalaya (DAVV), Indore. Built with a retro, Minecraft-inspired pixel aesthetic, the game turns campus discovery into an interactive multiplayer treasure hunt.

Players form teams of up to 4, follow clues, navigate campus grounds using their real-world GPS coordinates, claim physical checkpoints, solve riddles, earn shared XP, and climb the live squad leaderboard.

---

## 1. Game Mechanics

Campus Quest follows a strictly sequential progression system to guide new students through key campus landmarks in a structured order:

1. **Clue & Mission Dispatch**: The team receives a clue for their current active checkpoint (e.g., the Mechanical Workshop, Central Library, or F-Block Pond). Future checkpoint coordinates, clues, and answers remain hidden on the server to prevent spoilers.
2. **Physical Exploration**: Team members walk across campus toward the target landmark using the interactive Leaflet campus map.
3. **Geofence Detection**: As players approach the landmark, the browser's Geolocation API tracks their real-time coordinates. When a player enters the checkpoint's designated radius (typically 30 meters), the checkpoint status transitions from `REVEALED` to `DISCOVERED`.
4. **Checkpoint Claiming**: Any team member physically present within the geofence can claim the checkpoint. The Express backend verifies their GPS position against the authoritative checkpoint coordinates using the Haversine distance formula.
5. **Challenge Unlocked**: Once claimed, the checkpoint's riddle or puzzle becomes accessible to the entire team (`CHALLENGE` status).
6. **Challenge Completion**: Any teammate can submit the answer. The backend normalizes and validates the answer without ever exposing the solution to the client.
7. **Shared XP & Rewards**: When the correct answer is submitted:
   - The team is awarded points (e.g. +100 XP).
   - Artifacts (such as "Engineer's Gear" or "Scholar's Scroll") are added to the team inventory.
   - An in-game notification toasts across all teammates' screens.
8. **Next Checkpoint Unlocks**: The next campus checkpoint unlocks immediately for all squad members. The adventure continues until all 10 checkpoints are completed.

---

## 2. Technology Stack

- **Frontend**:
  - **Framework**: React 18 with Vite for ultra-fast compilation and HMR.
  - **Styling**: Vanilla CSS with custom pixel-art borders, dark-mode palettes, and the *Press Start 2P* typography creating an authentic adventure-game atmosphere.
  - **Map & Spatial UI**: Leaflet.js and React-Leaflet with custom map tiles and player GPS position markers.
  - **Authentication Client**: Firebase Authentication Web SDK (supporting both Email/Password for Leaders and Anonymous Auth for Members).
- **Backend**:
  - **Runtime & Server**: Node.js with Express.
  - **Security & Hardening**: Helmet (HTTP security headers), CORS origin filtering, strict Express rate-limiters (global, action-based, and brute-force challenge limiters), and payload sanitization.
  - **Admin Auth & Database**: Firebase Admin SDK and Google Cloud Firestore.
- **Infrastructure & Hosting**:
  - **Frontend Hosting**: Firebase Hosting.
  - **Backend Hosting**: Render Web Service.

---

## 3. System Architecture

```
                      +-----------------------------+
                      |   Browser / Mobile Device   |
                      |  (HTML5 Geolocation + Map)  |
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               |                                           |
               v                                           v
    +-----------------------+                   +--------------------+
    | Firebase Auth Client  |                   | React + Vite App   |
    | (Email & Anonymous)   |                   | (Leaflet Map & UI) |
    +-----------+-----------+                   +----------+---------+
                |                                          |
                | ID Token                                 | HTTPS / REST
                +---------------------+--------------------+
                                      |
                                      v
                      +-----------------------------+
                      |   Render Express Backend    |
                      |   - requireAuth Middleware  |
                      |   - Geofence Haversine Calc |
                      |   - Idempotent Controllers  |
                      |   - Activity Event Dispatch |
                      +--------------+--------------+
                                     |
                                     | Firebase Admin SDK
                                     v
                      +-----------------------------+
                      |       Cloud Firestore       |
                      | - teams/{teamId}            |
                      | - teamCodes/{joinCode}      |
                      | - teams/{id}/events         |
                      | - players/{uid}             |
                      +-----------------------------+
```

### Key Architectural Highlights:
- **Zero Client Trust**: All coordinate distances, answers, checkpoint unlocking, score mutations, and team roster changes are validated authoritatively on the Express backend inside atomic Firestore transactions.
- **Client Access Denied Directly**: `firestore.rules` enforces `allow read, write: if false;` on client SDKs. All operations securely traverse the backend using Firebase Admin privileges.
- **Runtime API Discovery**: The frontend retrieves its active backend URL at runtime via `/api/config`, ensuring smooth transitions across local, staging, and production environments without rebuilding client bundles.

---

## 4. Minimum Viable Product (MVP): Browser Geolocation Tracking

The foundational MVP capability of Campus Quest is **browser-based location tracking and geofencing**:

1. **HTML5 Geolocation API**: The frontend uses `navigator.geolocation.watchPosition` with high accuracy (`enableHighAccuracy: true`, `timeout: 10000`, `maximumAge: 0`) encapsulated within the `useGeolocation` hook.
2. **Real-time Map Visuals**: Leaflet displays the user's current physical position as an animated pulsing marker on the campus map, centering smoothly as they navigate between university buildings.
3. **Client-Side Distance Calculation**: As the player walks, client-side utilities calculate the straight-line distance to the active checkpoint using the Haversine formula, offering dynamic feedback ("Approaching checkpoint...", "Area discovered!").
4. **Authoritative Server Validation**: When a player presses **[CLAIM CHECKPOINT]**, the device's latitude and longitude are transmitted with their Firebase ID token to `POST /api/game/checkpoints/:id/claim`. The server recalculates the Haversine distance:
   $$\text{distance} = 2 R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta \text{lon}}{2}\right)}\right)$$
   Only when the computed distance is within the checkpoint's defined radius (30 meters) does the server atomically claim the checkpoint for the entire team.

---

## 5. Team-Based Multiplayer System

The application uses an account model tailored for orientation events:

### Team Leader
- Registers with Team Name, Leader Name, Email, and Password (`/register`).
- Automatically assigned as the first member of the squad.
- Receives a unique, cryptographically random 6-character code (e.g. `PX7K2M`).
- Manages the team lobby (`/lobby`), tracks arriving members, and starts the adventure.

### Team Members
- Join directly via the public `/join` route by supplying the 6-character code and their display name.
- Authenticate instantaneously via **Firebase Anonymous Authentication** without requiring emails, passwords, or verification links.
- Sessions persist across page refreshes and browser reloads.
- Join up to a strict maximum capacity of 4 members per team.

### Shared Multiplayer Features
- **Team Lobby (`/lobby`)**: Live polling synchronization (every 3–5s) updates the roster in real time. When the leader presses `[ START ADVENTURE ]`, all teammates are automatically transitioned to the game view.
- **Shared Progression**: If Member A enters the geofence and claims a checkpoint, it updates for Members B, C, and D. If Member B answers the riddle, the whole squad receives the XP and unlocks the next clue.
- **Team Header Status**: Shows the squad name, active player count, and team XP (`PIXEL EXPLORERS • 3/4 PLAYERS • 250 XP`).
- **Live Activity Toasts**: Real-time popups notify teammates whenever someone claims a checkpoint or solves a challenge (*"Jordan claimed the Mechanical Workshop checkpoint!"*).
- **Deterministic Team Leaderboard**: Ranks squads based on:
  1. Total XP (descending)
  2. Most completed checkpoints (descending)
  3. Earliest timestamp at which the score was achieved (tie-breaker)
  4. Stable team identifier

---

## 6. Setup and Installation Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- [npm](https://www.npmjs.com/)
- A [Firebase Project](https://console.firebase.google.com/) with Firestore and Authentication enabled.

---

### Step 1: Firebase Console Configuration

1. **Enable Authentication Providers**:
   - Go to **Firebase Console** > **Authentication** > **Sign-in method**.
   - Enable **Email/Password**.
   - Enable **Anonymous** authentication (required for frictionless teammate joining).
2. **Enable Cloud Firestore**:
   - Go to **Firestore Database** > **Create database**.
   - Choose production mode.
3. **Generate Service Account Key**:
   - Go to **Project Settings** > **Service accounts**.
   - Click **Generate new private key** and download the JSON file.
   - Save it inside `backend/` as `firebase-admin-key.json` (do not commit this file).

---

### Step 2: Backend Setup

1. Open your terminal in the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure the environment:
   Create or edit `backend/.env`:
   ```env
   PORT=5000
   FIREBASE_PROJECT_ID=your-firebase-project-id
   GOOGLE_APPLICATION_CREDENTIALS=D:\path\to\Campus Quest\backend\firebase-admin-key.json
   ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.web.app
   ```
4. Run automated test suites (validates security, CORS, and full team multiplayer flows):
   ```bash
   npm test
   ```
5. Start the backend development server:
   ```bash
   npm run dev
   ```
   *The backend will start at `http://localhost:5000`.*

---

### Step 3: Frontend Setup

1. Open another terminal in the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure frontend environment:
   Create or edit `frontend/.env`:
   ```env
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_APP_ID=your-app-id
   VITE_API_BASE_URL=http://localhost:5000/api
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```
   *The frontend will open at `http://localhost:5173`.*

---

## 7. Verifying the Full Game Flow

1. **Leader Registration**: Navigate to `http://localhost:5173/register`. Register as Team Leader with a team name (e.g. *Pixel Explorers*), leader name (*Alex*), email, and password.
2. **Team Lobby**: You will be redirected to `/lobby` with your generated 6-character code (e.g. `PX7K2M`).
3. **Member Joining**: Open an Incognito window or separate browser, visit `http://localhost:5173/join`, enter the 6-character code, and type a display name (*Jordan*).
4. **Live Lobby Sync**: The leader's lobby automatically reflects Jordan joining (2/4 players).
5. **Adventure Launch**: The leader clicks `[ START ADVENTURE ]`. Both browser windows automatically transition into `/game`.
6. **Geolocation & Checkpoint**: Either player claims the active checkpoint within its geofence coordinates and solves the riddle. Both players immediately receive the points, unlock the next checkpoint, and see their team on `/leaderboard`!

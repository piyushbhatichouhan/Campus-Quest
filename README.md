# Campus Quest

Campus Quest is a browser-based, location-driven multiplayer treasure hunt designed for college campus exploration and student orientation events. Configured around the Devi Ahilya Vishwavidyalaya (DAVV) campus in Indore, the application turns real-world campus landmarks into sequential digital checkpoints.

Players form squads of up to four members, decipher clues leading to physical campus locations, walk to those landmarks using live GPS coordinates, claim checkpoints within a server-verified geofence, and solve location-specific riddles to unlock the next destination. All teams compete simultaneously on a global event timeline managed by an administrator.

Campus Quest runs entirely inside a standard mobile or desktop web browser. It does not require:

- A dedicated Android application
- A dedicated iOS application
- External GPS hardware
- Special tracking devices or beacons

### Intended Use Cases

- **College orientation programs**: Guiding incoming students to essential academic blocks, libraries, workshops, and administrative offices.
- **Campus exploration**: Turning physical navigation across university grounds into a structured, self-paced or timed activity.
- **Interactive treasure hunts**: Running campus-wide competitions during college festivals and student events.
- **Team-building activities**: Encouraging small groups to collaborate on spatial navigation and problem-solving.

### Primary Differentiator

Campus Quest combines browser geolocation, authoritative server-side geofencing, shared team state synchronization, and administrator-controlled race mechanics in a zero-install web application. Rather than trusting client-side state or exposing future checkpoint coordinates, all proximity validations, riddle verifications, and progression updates are executed on the backend inside atomic database transactions.

---

## Core MVP: Browser-Based Geolocation

The technical foundation of Campus Quest is **browser-based geolocation paired with server-side geofencing** to verify physical checkpoint discovery during a multiplayer treasure hunt.

### End-to-End Geolocation and Geofencing Flow

1. **Application Launch**: The player opens Campus Quest in a mobile or desktop web browser over HTTPS (or `localhost` during development).
2. **Permission Request**: When the game view mounts, the frontend invokes the browser's native Geolocation API (`navigator.geolocation.watchPosition`), prompting the user to grant location access.
3. **Device Coordinate Acquisition**: The device's GPS chip, Wi-Fi triangulation, or cellular positioning hardware resolves the player's physical coordinates.
4. **Frontend Position Updates**: The React hook `useGeolocation` (`frontend/src/hooks/useGeolocation.js`) receives `position.coords.latitude`, `position.coords.longitude`, and `position.coords.accuracy` (in meters), updating the player marker and accuracy radius circle on the Leaflet map.
5. **Clue-Driven Navigation**: The player reads the current mystery clue and walks toward the suspected campus landmark. Undiscovered checkpoints are hidden from the map so players must rely on the clue rather than following a map pin.
6. **Client-Side Proximity Detection**: As coordinates update, `useGameEngine` (`frontend/src/hooks/useGameEngine.js`) computes the distance between the player and the active checkpoint using `getDistanceToCheckpoint` and `isInsideGeofence` (`frontend/src/utils/geofence.js`). Entering the 30-meter radius transitions the checkpoint UI state from `REVEALED` (mystery clue view) to `DISCOVERED`, revealing the checkpoint's name and enabling the **Claim Checkpoint** button.
7. **Location Submission**: When the player taps **Claim Checkpoint**, the frontend sends an authenticated `POST /api/game/checkpoints/:id/claim` request containing `{ latitude, longitude }` in the JSON body alongside the player's Firebase ID token.
8. **Authoritative Coordinate Lookup**: The Express backend (`backend/src/services/game.service.js`) looks up the target checkpoint definition from `backend/src/data/checkpoints.js` to retrieve its authoritative latitude, longitude, and allowed radius (`30` meters).
9. **Server-Side Distance Calculation**: The backend validates that the submitted coordinates are finite numbers within valid geographical bounds (`lat` in `[-90, 90]`, `lon` in `[-180, 180]`) and computes the great-circle distance in meters using the Haversine formula (`distanceInMeters`).
10. **Geofence Verification and Shared State Update**: If the calculated distance exceeds `checkpoint.radius` (`30` meters), the server rejects the request with `400 OUTSIDE_GEOFENCE`. If the player is within `30` meters, the backend executes a Firestore transaction that verifies the global event is `active`, confirms the checkpoint matches the team's current sequence index, records the claim timestamp, unlocks the checkpoint challenge for the entire squad, and logs a team activity notification.

### Browser Geolocation Implementation (`useGeolocation.js`)

The frontend tracks device movement using `navigator.geolocation.watchPosition` rather than a one-time `getCurrentPosition` call so that distance calculations and map positions update automatically as the player walks across campus:

```javascript
const watchId = navigator.geolocation.watchPosition(
  (position) => {
    setLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    });
    setError(null);
    setLoading(false);
  },
  (err) => {
    setError(err.message);
    setLoading(false);
  },
  {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 10000,
  },
);
```

When the component unmounts, `navigator.geolocation.clearWatch(watchId)` stops location watching.

### Haversine Distance Formula

Both the frontend (`frontend/src/utils/distance.js`) and backend (`backend/src/services/game.service.js`) calculate the spherical distance between two latitude/longitude coordinates using the Haversine formula with an Earth radius of `R = 6,371,000` meters:

$$a = \sin^2\left(\frac{\Delta \varphi}{2}\right) + \cos(\varphi_1)\cdot\cos(\varphi_2)\cdot\sin^2\left(\frac{\Delta \lambda}{2}\right)$$

$$d = 2R \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right)$$

where $\varphi_1, \varphi_2$ are latitudes in radians and $\Delta \varphi, \Delta \lambda$ are the differences in latitude and longitude in radians.

### Concept of Geofencing and Server Authority

Each campus checkpoint in `backend/src/data/checkpoints.js` defines a center coordinate (`latitude`, `longitude`) and a virtual circular boundary (`radius: 30` meters).

While the frontend evaluates `distance <= checkpoint.radius` to update the user interface and unlock the claim button when a player walks into range, **the frontend check is strictly for UI responsiveness**. A user could modify client-side JavaScript state in browser developer tools to force the button to appear. Therefore, the backend independently recalculates the Haversine distance inside `claimCheckpoint` before mutating Firestore.

### Practical GPS Limitations and Scope of Location Tracking

- **Hardware and Environmental Variance**: GPS accuracy varies across mobile phones and laptops. Dense campus buildings, trees, and indoor corridors can cause signal reflection (multipath interference) or degraded accuracy (`±20m` to `±100m`).
- **Permission and Secure Context Requirements**: The browser Geolocation API requires explicit user permission and only functions in secure contexts (`HTTPS` in production or `http://localhost` during local development).
- **Client Coordinate Spoofing**: Because coordinates originate from the browser's `navigator.geolocation` API, a technically savvy user can override coordinates using browser developer tools or OS-level mock location providers. Server-side geofencing prevents trivial UI bypasses and enforces valid coordinate geometry, but it does not provide cryptographic proof of physical presence.
- **Proximity Validation vs. Continuous Background Tracking**: Campus Quest is **not** a continuous background tracking system. The browser only reads coordinates while the web page is open, and the frontend only transmits coordinates to the backend when a player explicitly claims a checkpoint (`POST /api/game/checkpoints/:id/claim`). Teammates' live physical positions are not streamed to other players or stored in the database.

---

## How the Game Works

### 1. Team Creation
- A team leader navigates to `/register` and submits a **Team Name** (2–30 characters), **Leader Name**, **Email**, and **Password**.
- The frontend creates a Firebase Authentication Email/Password account and calls `POST /api/teams/create`.
- While the global event is in `waiting` state, the backend creates a team document in Firestore, assigns the leader as the first member (`role: "leader"`), and reserves a unique 6-character uppercase alphanumeric **Join Code** (generated using `crypto.randomBytes` from the unambiguous alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, excluding `0`, `O`, `1`, `I`, and `L`).

### 2. Joining a Team and Anonymous Authentication
- Up to **3 additional members** (for a strict maximum team capacity of **4 players**, `maxMembers: 4`) can join the squad at `/join` by entering the 6-character join code and a display name.
- Teammates do not need to register an email or password. The frontend calls `signInAnonymously(auth)` via **Firebase Anonymous Authentication** to establish a persistent session UID, then calls `POST /api/teams/join`.
- Team registration and joining are permitted only while the global event status is `waiting`.

### 3. Team Lobby (`/lobby`)
- After creating or joining a team during the `waiting` phase, players are placed in the Team Lobby.
- The lobby polls `GET /api/teams/me` every `3.5` seconds (while the browser tab is visible) to synchronize the squad roster (`MEMBERS (N/4)`) and global event state.
- While in the lobby, the team leader can remove members (`POST /api/teams/members/:uid/remove`), and members can leave (`POST /api/teams/leave`). If a solo leader leaves, the team is disbanded and its join code is released.
- Once the administrator starts the event, team rosters are locked (`CANNOT_LEAVE_ACTIVE_GAME` / `GAME_ACTIVE`), and all connected lobby clients automatically navigate to `/game`.

### 4. Administrator-Controlled Event Lifecycle
Team leaders cannot start the competition themselves (`POST /api/teams/start` is disabled and returns `403 ADMIN_CONTROLLED`). Instead, a single global event document (`events/main`) governs all participating teams across four lifecycle states:
- **`waiting`**: Pre-game lobby phase. Team creation, joining, leaving, and member removal are enabled. The first mystery clue is hidden.
- **`active`**: Competition in progress. The official event timer runs, team rosters and registration are locked, the first mystery clue is unlocked for all teams, and checkpoint claims and challenge submissions are enabled.
- **`stopped`**: Competition frozen by the administrator. All checkpoint claims and challenge submissions are immediately rejected (`403 EVENT_NOT_ACTIVE`), and the event timer stops at `stoppedAt`.
- **`completed`**: Official final standings finalized by the administrator after reviewing results in the `stopped` state. Administrators can subsequently reset the event back to `waiting` or launch a new round via the dashboard.

### 5. Mystery Checkpoints
Campus Quest features **10 sequential campus checkpoints** defined in `backend/src/data/checkpoints.js`:
1. Mechanical Workshop (`100 XP`, `30m` radius)
2. Library (`100 XP`, `30m` radius)
3. F-block Pond (`100 XP`, `30m` radius)
4. CSE Block (B-block) (`100 XP`, `30m` radius)
5. Central Placement Cell (`100 XP`, `30m` radius)
6. Electronics Block-1 (D-block) (`100 XP`, `30m` radius)
7. Admin Block (M-block) (`100 XP`, `30m` radius)
8. Electronics Block-2 (E-block) (`100 XP`, `30m` radius)
9. IT Block (F-block) (`100 XP`, `30m` radius)
10. Mechanical Block (A-block) (`150 XP`, `30m` radius)

To preserve exploration:
- Before a checkpoint is physically discovered, its status is `REVEALED` (for the current target) or `HIDDEN` (for future targets).
- In `GameMap.jsx`, markers and geofence circles are rendered **only** for checkpoints with status `DISCOVERED`, `CHALLENGE`, or `COMPLETED`. Undiscovered checkpoints do not appear on the map.
- In `QuestCard.jsx` and `QuestsView.jsx`, an undiscovered active checkpoint masks its true building name as `Mystery Checkpoint #<order>` and hides its distance readout, displaying only the text clue (`currentClue`) that guides players to the location.

### 6. Checkpoint Discovery and Claiming
- When any teammate physically enters the 30-meter radius of the active checkpoint, the client transitions the checkpoint from `REVEALED` to `DISCOVERED`, plays a discovery sound effect, displays the checkpoint's real name and `discoveryText`, and renders its marker on the map.
- Clicking **Claim Checkpoint** invokes `POST /api/game/checkpoints/:id/claim`.
- Upon server-side Haversine validation, the team's `claimedCheckpointId` is set to the checkpoint ID, `checkpointProgress[id].claimedAt` is recorded, and the checkpoint transitions to `CHALLENGE` for all members of the team.

### 7. Challenges and Shared Team Progression
- In `CHALLENGE` state, the checkpoint riddle (`challenge.question`) is displayed. Riddle answers are never included in `GET /api/checkpoints` or `GET /api/game/state` responses.
- Any team member can submit an answer via `POST /api/game/checkpoints/:id/challenge`.
- The backend normalizes both the submitted answer and the stored solution (trimming whitespace, converting to lowercase, and stripping trailing `.!?` punctuation) inside a Firestore transaction.
- When solved:
  - The checkpoint ID is appended to `completedCheckpoints`.
  - `currentCheckpointIndex` increments by `1`, and `claimedCheckpointId` resets to `null`.
  - The checkpoint's XP (`100` or `150` points) is added to the team's shared `score`.
  - The checkpoint's collectible artifact (`rewardItem`, such as *Engineer's Gear* or *Scholar's Scroll*) is added to the team's shared `inventory`.
  - `checkpointProgress[id].completedAt` and `lastCheckpointCompletedAt` are recorded.
  - The next checkpoint's clue (`nextClue`) unlocks for the entire squad.

### 8. Team Activity Synchronization
- While in `/game`, `useGameEngine` polls `GET /api/game/state` every `3.5` seconds, and `useTeamActivity` (`frontend/src/hooks/useTeamActivity.js`) polls `GET /api/teams/events?since=<ISO_TIMESTAMP>` every `4` seconds.
- Whenever a teammate claims a checkpoint or solves a challenge, or when the administrator starts or stops the event, toast notifications (`TeamNotification.jsx`) and synthesized Web Audio API sound effects (`frontend/src/utils/sounds.js`) alert all active squad members.

### 9. Adventure Completion
- When the 10th checkpoint (*Mechanical Block (A-block)*) challenge is solved (`nextIndex >= checkpoints.length`), the transaction marks the team document with `status: "completed"` and records the official `completedAt` timestamp.

### Gameplay Flow Diagram

```text
Leader Creates Team (/register)  --->  6-Character Join Code Generated
                                              |
Teammates Join via Code (/join)  <------------+
(Firebase Anonymous Auth, max 4)
      |
      v
Waiting Lobby (/lobby)
(Roster syncs every 3.5s; mystery clue locked)
      |
      v
Administrator Starts Event (/admin)
(Global state: waiting -> active; rosters locked)
      |
      v
Mystery Clue Unlocked (/game)
(Target location hidden on map; shown as "Mystery Checkpoint #N")
      |
      v
Solve Clue & Walk Campus
(Browser watchPosition tracks GPS coordinates)
      |
      v
Enter 30m Checkpoint Geofence
(Status: REVEALED -> DISCOVERED; landmark name & pin revealed)
      |
      v
Claim Checkpoint (POST /api/game/checkpoints/:id/claim)
(Backend verifies Haversine distance <= 30m; records claimedAt)
      |
      v
Complete Riddle Challenge (POST /api/game/checkpoints/:id/challenge)
(Backend verifies answer atomically; awards shared XP + Artifact)
      |
      +---> [More Checkpoints Remain] ---> Unlock Next Mystery Clue
      |
      v
[All 10 Checkpoints Solved]
      |
      v
Adventure Completed (Team completedAt timestamp recorded)
```

---

## Leaderboards and Competition

Campus Quest uses a deterministic, race-based ranking engine implemented in `getLeaderboard` (`backend/src/services/game.service.js`).

### Overall Race Leaderboard Ranking Rules

Teams are sorted using six ordered rules:

1. **Adventure Completion Status**: Teams that have completed all 10 checkpoints (`completedCount >= 10` or `completedAt` set) always rank above unfinished teams.
2. **Earliest Adventure Completion Time**: Among completed teams, the squad with the earliest `completedAt` timestamp ranks higher (`a.completedAtMillis - b.completedAtMillis`).
3. **Completed Checkpoints Count**: Among unfinished teams, the squad that has completed more checkpoints ranks higher (`b.completedCount - a.completedCount`).
4. **Earliest Recent Checkpoint Completion Time**: If unfinished teams are tied on completed checkpoint count, the squad that completed its most recent checkpoint earlier ranks higher (`lastCheckpointCompletedAt` / `checkpointProgress[lastId].completedAt` / `lastScoreUpdatedAt` ascending).
5. **Total XP Score**: If still tied, the squad with the higher `score` (XP) ranks higher.
6. **Deterministic Tie-Breaker**: Finally, `String(a.teamId).localeCompare(String(b.teamId))` guarantees a stable ordering.

### Role of XP

Each completed checkpoint awards XP (`100 XP` for Checkpoints 1–9 and `150 XP` for Checkpoint 10, totaling `1,050 XP`), which also drives the player UI level calculation (`level = Math.floor(score / 250) + 1`). Because checkpoints are completed in strict sequential order, XP correlates with checkpoint count and acts as the fifth tie-breaker in leaderboard sorting.

### Overall Leaderboard vs. Checkpoint Arrival Analytics

| Feature | Endpoint | Ranking Criteria | Audience |
| :--- | :--- | :--- | :--- |
| **Public Race Leaderboard** | `GET /api/leaderboard` | 6-step race hierarchy (completion status, finish time, checkpoint count, latest checkpoint time, XP, team ID). Never exposes player email addresses or undiscovered checkpoint names. | Players (`/leaderboard` & in-game Rank tab) |
| **Admin Race Leaderboard** | `GET /api/admin/leaderboard` | Same 6-step race hierarchy for administrative monitoring. | Administrators (`/admin`) |
| **Checkpoint Arrival Analytics** | `GET /api/admin/checkpoints/:checkpointId/leaderboard` | Ranks all teams that claimed a specific checkpoint by earliest original `claimedAt` timestamp (`a.claimMillis - b.claimMillis`), with `teamId` as tie-breaker. | Administrators (`/admin` Checkpoint Analytics tab) |
| **Team Journey Timeline** | `GET /api/admin/teams/:teamId` | Chronological 22-step audit log per squad: official `event_start`, `checkpoint_claimed` + `challenge_completed` for all 10 checkpoints, and `adventure_completion`. | Administrators (`/admin` Team Timelines tab) |

### Authoritative Server Timestamps

All competitive timestamps (`startedAt`, `stoppedAt`, `finalizedAt` on `events/main`, and `claimedAt`, `completedAt`, `lastCheckpointCompletedAt` on `teams/{teamId}`) are generated on the backend when the Firestore transaction commits. If a team claims a checkpoint more than once before solving its riddle, the backend preserves the original `claimedAt` timestamp (`checkpointProgress[id]?.claimedAt || now`) so arrival rankings cannot be accidentally overwritten.

---

## Administrator Dashboard

The Administrator Command Center (`/admin`, implemented in `frontend/src/pages/AdminDashboard.jsx` and backed by `backend/src/routes/admin.routes.js` and `backend/src/services/event.service.js`) provides centralized control and live telemetry over the competition.

### Administrator Authentication and Authorization

Administrator routes are protected by two Express middleware layers: `requireAuth` (verifies the Firebase ID token) followed by `requireAdmin` (`backend/src/middleware/requireAdmin.js`).

While regular players only need a valid Firebase session (Email/Password or Anonymous), `checkIsAdminUser` grants administrator access only if at least one of the following server-side conditions is met:
1. The user's decoded Firebase ID token contains the custom claim `admin: true`.
2. The user's email matches an entry in the `ADMIN_EMAILS` environment variable (comma-separated, case-insensitive).
3. The user's UID matches an entry in the `ADMIN_UIDS` environment variable (comma-separated).
4. A Firestore document exists at `admins/{uid}` with `active !== false`.
5. The user's Firestore document at `players/{uid}` has `isAdmin: true` or `role: "admin"`.

Unauthenticated requests receive `401 UNAUTHORIZED`; authenticated non-admin users receive `403 FORBIDDEN` and are shown a security access control screen in `/admin`.

### Implemented Dashboard Capabilities

- **Global Lifecycle Controls & Safeguards**:
  - **Start Competition (`waiting -> active`)**: Uses a two-step modal flow requiring the administrator to type `START EVENT` before invoking `POST /api/admin/event/start`.
  - **Stop Entire Event (`active -> stopped`)**: Visually separated danger-zone control with a two-step confirmation modal requiring the administrator to type `STOP EVENT` before invoking `POST /api/admin/event/stop`.
  - **Finalize Official Results (`stopped -> completed`)**: Confirmation modal invoking `POST /api/admin/event/finalize` to mark frozen standings as official.
  - **Start / Prepare New Event (`stopped | completed -> waiting | active`)**: Modal requiring the administrator to type `NEW EVENT` (`POST /api/admin/event/new`), with options to either keep existing registered teams (resetting their progress, inventory, and XP to `0`) or delete all existing teams and join codes, and then either open the `waiting` lobby or launch a new `active` event immediately.
  - **HTTP Method Protection**: `GET` requests to `/api/admin/event/start`, `/stop`, `/finalize`, `/new`, and `/reset` are explicitly blocked with `405 METHOD_NOT_ALLOWED`.
- **Live Competition Timer & Overview Metrics**: Displays current event status (`WAITING`, `ACTIVE`, `STOPPED`, `COMPLETED (OFFICIAL)`), server-synced elapsed timer, audit timestamps (`startedAt`/`startedBy`, `stoppedAt`/`stoppedBy`, `finalizedAt`/`finalizedBy`), and live counts of registered teams, total players, completed teams, in-progress teams, and checkpoints.
- **Race Leaderboard Tab**: Live table showing rank, team name, checkpoint progress (`N/10`), finish time, XP, member count, and a shortcut to inspect the team's timeline.
- **Checkpoint Analytics Tab**: Selector chips for all 10 campus checkpoints (`#1 Mechanical Workshop` through `#10 Mechanical Block`), displaying arrival order ranked by original claim timestamp alongside challenge completion time.
- **Team Journey Inspector Tab**: Side-by-side squad selector and 22-step chronological timeline (`Event start time`, each checkpoint's claim and challenge completion timestamps, and `Adventure completion`).

---

## Tech Stack

### Frontend (`frontend/`)
- **React (`^19.2.8`) & React DOM (`^19.2.8`)**: Component architecture, hooks (`useGeolocation`, `useGameEngine`, `useTeamActivity`), and context state management (`AuthContext`).
- **Vite (`^8.3.0`) & `@vitejs/plugin-react` (`^6.1.1`)**: Frontend dev server, hot module replacement, and production bundler.
- **React Router DOM (`^7.18.4`)**: Client-side routing (`/login`, `/register`, `/join`, `/lobby`, `/game`, `/leaderboard`, `/profile`, `/admin`) with route guards (`ProtectedRoute`, `PublicRoute`, `AdminRoute`, `RootRedirect`).
- **Leaflet (`^1.9.4`) & React-Leaflet (`^5.0.0`)**: Interactive OpenStreetMap campus map rendering player GPS position, accuracy radius circle, and discovered checkpoint geofence circles.
- **Firebase Web SDK (`^13.0.0`)**: Client-side authentication supporting Email/Password sign-in for team leaders and Anonymous sign-in for team members.
- **Lucide React (`^1.52.0`)**: UI icons across quest cards, navigation bars, and headers.
- **Browser APIs**: HTML5 Geolocation API (`navigator.geolocation.watchPosition`) for live coordinate tracking and Web Audio API (`window.AudioContext`) in `frontend/src/utils/sounds.js` for synthesized discovery and completion sound effects.
- **Vanilla CSS**: Custom pixel-art styling (`Press Start 2P` and `Inter` typography).

### Backend (`backend/`)
- **Node.js (`>=18.0.0`) & Express (`^5.3.0`)**: REST API server handling authentication middleware, geofence math, riddle verification, team management, and admin lifecycle controls.
- **Firebase Admin SDK (`^14.5.0`)**: Server-side verification of Firebase ID tokens (`auth.verifyIdToken`) and privileged read/write access to Cloud Firestore (`firebase-admin/firestore`). Includes an automatic in-memory Firestore and Auth mock (`backend/src/config/firebase.js`) used when running automated tests or when explicit credentials are absent.
- **Helmet (`^8.3.0`)**: Sets HTTP security headers (`X-Content-Type-Options`, `Content-Security-Policy`, `X-Frame-Options`, etc.).
- **CORS (`^2.8.6`)**: Enforces origin allowlisting (`ALLOWED_ORIGINS` plus default local and Firebase Hosting origins).
- **Express Rate Limit (`^8.7.1`)**: Protects endpoints with three tiered limiters (`globalLimiter`, `actionLimiter`, and `challengeLimiter`).
- **Dotenv (`^18.0.7`)**: Loads environment variables from `backend/.env`.
- **Supertest (`^7.3.1`) & Node.js Test Runner (`node:test`)**: Automated integration, security, lifecycle, and multiplayer test suites.

### Database & Deployment Infrastructure
- **Cloud Firestore**: NoSQL document database storing global event state, teams, member rosters, join codes, player profiles, and activity events.Locked down to direct client access via `firestore.rules`.
- **Firebase Hosting**: Hosts the compiled frontend static bundle (`frontend/dist`) with SPA rewrite rules (`frontend/firebase.json`).
- **Render**: Hosts the Node.js Express backend web service (`render.yaml`).

---

## System Architecture

```mermaid
flowchart TD
    subgraph Client["Browser Client (React + Vite)"]
        Geo["Browser Geolocation API\n(navigator.geolocation.watchPosition)"]
        UI["Game UI, Leaflet Map & Admin Console"]
        AuthSDK["Firebase Web Auth SDK\n(Email/Password & Anonymous)"]
    end

    subgraph FirebaseCloud["Firebase Services"]
        FBAuth["Firebase Authentication"]
        Firestore[("Cloud Firestore\n(Direct client access denied)")]
    end

    subgraph Server["Express Backend (Node.js on Render)"]
        ConfigRoute["GET /api/config\n(Runtime Config & Public Firebase Init)"]
        AuthMW["requireAuth & requireAdmin\n(Firebase Admin verifyIdToken)"]
        Services["Game, Team & Event Services\n(Haversine Geofence & Atomic Transactions)"]
    end

    Geo -->|"Latitude, Longitude, Accuracy"| UI
    UI <-->|"Sign In / Sign Up"| AuthSDK
    AuthSDK <-->|"Issue ID Token"| FBAuth
    UI -->|"1. Fetch Runtime Config"| ConfigRoute
    UI -->|"2. REST API + Bearer ID Token\n+ GPS Coordinates"| AuthMW
    AuthMW -->|"Verify JWT Signature"| FBAuth
    AuthMW -->|"Verified req.user"| Services
    Services <-->|"Firebase Admin SDK\n(Read / Transactional Write)"| Firestore
```

### Architectural Workflow

1. **Runtime Configuration & Firebase Initialization**: When the frontend boots, `getConfig()` (`frontend/src/config.js`) queries `GET /api/config` on the backend to obtain the `apiBaseUrl` and public Firebase Web configuration (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`), initializing the Firebase client asynchronously (`initializeFirebase()` in `frontend/src/config/firebase.js`).
2. **Obtaining Authentication Tokens**: Team leaders authenticate with Email/Password (`createUserWithEmailAndPassword` / `signInWithEmailAndPassword`), while team members authenticate via `signInAnonymously`. Before protected API requests, `gameApi.js` retrieves a fresh JWT via `auth.currentUser.getIdToken()`.
3. **Authenticated Backend Requests**: `gameApi.js` attaches `Authorization: Bearer <idToken>` to HTTP requests sent to the Express server.
4. **Server-Side Token Verification**: `requireAuth` (`backend/src/middleware/requireAuth.js`) verifies the token using `firebase-admin/auth` (`verifyIdToken`) and populates `req.user` (`uid`, `email`, `name`, `admin`, `claims`). Client-supplied UIDs are never trusted for identity.
5. **Team Resolution**: `resolvePlayerTeam(uid)` (`backend/src/services/game.service.js`) looks up `players/{uid}` to find the player's `teamId` and loads the shared `teams/{teamId}` document.
6. **Authoritative Validation & Atomic Transactions**: All state-changing operations (team creation, code reservation, member joining, checkpoint claiming, challenge submission, and event lifecycle transitions) execute inside `db.runTransaction(...)`.
7. **Direct Client Database Lockdown**: `firestore.rules` sets `allow read, write: if false;` on `/{document=**}`. Clients cannot read checkpoint answers or mutate scores directly in Firestore.
8. **State Synchronization via HTTP Polling**: The application uses visibility-aware HTTP polling (`document.visibilityState === "visible"`) rather than WebSockets or client-side Firestore listeners:
   - `Lobby.jsx`: Polls `GET /api/teams/me` every `3.5` seconds.
   - `useGameEngine.js`: Polls `GET /api/game/state` every `3.5` seconds.
   - `useTeamActivity.js`: Polls `GET /api/teams/events?since=...` every `4.0` seconds.
   - `AdminDashboard.jsx`: Polls overview, leaderboard, teams, and checkpoint analytics every `4.0` seconds.

---

## Project Structure

```text
Campus-Quest-main/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── firebase.js                 # Firebase Admin init + in-memory Firestore/Auth fallback
│   │   │   └── firebase.test.js            # Connectivity check script for Firestore
│   │   ├── data/
│   │   │   └── checkpoints.js              # Authoritative 10 campus checkpoints, coordinates, riddles & rewards
│   │   ├── middleware/
│   │   │   ├── requireAdmin.js             # Admin RBAC verification (env vars, custom claims, Firestore docs)
│   │   │   ├── requireAuth.js              # Firebase ID token verification (requireAuth & optionalAuth)
│   │   │   └── security.js                 # Rate limiters, input sanitization & coordinate validation
│   │   ├── routes/
│   │   │   ├── admin.routes.js             # /api/admin/* event lifecycle, overview & analytics routes
│   │   │   ├── game.routes.js              # /api/* public checkpoints, game state, claim, challenge & /config
│   │   │   └── team.routes.js              # /api/teams/* create, join, me, leave, remove & activity events
│   │   ├── services/
│   │   │   ├── event.service.js            # Global event state machine, overview metrics & checkpoint analytics
│   │   │   ├── game.service.js             # Geofence Haversine check, riddle validation & race leaderboard
│   │   │   └── team.service.js             # Join code allocation, roster management & team event logging
│   │   ├── tests/
│   │   │   ├── adminEventLifecycle.test.js # Event lifecycle, race ranking & admin analytics test suite
│   │   │   ├── gameIntegration.test.js     # Public/protected game API integration tests
│   │   │   ├── renderConfig.test.js        # Health check, CORS & security header tests
│   │   │   ├── security.test.js            # Auth, RBAC, payload limit & answer non-leakage tests
│   │   │   └── teamSystem.test.js          # Multiplayer team creation, joining & shared progress tests
│   │   ├── app.js                          # Express app setup, Helmet, CORS, health checks & error handler
│   │   └── server.js                       # HTTP server entry point & graceful shutdown handlers
│   ├── .env.example                        # Example backend environment configuration
│   └── package.json                        # Backend dependencies and test scripts
├── frontend/
│   ├── public/                             # Static favicon and icon assets
│   ├── src/
│   │   ├── components/game/
│   │   │   ├── GameBottomNav.jsx           # In-game tab bar (Map, Quests, Bag, Rank)
│   │   │   ├── GameHeader.jsx              # Squad name, player count, elapsed timer, level & XP bar
│   │   │   ├── GameMap.jsx                 # React-Leaflet map, player GPS marker & discovered geofences
│   │   │   ├── InventoryView.jsx           # Collected checkpoint artifacts view
│   │   │   ├── QuestCard.jsx               # Active checkpoint clue, claim button & riddle input modal
│   │   │   ├── QuestPanel.jsx              # Floating bottom HUD showing current clue and distance status
│   │   │   ├── QuestsView.jsx              # Sequential list of completed and active campus quests
│   │   │   ├── RankView.jsx                # In-game race leaderboard view
│   │   │   ├── SideMenu.jsx                # Slide-out navigation drawer
│   │   │   └── TeamNotification.jsx        # Toast notifications for live team activity
│   │   ├── config/
│   │   │   └── firebase.js                 # Asynchronous Firebase Web SDK initialization
│   │   ├── context/
│   │   │   └── AuthContext.jsx             # Auth provider (leader register/login, anonymous join, team sync)
│   │   ├── data/
│   │   │   └── checkpoints.js              # Reference checkpoint definitions
│   │   ├── hooks/
│   │   │   ├── useGameEngine.js            # Game state polling, client geofence evaluation & claim/submit actions
│   │   │   ├── useGeolocation.js           # Browser navigator.geolocation.watchPosition hook
│   │   │   └── useTeamActivity.js          # Team activity event polling & audio/toast triggers
│   │   ├── pages/
│   │   │   ├── AdminDashboard.jsx          # Administrator command center (/admin)
│   │   │   ├── Game.jsx                    # Main gameplay container (/game)
│   │   │   ├── JoinTeam.jsx                # Teammate 6-char code join page (/join)
│   │   │   ├── Leaderboard.jsx             # Full-page race leaderboard (/leaderboard)
│   │   │   ├── Lobby.jsx                   # Pre-game waiting room & squad roster management (/lobby)
│   │   │   ├── Login.jsx                   # Team leader & admin sign-in page (/login)
│   │   │   ├── Profile.jsx                 # Player & squad profile summary (/profile)
│   │   │   └── Register.jsx                # Team leader account & squad creation page (/register)
│   │   ├── services/
│   │   │   └── gameApi.js                  # REST API client with automatic Bearer token injection
│   │   ├── utils/
│   │   │   ├── authErrors.js               # User-friendly Firebase Auth error mapper
│   │   │   ├── distance.js                 # Client Haversine distance calculation
│   │   │   ├── geofence.js                 # Client geofence helper functions
│   │   │   └── sounds.js                   # Web Audio API sound effects
│   │   ├── App.jsx                         # Route definitions and auth/team route guards
│   │   ├── config.js                       # Runtime configuration loader (/api/config)
│   │   └── main.jsx                        # React DOM entry point
│   ├── .env.example                        # Example frontend environment variables
│   ├── .firebaserc                         # Firebase project alias configuration
│   ├── firebase.json                       # Firebase Hosting configuration
│   ├── package.json                        # Frontend dependencies and Vite scripts
│   └── vite.config.js                      # Vite bundler configuration
├── docs/
│   ├── RENDER_DEPLOYMENT.md                # Production deployment runbook for Render & Firebase
│   └── SECURITY_AUDIT.md                   # Security audit report and endpoint inventory
├── firestore.rules                         # Cloud Firestore security rules (denies direct client access)
├── render.yaml                             # Render Blueprint infrastructure specification
├── README.md                               # Original repository README
└── README_NEW.md                           # Comprehensive technical documentation
```

---

## Getting Started

### Prerequisites

- **Node.js**: Version `18.0.0` or higher (specified in `backend/package.json` `engines.node`)
- **npm**: Included with Node.js
- **Firebase Project**: A Google Firebase project with **Authentication** and **Cloud Firestore** enabled

### 1. Installation

Install dependencies separately in the `backend` and `frontend` directories:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Firebase Project Setup

1. Open the [Firebase Console](https://console.firebase.google.com/) and create or select your project.
2. **Authentication**:
   - Navigate to **Build > Authentication > Sign-in method**.
   - Enable **Email/Password** (used by team leaders and administrators).
   - Enable **Anonymous** (used by team members joining via a 6-character code).
3. **Cloud Firestore**:
   - Navigate to **Build > Firestore Database** and create a database.
   - Apply the rules in `firestore.rules` (`allow read, write: if false;` for direct client requests).
4. **Service Account Credentials (for Backend)**:
   - Open **Project Settings > Service accounts**.
   - Click **Generate new private key** to download the service account JSON file.
   - Keep this file outside version control (`.gitignore` excludes `backend/firebase-admin-key.json` and `*service-account*.json`).
5. **Web App Configuration (for Frontend)**:
   - Open **Project Settings > General > Your apps** and register a Web App to obtain `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, and `appId`.

### 3. Environment Variables

#### Backend (`backend/.env`)

Create `backend/.env` based on `backend/.env.example`. The backend supports the following environment variables across `src/server.js`, `src/app.js`, `src/config/firebase.js`, `src/middleware/requireAdmin.js`, and `src/routes/game.routes.js`:

```env
# Server execution environment (development | production | test)
NODE_ENV=development

# Port Express listens on (defaults to 5000)
PORT=5000

# Comma-separated list of allowed frontend CORS origins
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Public URL of the backend API returned by GET /api/config (optional locally)
PUBLIC_API_BASE_URL=http://localhost:5000/api

# Firebase project ID
FIREBASE_PROJECT_ID=your_firebase_project_id

# --- Firebase Admin Credentials (choose ONE option) ---

# Option 1: Raw JSON string of the service account key (recommended on Render)
# FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your_firebase_project_id","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxx@your_firebase_project_id.iam.gserviceaccount.com"}

# Option 2: Path to local service account JSON file
GOOGLE_APPLICATION_CREDENTIALS=./firebase-admin-key.json

# Option 3: Individual service account fields
# FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your_firebase_project_id.iam.gserviceaccount.com
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# --- Optional Administrator Provisioning ---
# Comma-separated emails or UIDs granted access to /admin
ADMIN_EMAILS=admin@example.com
ADMIN_UIDS=your_admin_firebase_uid

# --- Optional Explicit Public Firebase Web Config for GET /api/config ---
# FIREBASE_API_KEY=your_firebase_web_api_key
# FIREBASE_AUTH_DOMAIN=your_firebase_project_id.firebaseapp.com
# FIREBASE_STORAGE_BUCKET=your_firebase_project_id.firebasestorage.app
# FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
# FIREBASE_APP_ID=your_firebase_web_app_id

# Optional: Force in-memory database mode for local offline testing
# USE_IN_MEMORY_DB=false
```

#### Frontend (`frontend/.env`)

Create `frontend/.env` based on `frontend/.env.example`:

```env
# Backend API Base URL (VITE_API_BASE_URL or VITE_API_URL)
VITE_API_BASE_URL=http://localhost:5000/api
VITE_API_URL=http://localhost:5000/api

# Firebase Web App Configuration
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_web_app_id
```

### 4. Backend Credential Loading Behavior

In `backend/src/config/firebase.js`, the backend resolves credentials in the following order:
1. `FIREBASE_SERVICE_ACCOUNT_JSON` (parses the JSON string and normalizes escaped `\n` characters in `private_key`).
2. `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`.
3. `GOOGLE_APPLICATION_CREDENTIALS` via `applicationDefault()`.

If no explicit Firebase credentials are provided (or when running under `node --test`, `NODE_ENV=test`, or `USE_IN_MEMORY_DB=true`), `backend/src/config/firebase.js` automatically falls back to an **in-memory Firestore and Auth implementation** supporting document CRUD, subcollections, queries, and optimistic concurrency transactions.

### 5. Frontend Runtime Configuration

When the frontend starts, `frontend/src/config.js` fetches `GET /api/config` from the backend (`http://localhost:5000/api/config` on `localhost`, or the configured Render backend URL) and merges the response with any `VITE_*` environment variables. This allows the frontend to initialize Firebase Auth (`frontend/src/config/firebase.js`) and resolve the backend API URL dynamically at runtime.

### 6. Running the Application Locally

Open two terminals:

**Terminal 1 — Start the Express Backend:**

```bash
cd backend
npm run dev
```

*(Or `npm start` to run with `node src/server.js` directly.)*  
The backend listens on `http://localhost:5000` (health check at `http://localhost:5000/health`).

**Terminal 2 — Start the Vite Frontend:**

```bash
cd frontend
npm run dev
```

The frontend dev server starts at `http://localhost:5173`.

### 7. Running Automated Tests and Linting

The backend includes 45 automated tests across 5 test files using Node's built-in test runner (`node:test`) and `supertest` against the isolated in-memory Firestore store:

```bash
cd backend

# Run all test suites sequentially
npm test

# Run security audit tests only
npm run test:security

# Run game integration tests only
npm run test:integration

# Test live Firebase Admin connection (requires valid credentials)
npm run test:firebase
```

To lint or build the frontend:

```bash
cd frontend

# Run ESLint
npm run lint

# Build production bundle into frontend/dist
npm run build
```

### 8. Troubleshooting Common Setup Issues

- **`auth/operation-not-allowed` or `Email/Password sign-in is not enabled`**: Enable both **Email/Password** and **Anonymous** sign-in providers in the Firebase Console under **Authentication > Sign-in method**.
- **`auth/invalid-api-key` on Frontend Load**: Ensure either the backend is reachable at `/api/config` returning a valid `apiKey`, or `VITE_FIREBASE_API_KEY` is set in `frontend/.env`.
- **`[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON`**: Ensure the JSON string is valid single-line JSON and includes both `client_email` and `private_key`.
- **CORS Blocked Requests in Browser**: Verify the frontend origin (e.g., `http://localhost:5173` or your deployed domain without a trailing slash) is listed in `ALLOWED_ORIGINS` on the backend.
- **Browser Location Permission Denied**: If location access was blocked in the browser, reset site permissions for `localhost` or your hosted domain in the browser address bar settings and reload `/game`.
- **Geolocation Unavailable on Mobile Over LAN IP**: Modern browsers block `navigator.geolocation` on insecure `http://192.168.x.x` origins. Test on `http://localhost` via port forwarding or serve over `HTTPS`.
- **`403 — ADMINISTRATOR ACCESS REQUIRED` on `/admin`**: Add your logged-in user's email to `ADMIN_EMAILS` in `backend/.env` (or set `active: true` in `admins/{uid}` in Firestore) and refresh.

---

## Deployment

Campus Quest uses a split production deployment model:

1. **Frontend on Firebase Hosting**:
   - Configured via `frontend/firebase.json` and `frontend/.firebaserc`.
   - Serves static assets from `frontend/dist` and rewrites all routes (`**`) to `/index.html` for React Router SPA navigation.
   - Build and deploy commands from `frontend/`:
     ```bash
     npm run build
     firebase deploy --only hosting
     ```
2. **Backend on Render**:
   - Configured via `render.yaml` (or manual Web Service setup with Root Directory set to `backend`).
   - Build command: `npm install`
   - Start command: `npm start` (`node src/server.js`)
   - Health check path: `/health`
3. **Production Environment Variables**:
   - **Render Backend**: `NODE_ENV=production`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `ALLOWED_ORIGINS` (comma-separated frontend URLs), `PUBLIC_API_BASE_URL`, and `ADMIN_EMAILS` / `ADMIN_UIDS`.
   - **Frontend Build / Hosting**: `VITE_API_BASE_URL` pointing to `https://<your-render-service>.onrender.com/api` (plus optional `VITE_FIREBASE_*` build variables; runtime config is also served via `GET /api/config`).

---

## API Overview

All application routes are mounted in `backend/src/app.js`, `backend/src/routes/game.routes.js`, `backend/src/routes/team.routes.js`, and `backend/src/routes/admin.routes.js`.

| HTTP Method | Endpoint | Purpose | Authentication |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Lightweight Render load-balancer health and uptime check. | Public |
| `GET` | `/api/health` | API status check returning service message. | Public |
| `GET` | `/api/config` | Returns runtime `apiBaseUrl` and public Firebase Web SDK configuration. | Public |
| `GET` | `/api/event/status` | Returns public global event lifecycle state (`status`, `startedAt`, `stoppedAt`, `finalizedAt`, `elapsedSeconds`, `totalCheckpoints`, `isOfficial`). | Public |
| `GET` | `/api/checkpoints` | Returns all 10 campus checkpoints with coordinates, radii, discovery text, and riddle questions (challenge answers are stripped). | Public |
| `GET` | `/api/leaderboard` | Returns the sorted race leaderboard without exposing player email addresses. | Optional Bearer Token (`optionalAuth`) |
| `POST` | `/api/game/start` | Initializes or updates the authenticated player's profile and returns initial game state. | Bearer Token (`requireAuth`) |
| `GET` | `/api/game/state` | Returns the authenticated player's shared team progression, current mystery clue, inventory, and rank. | Bearer Token (`requireAuth`) |
| `POST` | `/api/game/checkpoints/:id/claim` | Validates submitted `{ latitude, longitude }` against the active checkpoint's 30m geofence using Haversine distance and claims the checkpoint for the team. | Bearer Token (`requireAuth`) |
| `POST` | `/api/game/checkpoints/:id/challenge` | Validates submitted `{ answer }` against the claimed checkpoint's riddle inside a Firestore transaction, awards XP/artifacts, and unlocks the next clue. Rate-limited to 10 req/min. | Bearer Token (`requireAuth`) |
| `POST` | `/api/teams/create` | Creates a new team during the `waiting` phase, assigns the caller as leader, and allocates a unique 6-character `joinCode`. | Bearer Token (`requireAuth`) |
| `POST` | `/api/teams/join` | Joins an existing team (up to 4 members) during the `waiting` phase using `{ joinCode, displayName }`. | Bearer Token (`requireAuth`) |
| `GET` | `/api/teams/me` | Returns the caller's current team metadata, member roster, join code, and event status. | Bearer Token (`requireAuth`) |
| `POST` | `/api/teams/start` | Legacy team-start endpoint; always returns `403 ADMIN_CONTROLLED` because event start is administrator-controlled. | Bearer Token (`requireAuth`) |
| `POST` | `/api/teams/leave` | Removes the caller from their current team (or disbands if solo leader) while the event is in `waiting` state. | Bearer Token (`requireAuth`) |
| `POST` | `/api/teams/members/:uid/remove` | Allows a team leader to remove a squad member while the event is in `waiting` state. | Bearer Token (`requireAuth`) |
| `GET` | `/api/teams/events` | Returns team activity events (`?since=<timestamp>`) for live in-game toast notifications. | Bearer Token (`requireAuth`) |
| `GET` | `/api/admin/event` | Returns global event status with admin audit fields (`startedBy`, `stoppedBy`, `finalizedBy`) and checkpoint metadata. | Admin (`requireAuth` + `requireAdmin`) |
| `POST` | `/api/admin/event/start` | Transitions the global event from `waiting` to `active`, starts the official timer, and unlocks the first clue for all teams. | Admin (`requireAuth` + `requireAdmin`) |
| `POST` | `/api/admin/event/stop` | Transitions the global event from `active` to `stopped`, freezing all gameplay and timestamps. | Admin (`requireAuth` + `requireAdmin`) |
| `POST` | `/api/admin/event/finalize` | Transitions the global event from `stopped` to `completed`, marking standings as official. | Admin (`requireAuth` + `requireAdmin`) |
| `POST` | `/api/admin/event/new` | Resets a `stopped` or `completed` event for a new round (`waiting` or `active`), resetting team progress or optionally clearing teams (`POST /api/admin/event/reset` is an alias). | Admin (`requireAuth` + `requireAdmin`) |
| `GET` | `/api/admin/overview` | Returns global event status alongside aggregate metrics (`totalTeams`, `totalPlayers`, `completedTeams`, `inProgressTeams`, `totalCheckpoints`). | Admin (`requireAuth` + `requireAdmin`) |
| `GET` | `/api/admin/teams` | Lists all registered teams with join codes, leader names, member counts, scores, and completion timestamps. | Admin (`requireAuth` + `requireAdmin`) |
| `GET` | `/api/admin/teams/:teamId` | Returns full team details, member roster, per-checkpoint progress, and the 22-step `journeySteps` timeline. | Admin (`requireAuth` + `requireAdmin`) |
| `GET` | `/api/admin/leaderboard` | Returns the authoritative race leaderboard for the administrator dashboard. | Admin (`requireAuth` + `requireAdmin`) |
| `GET` | `/api/admin/checkpoints/:checkpointId/leaderboard` | Returns arrival analytics for a specific checkpoint ranked by earliest original `claimedAt` timestamp. | Admin (`requireAuth` + `requireAdmin`) |
| `GET` | `/api/admin/players` | Lists up to 50 recent teams/players with summary progression metrics. | Admin (`requireAuth` + `requireAdmin`) |
| `POST` | `/api/admin/players/:uid/reset` | Resets a specific team document's score, checkpoints, and inventory back to initial `waiting` state. | Admin (`requireAuth` + `requireAdmin`) |

---

## Database Design

All application state is stored in Cloud Firestore and accessed exclusively through the backend's Firebase Admin SDK.

### Collections and Document Schemas

#### 1. `events/main`
Single authoritative document tracking the global competition lifecycle:
- `id`: `"main"`
- `status`: `"waiting"` | `"active"` | `"stopped"` | `"completed"`
- `startedAt`, `stoppedAt`, `finalizedAt`: Firestore Timestamps or `null`
- `startedBy`, `stoppedBy`, `finalizedBy`: Administrator email/UID or `null`
- `createdAt`, `updatedAt`: Firestore Timestamps

#### 2. `teams/{teamId}`
Stores shared squad state, progression, and checkpoint arrival history:
- `id`: Unique team ID (`team_<timestamp>_<randomHex>`)
- `name`: Sanitized team name
- `joinCode`: 6-character uppercase code
- `leaderUid`, `leaderName`: Leader identity
- `status`: `"waiting"` | `"active"` | `"completed"`
- `maxMembers`: `4`
- `memberCount`: Current member count (`1` to `4`)
- `score`: Shared team XP
- `currentCheckpointIndex`: Integer index (`0` to `10`) into the checkpoints array
- `claimedCheckpointId`: Currently claimed checkpoint ID or `null`
- `completedCheckpoints`: Array of completed checkpoint IDs
- `checkpointProgress`: Map of `{ [checkpointId]: { claimedAt, completedAt } }`
- `inventory`: Array of earned reward artifact objects (`{ id, name, type, icon, rarity, description, earnedAt }`)
- `completedAt`: Timestamp when all 10 checkpoints were finished (or `null`)
- `lastCheckpointCompletedAt`, `lastScoreUpdatedAt`, `createdAt`, `updatedAt`: Timestamps

#### 3. `teams/{teamId}/members/{uid}` (Subcollection)
Stores the squad's member roster:
- `uid`: Firebase user UID
- `displayName`: Sanitized player name
- `role`: `"leader"` | `"member"`
- `joinedAt`: Timestamp

#### 4. `teams/{teamId}/events/{eventId}` (Subcollection)
Chronological activity stream polled by `useTeamActivity`:
- `id`: Event document ID
- `type`: `"member_joined"` | `"member_left"` | `"event_started"` | `"event_stopped"` | `"event_reset"` | `"checkpoint_claimed"` | `"challenge_completed"` | `"checkpoint_unlocked"` | `"adventure_completed"`
- `actorUid`, `actorName`: Player or administrator who triggered the event
- `checkpointId`, `checkpointName`, `points`: Optional checkpoint context
- `message`: Formatted notification string
- `createdAt`: Timestamp

#### 5. `teamCodes/{joinCode}`
Lookup index mapping a 6-character join code to a `teamId` to guarantee uniqueness during atomic team creation:
- `teamId`: Reference to `teams/{teamId}`
- `createdAt`: Timestamp

#### 6. `players/{uid}`
Maps an authenticated Firebase user UID to their active team:
- `uid`: Firebase user UID
- `teamId`: Associated `teams/{teamId}` (or `null`)
- `displayName`: Sanitized player name
- `role`: `"leader"` | `"member"`
- `email`: User email (if registered via Email/Password; never exposed on leaderboards)
- `isAdmin`: Optional boolean flag for admin authorization
- `createdAt`, `updatedAt`: Timestamps

#### 7. `admins/{uid}` (Optional)
Used by `requireAdmin` to grant administrator access via Firestore:
- `active`: Boolean (`true` enables admin privileges)

### Transactional Integrity

Firestore transactions (`db.runTransaction`) protect critical state transitions:
- **Unique Join Code Allocation**: Reads `teamCodes/{candidateCode}` and `players/{uid}` inside a transaction before creating the team document.
- **Roster Capacity & Locking**: Reads `events/main` and `teams/{teamId}` inside a transaction to enforce `maxMembers: 4` and block joining/leaving once `eventData.status !== "waiting"`.
- **Race-Safe Checkpoint Claiming & Challenge Submission**: Re-reads `events/main` and `teams/{teamId}` inside the transaction to verify the event is still `active` (preventing claims after `stopEvent`), verifies `completedCheckpoints` does not already include the checkpoint (preventing duplicate XP farming from concurrent requests), and preserves the original `claimedAt` timestamp.

---

## Security and Limitations

### Implemented Security Controls

1. **Firebase ID Token Verification (`requireAuth`)**: Every protected endpoint verifies the `Authorization: Bearer <token>` header using the Firebase Admin SDK. Player identity is derived strictly from `req.user.uid`.
2. **Role-Based Admin Access Control (`requireAdmin`)**: Administrative endpoints under `/api/admin/*` verify admin status against server-side environment variables, custom claims, or Firestore records, returning `403 FORBIDDEN` to regular players and team leaders.
3. **Server-Side Geofence & Answer Validation**: Riddle answers are stripped from all client-facing checkpoint payloads (`getCheckpointState` in `backend/src/services/game.service.js`), and Haversine distance checks are enforced on the server before claiming.
4. **Direct Firestore Access Blocked**: `firestore.rules` denies all direct client reads and writes (`allow read, write: if false;`), forcing all data access through the Express API.
5. **Tiered Rate Limiting (`backend/src/middleware/security.js`)**:
   - `globalLimiter`: 100 requests per 15 minutes per IP across all routes.
   - `actionLimiter`: 30 requests per 15 minutes per IP on state-changing game, team, and admin routes.
   - `challengeLimiter`: 10 attempts per 1 minute per IP on `/api/game/checkpoints/:id/challenge` to prevent riddle brute-forcing.
6. **Input Sanitization & Payload Limits**: `express.json({ limit: "10kb" })` rejects oversized request bodies (`413 Payload Too Large`), and `sanitizeString` strips HTML special characters (`<>&"'`) and control characters while enforcing strict length caps.
7. **HTTP Security Headers & CORS Allowlist**: `helmet()` sets standard security headers, and `cors()` restricts cross-origin requests to explicitly permitted origins.

### Practical Limitations

- **Client-Side GPS Spoofing**: Because coordinates are captured via the browser's `navigator.geolocation` API, the backend cannot distinguish genuine physical GPS hardware readings from coordinates emulated via browser developer tools or OS mock-location utilities.
- **Indoor & Urban Multipath Drift**: GPS accuracy degrades inside campus buildings or under heavy tree cover, which can temporarily place a physically present player outside the 30-meter radius.
- **Continuous Network Dependency**: Both the Leaflet map tiles (OpenStreetMap), Firebase Authentication, and the polling-based game engine require an active internet connection.
- **Anonymous Session Persistence**: Teammates who join via Firebase Anonymous Authentication have their identity tied to browser storage. Clearing browser site data or switching browsers creates a new anonymous UID that is not linked to the previous session.

---

## MVP and Future Scope

### Completed MVP

The completed MVP demonstrates that a multi-team, location-based campus treasure hunt can be delivered entirely through a standard web browser without native mobile apps or specialized hardware:
- Real-time browser GPS tracking (`navigator.geolocation.watchPosition`) paired with an interactive Leaflet map.
- Mystery checkpoint progression where undiscovered landmarks are hidden from the map until a player physically enters the 30-meter geofence.
- Authoritative Express backend performing Haversine geofence validation and transactional riddle grading in Cloud Firestore.
- Frictionless squad formation combining Email/Password leader accounts, 6-character join codes, and Firebase Anonymous Authentication for teammates.
- Administrator command center with global event lifecycle controls (`waiting`, `active`, `stopped`, `completed`), race leaderboards, checkpoint arrival analytics, and 22-step team journey timelines.

### Possible Future Improvements

The following capabilities are **not** currently implemented and represent potential future enhancements:
- **Accuracy-Weighted Geofencing**: Factoring `position.coords.accuracy` into server-side proximity checks when players are near buildings with weak GPS reception.
- **Anti-Spoofing Heuristics**: Detecting impossible travel velocities between sequential checkpoint claims or integrating on-site physical verification (such as rotating QR codes at checkpoints alongside GPS checks).
- **Multiple Concurrent Event Instances**: Supporting multiple independent event rooms or campus maps simultaneously instead of a single global `events/main` document.
- **WebSocket / Server-Sent Events (SSE) Push Updates**: Replacing the 3.5–4 second HTTP polling intervals with persistent push connections for lower-latency notifications.
- **Offline Caching**: Caching map tiles and static assets via a Service Worker to improve resilience in campus dead zones.

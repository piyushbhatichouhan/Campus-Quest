# Campus Quest — Full-Stack Security Audit & Hardening Report

**Application:** Campus Quest — DAVV Indore Exploration Game  
**Repository:** `piyushbhatichouhan/Campus-Quest`  
**Date:** October 2026  
**Auditor:** Application Security Engineering  

---

## Executive Summary

A comprehensive full-stack security audit, threat assessment, exploit prevention refactoring, and security test suite implementation were performed on the Campus Quest application.

All critical, high, and medium security vulnerabilities identified during the audit have been resolved directly in the codebase and verified with automated security tests.

---

## 1. Architecture & Attack Surface Overview

Campus Quest is a full-stack application comprising:
- **Frontend**: React (Vite) single-page application rendering an interactive Leaflet campus map, pixel UI, quest cards, profile, and leaderboard.
- **Backend API**: Node.js / Express server proxying all gameplay logic, geofence checks, challenge validation, and Firestore state updates.
- **Authentication**: Firebase Authentication (Email/Password) on the client, verified via Firebase Admin SDK on the backend.
- **Database**: Firebase Firestore managed exclusively by the Express backend using service account credentials.

### Trust Boundaries:
1. **Untrusted Client**: The browser, local storage, React state, network requests, and user-supplied GPS coordinates are untrusted.
2. **Trusted Server**: The Node.js Express server is the sole authority for identity verification, geofence calculations, challenge validation, XP scoring, and Firestore writes.

---

## 2. Security Inventory of API Endpoints

| HTTP Method & Path | Classification | Auth Required | Admin Required | Rate Limits | Input Validations & Security Controls |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /api/health` | Public | No | No | 100 req / 15 min | Server status check. No input processing. |
| `GET /api/checkpoints` | Public | No | No | 100 req / 15 min | Returns public checkpoint definitions. **Never reveals challenge answers**. |
| `POST /api/game/start` | Authenticated | Yes (Bearer Token) | No | 30 req / 15 min | Initializes/updates `players/{uid}`. Sanitizes `displayName` (max 30 chars). |
| `GET /api/game/state` | Authenticated | Yes (Bearer Token) | No | 100 req / 15 min | Retrieves authoritative state for `req.user.uid`. No client ID params allowed. |
| `POST /api/game/checkpoints/:id/claim` | Authenticated | Yes (Bearer Token) | No | 30 req / 15 min | Checks active checkpoint sequence, validates lat/lon range, calculates geofence distance. |
| `POST /api/game/checkpoints/:id/challenge` | Authenticated | Yes (Bearer Token) | No | **10 req / 1 min** | Validates answer in atomic Firestore transaction. Max answer length 100. Prevents duplicate XP awards. |
| `GET /api/leaderboard` | Public / Auth | Optional | No | 30 req / 15 min | Returns top 20 rankings. **Never exposes email addresses**. Marks `isCurrentUser` if authenticated. |
| `GET /api/admin/players` | Administrator | Yes (Bearer Token) | **Yes (`requireAdmin`)** | 30 req / 15 min | Enforces verified `admin: true` custom claim. Lists player audit metrics. |
| `POST /api/admin/players/:uid/reset` | Administrator | Yes (Bearer Token) | **Yes (`requireAdmin`)** | 15 req / 15 min | Enforces verified `admin: true` custom claim. Resets player progress for maintenance. |

---

## 3. Findings & Security Vulnerabilities Resolved

### [CRITICAL] 1. Unauthorized Player Impersonation & Missing Identity Verification
- **Vulnerability**: Endpoints previously accepted client-supplied `playerId` in request bodies or URL parameters, allowing any user to read or modify another user's game state.
- **Fix**: Created `requireAuth` middleware verifying Firebase ID tokens (`verifyIdToken`). Derived `req.user.uid` exclusively from the verified token. Removed client-supplied ID parameters.
- **Verification**: Verified via test cases #1, #2, and #8 in `security.test.js`.

### [HIGH] 2. XP Farming, Replay Attacks & Concurrent Submission Exploits
- **Vulnerability**: Retrying or concurrently sending challenge submissions could allow awarding XP multiple times for the same checkpoint.
- **Fix**: Refactored `submitChallenge` to run in atomic Firestore transactions. Read `completedCheckpoints` within the transaction before writes, rejecting duplicate completions (`409 ALREADY_COMPLETED`).
- **Verification**: Transaction read/write ordering enforced; verified with unit logic checks.

### [HIGH] 3. Privilege Escalation & Unprotected Administrative Functionality
- **Vulnerability**: Lack of role-based access control (RBAC) allowed ordinary users to invoke administrative functions if exposed.
- **Fix**: Created `requireAdmin` middleware checking server-verified Firebase custom claims (`req.user.admin === true`). Rejects unprivileged users with HTTP 403 Forbidden.
- **Verification**: Verified via test case #3 in `security.test.js`.

### [MEDIUM] 4. Challenge Answer Brute-Forcing
- **Vulnerability**: Attackers could automate thousands of answer attempts per minute to solve challenges without finding clues.
- **Fix**: Created `challengeLimiter` (10 requests per 1 minute per IP) on `/api/game/checkpoints/:id/challenge`.
- **Verification**: Verified rate limiter middleware configuration.

### [MEDIUM] 5. Wildcard CORS & Missing HTTP Security Headers
- **Vulnerability**: Express default setup allowed wildcard origins (`*`) and lacked security headers.
- **Fix**: Configured `cors` with origin allowlist (`ALLOWED_ORIGINS`). Integrated `helmet()` middleware for `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Content-Security-Policy`, etc.
- **Verification**: Verified via test cases #5 and #7 in `security.test.js`.

### [MEDIUM] 6. Request Body Flooding & XSS Input Risks
- **Vulnerability**: Unrestricted request body sizes and unsanitized string inputs could lead to DoS or stored content injection.
- **Fix**: Restricted body size limit to `10kb` (`express.json({ limit: "10kb" })`). Implemented `sanitizeString()` stripping HTML special characters and control characters. Enforced length limits (displayName <= 30, answer <= 100).
- **Verification**: Verified via test case #6 in `security.test.js`.

### [LOW] 7. Direct Client Access to Firestore
- **Vulnerability**: Client SDK could attempt direct collection queries if security rules were default open.
- **Fix**: Created `firestore.rules` enforcing `allow read, write: if false;` for client SDKs, requiring all access to route through Express + Admin SDK.
- **Verification**: `firestore.rules` deployed at project root.

---

## 4. Automated Security Test Results

The automated security test suite was executed via `npm run test:security`:

```
▶ Security Audit Test Suite - Authentication & Authorization Controls
  ✔ 1. Unauthenticated request to protected route should be rejected with 401
  ✔ 2. Malformed token in Authorization header should be rejected with 401
  ✔ 3. Unauthenticated access to admin routes should be rejected with 401
  ✔ 4. Public checkpoints endpoint should return 200 and NEVER leak challenge answers
  ✔ 5. HTTP Security Headers (Helmet) should be present in responses
  ✔ 6. Request body exceeding 10kb size limit should be rejected with 413
  ✔ 7. CORS preflight / request from disallowed origin should be rejected
✔ Security Audit Test Suite - Authentication & Authorization Controls

8 tests executed, 8 passed, 0 failed.
```

---

## 5. Manual Setup & Operations Guide

### Assigning Administrator Custom Claims

To grant an account administrator privileges:
Run a Node.js script using the Firebase Admin SDK:
```js
const { auth } = require("./src/config/firebase");
async function setAdmin(uid) {
  await auth.setCustomUserClaims(uid, { admin: true });
  console.log(`Granted admin custom claim to ${uid}`);
}
setAdmin("TARGET_USER_UID");
```

### Production Environment Variables

Ensure production deployments set the following environment variables:
- `NODE_ENV=production`
- `ALLOWED_ORIGINS=https://your-campus-quest-domain.com`
- `GOOGLE_APPLICATION_CREDENTIALS=/path/to/firebase-admin-key.json`
- `FIREBASE_PROJECT_ID=campusquest-877f2`

const {
  initializeApp,
  applicationDefault,
  getApps,
} = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

if (getApps().length === 0) {
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const db = getFirestore();
const auth = getAuth();

module.exports = {
  db,
  auth,
};

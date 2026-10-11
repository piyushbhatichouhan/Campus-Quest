require("dotenv").config();

const { db } = require("./firebase");

async function testFirestore() {
  try {
    await db.collection("_system").doc("connection-test").set({
      status: "connected",
      checkedAt: new Date(),
    });

    console.log("Firebase Admin initialized successfully.");
    console.log("Firestore write test succeeded.");

    await db.collection("_system").doc("connection-test").delete();
    console.log("Temporary test document deleted.");
  } catch (error) {
    console.error("Firebase connection test failed:");
    console.error(error.message);
    process.exitCode = 1;
  }
}

testFirestore();

const { db } = require("../config/firebase");
const checkpoints = require("../data/checkpoints");
const { sanitizeString, isValidCoordinate } = require("../middleware/security");

const players = db.collection("players");

class GameError extends Error {
  constructor(message, status = 400, code = "GAME_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getCheckpointState(index) {
  const checkpoint = checkpoints[index];

  if (!checkpoint) return null;

  // Never send the correct answer to the browser.
  const { challenge, rewardItem, ...publicCheckpoint } = checkpoint;

  return {
    ...publicCheckpoint,
    challenge: {
      type: challenge.type,
      question: challenge.question,
      ...(challenge.options ? { options: challenge.options } : {}),
    },
    rewardItem: rewardItem || null,
  };
}

function distanceInMeters(lat1, lon1, lat2, lon2) {
  const rad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;

  return (
    6371000 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)))
  );
}

function validateUid(uid) {
  if (typeof uid !== "string" || !uid.trim() || uid.length > 128) {
    throw new GameError("A valid user UID is required.", 400, "INVALID_UID");
  }
}

async function startGame(user, customDisplayName) {
  const uid = user.uid;
  validateUid(uid);

  const rawName =
    customDisplayName ||
    user.name ||
    user.displayName ||
    (user.email ? user.email.split("@")[0] : "Explorer");

  const displayName = sanitizeString(rawName, 30) || "Explorer";

  const ref = players.doc(uid);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists) {
      transaction.set(ref, {
        uid,
        displayName,
        email: user.email || "",
        score: 0,
        currentCheckpointIndex: 0,
        claimedCheckpointId: null,
        completedCheckpoints: [],
        inventory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else if (customDisplayName && snapshot.data().displayName !== displayName) {
      transaction.update(ref, {
        displayName,
        updatedAt: new Date(),
      });
    }
  });

  return getGameState(uid);
}

async function getGameState(uid) {
  validateUid(uid);

  const snapshot = await players.doc(uid).get();

  if (!snapshot.exists) {
    throw new GameError("Game state not found for this account.", 404, "GAME_NOT_FOUND");
  }

  const player = snapshot.data();
  const index = player.currentCheckpointIndex || 0;

  // Calculate player rank dynamically
  let rank = 1;
  try {
    const higherPlayers = await players.where("score", ">", player.score || 0).get();
    rank = higherPlayers.size + 1;
  } catch (err) {
    // Fallback if index query fails
  }

  return {
    uid,
    displayName: player.displayName || "Explorer",
    score: player.score || 0,
    completedCheckpoints: player.completedCheckpoints || [],
    claimedCheckpointId: player.claimedCheckpointId || null,
    currentCheckpoint: getCheckpointState(index),
    currentCheckpointIndex: index,
    gameCompleted: index >= checkpoints.length,
    inventory: player.inventory || [],
    rank,
  };
}

async function claimCheckpoint(uid, checkpointId, latitude, longitude) {
  validateUid(uid);

  if (!isValidCoordinate(latitude, longitude)) {
    throw new GameError("Valid latitude and longitude are required.", 400, "INVALID_COORDINATES");
  }

  const sanitizedCheckpointId = sanitizeString(checkpointId, 50);
  const checkpoint = checkpoints.find((item) => item.id === sanitizedCheckpointId);

  if (!checkpoint) {
    throw new GameError("Checkpoint not found.", 404, "NOT_FOUND");
  }

  const distance = distanceInMeters(
    latitude,
    longitude,
    checkpoint.latitude,
    checkpoint.longitude,
  );

  if (distance > checkpoint.radius) {
    throw new GameError(
      `You are outside the checkpoint radius (${Math.round(distance)} m away).`,
      400,
      "OUTSIDE_GEOFENCE",
    );
  }

  const ref = players.doc(uid);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists) {
      throw new GameError("Start the game first.", 404, "GAME_NOT_STARTED");
    }

    const player = snapshot.data();
    const active = checkpoints[player.currentCheckpointIndex || 0];

    if (!active || active.id !== sanitizedCheckpointId) {
      throw new GameError(
        "This is not your active checkpoint.",
        409,
        "CHECKPOINT_NOT_ACTIVE",
      );
    }

    if ((player.completedCheckpoints || []).includes(sanitizedCheckpointId)) {
      throw new GameError("Checkpoint already completed.", 409, "ALREADY_COMPLETED");
    }

    if (player.claimedCheckpointId === sanitizedCheckpointId) {
      return { claimed: true, alreadyClaimed: true };
    }

    transaction.update(ref, {
      claimedCheckpointId: sanitizedCheckpointId,
      updatedAt: new Date(),
    });

    return { claimed: true, checkpointId: sanitizedCheckpointId };
  });
}

async function submitChallenge(uid, checkpointId, answer) {
  validateUid(uid);

  const sanitizedCheckpointId = sanitizeString(checkpointId, 50);
  const sanitizedAnswer = sanitizeString(answer, 100);

  if (!sanitizedAnswer) {
    throw new GameError("An answer is required.", 400, "INVALID_ANSWER");
  }

  const ref = players.doc(uid);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists) {
      throw new GameError("Start the game first.", 404, "GAME_NOT_STARTED");
    }

    const player = snapshot.data();
    const completedList = player.completedCheckpoints || [];

    if (completedList.includes(sanitizedCheckpointId)) {
      throw new GameError("Checkpoint already completed.", 409, "ALREADY_COMPLETED");
    }

    const checkpoint = checkpoints[player.currentCheckpointIndex || 0];

    if (!checkpoint || checkpoint.id !== sanitizedCheckpointId) {
      throw new GameError("This is not your active checkpoint.", 409, "NOT_ACTIVE_CHECKPOINT");
    }

    if (player.claimedCheckpointId !== sanitizedCheckpointId) {
      throw new GameError(
        "Claim the checkpoint before solving its challenge.",
        409,
        "NOT_CLAIMED",
      );
    }

    const normalize = (value) =>
      String(value)
        .trim()
        .toLowerCase()
        .replace(/[.!?]+$/g, "");

    if (normalize(sanitizedAnswer) !== normalize(checkpoint.challenge.answer)) {
      return { success: false, message: "Incorrect answer. Try again." };
    }

    const updatedCompletedCheckpoints = [...completedList, sanitizedCheckpointId];
    const score = (player.score || 0) + checkpoint.points;
    const nextIndex = (player.currentCheckpointIndex || 0) + 1;

    let inventory = player.inventory || [];
    if (checkpoint.rewardItem) {
      const alreadyHas = inventory.some((i) => i.id === checkpoint.rewardItem.id);
      if (!alreadyHas) {
        inventory = [
          ...inventory,
          {
            ...checkpoint.rewardItem,
            earnedAt: new Date().toISOString(),
          },
        ];
      }
    }

    transaction.update(ref, {
      score,
      completedCheckpoints: updatedCompletedCheckpoints,
      currentCheckpointIndex: nextIndex,
      claimedCheckpointId: null,
      inventory,
      updatedAt: new Date(),
    });

    return {
      success: true,
      pointsAwarded: checkpoint.points,
      rewardItem: checkpoint.rewardItem || null,
      score,
      completedCheckpoints: updatedCompletedCheckpoints,
      inventory,
      nextCheckpoint: getCheckpointState(nextIndex),
      gameCompleted: nextIndex >= checkpoints.length,
    };
  });
}

async function getLeaderboard(currentUid = null) {
  const snapshot = await players.orderBy("score", "desc").limit(20).get();

  return snapshot.docs.map((doc, index) => {
    const data = doc.data();
    return {
      rank: index + 1,
      uid: doc.id,
      displayName: sanitizeString(data.displayName || `Player ${index + 1}`, 30),
      score: data.score || 0,
      completedCount: (data.completedCheckpoints || []).length,
      isCurrentUser: currentUid ? doc.id === currentUid : false,
    };
  });
}

function getCheckpoints() {
  return checkpoints.map((_, index) => getCheckpointState(index));
}

async function adminGetPlayersList() {
  const snapshot = await players.orderBy("createdAt", "desc").limit(50).get();
  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    displayName: doc.data().displayName,
    score: doc.data().score,
    completedCount: (doc.data().completedCheckpoints || []).length,
    createdAt: doc.data().createdAt,
  }));
}

async function adminResetPlayerProgress(targetUid) {
  validateUid(targetUid);
  const ref = players.doc(targetUid);
  await ref.update({
    score: 0,
    currentCheckpointIndex: 0,
    claimedCheckpointId: null,
    completedCheckpoints: [],
    inventory: [],
    updatedAt: new Date(),
  });
  return { success: true, message: `Reset progress for player ${targetUid}` };
}

module.exports = {
  startGame,
  getGameState,
  claimCheckpoint,
  submitChallenge,
  getLeaderboard,
  getCheckpoints,
  adminGetPlayersList,
  adminResetPlayerProgress,
  GameError,
};

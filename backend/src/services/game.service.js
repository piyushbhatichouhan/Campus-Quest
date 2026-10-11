const { db } = require("../config/firebase");
const checkpoints = require("../data/checkpoints");
const { sanitizeString, isValidCoordinate } = require("../middleware/security");

const teams = db.collection("teams");
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

/**
 * Resolves the team and player document for a given UID.
 */
async function resolvePlayerTeam(uid) {
  validateUid(uid);
  const playerSnap = await players.doc(uid).get();

  if (!playerSnap.exists || !playerSnap.data().teamId) {
    throw new GameError(
      "You are not currently part of a team. Please join or create a team first.",
      404,
      "NO_TEAM",
    );
  }

  const playerData = playerSnap.data();
  const teamSnap = await teams.doc(playerData.teamId).get();

  if (!teamSnap.exists) {
    throw new GameError("Your team was not found.", 404, "TEAM_NOT_FOUND");
  }

  return {
    player: playerData,
    team: teamSnap.data(),
    teamRef: teams.doc(playerData.teamId),
  };
}

async function startGame(user, customDisplayName) {
  const uid = user.uid;
  validateUid(uid);

  // If user already has a team, return the game state
  const playerDoc = await players.doc(uid).get();
  if (playerDoc.exists && playerDoc.data().teamId) {
    return getGameState(uid);
  }

  // Fallback for single-player backwards compatibility if needed
  const rawName =
    customDisplayName ||
    user.name ||
    user.displayName ||
    (user.email ? user.email.split("@")[0] : "Explorer");

  const displayName = sanitizeString(rawName, 30) || "Explorer";

  // Create or update player document
  await players.doc(uid).set(
    {
      uid,
      displayName,
      email: user.email || "",
      updatedAt: new Date(),
    },
    { merge: true },
  );

  return {
    uid,
    displayName,
    needsTeam: true,
    score: 0,
    completedCheckpoints: [],
    claimedCheckpointId: null,
    currentCheckpoint: getCheckpointState(0),
    currentCheckpointIndex: 0,
    gameCompleted: false,
    inventory: [],
    rank: 1,
  };
}

async function getGameState(uid) {
  validateUid(uid);

  const playerSnap = await players.doc(uid).get();
  if (!playerSnap.exists) {
    throw new GameError("Game state not found for this account.", 404, "GAME_NOT_FOUND");
  }

  const playerData = playerSnap.data();

  // If player is mapped to a team, retrieve shared team game state
  if (playerData.teamId) {
    const teamSnap = await teams.doc(playerData.teamId).get();
    if (teamSnap.exists) {
      const team = teamSnap.data();
      const index = team.currentCheckpointIndex || 0;

      // Calculate dynamic team rank
      let rank = 1;
      try {
        const higherTeams = await teams
          .where("score", ">", team.score || 0)
          .get();
        rank = higherTeams.size + 1;
      } catch (err) {
        // Fallback rank calculation
      }

      return {
        uid,
        teamId: team.id || playerData.teamId,
        teamName: team.name,
        displayName: playerData.displayName || "Explorer",
        role: playerData.role || "member",
        memberCount: team.memberCount || 1,
        maxMembers: team.maxMembers || 4,
        status: team.status, // waiting | active | completed
        score: team.score || 0,
        completedCheckpoints: team.completedCheckpoints || [],
        claimedCheckpointId: team.claimedCheckpointId || null,
        currentCheckpoint: getCheckpointState(index),
        currentCheckpointIndex: index,
        gameCompleted: index >= checkpoints.length,
        inventory: team.inventory || [],
        rank,
        totalCheckpoints: checkpoints.length,
      };
    }
  }

  // Fallback for players without team yet
  return {
    uid,
    displayName: playerData.displayName || "Explorer",
    score: playerData.score || 0,
    completedCheckpoints: playerData.completedCheckpoints || [],
    claimedCheckpointId: playerData.claimedCheckpointId || null,
    currentCheckpoint: getCheckpointState(playerData.currentCheckpointIndex || 0),
    currentCheckpointIndex: playerData.currentCheckpointIndex || 0,
    gameCompleted: (playerData.currentCheckpointIndex || 0) >= checkpoints.length,
    inventory: playerData.inventory || [],
    rank: 1,
    needsTeam: true,
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

  const { player, teamRef } = await resolvePlayerTeam(uid);

  return db.runTransaction(async (transaction) => {
    const teamSnap = await transaction.get(teamRef);

    if (!teamSnap.exists) {
      throw new GameError("Team game state not found.", 404, "TEAM_NOT_FOUND");
    }

    const team = teamSnap.data();

    if (team.status === "waiting") {
      throw new GameError(
        "The adventure has not started yet. Please wait in the lobby.",
        409,
        "TEAM_NOT_STARTED",
      );
    }

    const active = checkpoints[team.currentCheckpointIndex || 0];

    if (!active || active.id !== sanitizedCheckpointId) {
      throw new GameError(
        "This is not your active checkpoint.",
        409,
        "CHECKPOINT_NOT_ACTIVE",
      );
    }

    if ((team.completedCheckpoints || []).includes(sanitizedCheckpointId)) {
      throw new GameError("Checkpoint already completed.", 409, "ALREADY_COMPLETED");
    }

    // Idempotent check
    if (team.claimedCheckpointId === sanitizedCheckpointId) {
      return { claimed: true, alreadyClaimed: true };
    }

    const now = new Date();

    transaction.update(teamRef, {
      claimedCheckpointId: sanitizedCheckpointId,
      updatedAt: now,
    });

    // Record team activity event
    const eventRef = teamRef.collection("events").doc();
    transaction.set(eventRef, {
      id: eventRef.id,
      type: "checkpoint_claimed",
      actorUid: uid,
      actorName: player.displayName || "Teammate",
      checkpointId: sanitizedCheckpointId,
      checkpointName: checkpoint.name,
      message: `${player.displayName || "A teammate"} claimed the ${checkpoint.name} checkpoint!`,
      createdAt: now,
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

  const { player, teamRef } = await resolvePlayerTeam(uid);

  return db.runTransaction(async (transaction) => {
    const teamSnap = await transaction.get(teamRef);

    if (!teamSnap.exists) {
      throw new GameError("Team game state not found.", 404, "TEAM_NOT_FOUND");
    }

    const team = teamSnap.data();

    if (team.status === "waiting") {
      throw new GameError(
        "The adventure has not started yet.",
        409,
        "TEAM_NOT_STARTED",
      );
    }

    const completedList = team.completedCheckpoints || [];

    if (completedList.includes(sanitizedCheckpointId)) {
      throw new GameError("Checkpoint already completed.", 409, "ALREADY_COMPLETED");
    }

    const checkpoint = checkpoints[team.currentCheckpointIndex || 0];

    if (!checkpoint || checkpoint.id !== sanitizedCheckpointId) {
      throw new GameError("This is not your active checkpoint.", 409, "NOT_ACTIVE_CHECKPOINT");
    }

    if (team.claimedCheckpointId !== sanitizedCheckpointId) {
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
    const score = (team.score || 0) + checkpoint.points;
    const nextIndex = (team.currentCheckpointIndex || 0) + 1;
    const now = new Date();

    let inventory = team.inventory || [];
    if (checkpoint.rewardItem) {
      const alreadyHas = inventory.some((i) => i.id === checkpoint.rewardItem.id);
      if (!alreadyHas) {
        inventory = [
          ...inventory,
          {
            ...checkpoint.rewardItem,
            earnedAt: now.toISOString(),
          },
        ];
      }
    }

    const isAdventureCompleted = nextIndex >= checkpoints.length;

    transaction.update(teamRef, {
      score,
      completedCheckpoints: updatedCompletedCheckpoints,
      currentCheckpointIndex: nextIndex,
      claimedCheckpointId: null,
      inventory,
      lastScoreUpdatedAt: now,
      updatedAt: now,
      ...(isAdventureCompleted
        ? { status: "completed", completedAt: now }
        : {}),
    });

    // 1. Challenge completed event
    const challengeEventRef = teamRef.collection("events").doc();
    transaction.set(challengeEventRef, {
      id: challengeEventRef.id,
      type: "challenge_completed",
      actorUid: uid,
      actorName: player.displayName || "Teammate",
      checkpointId: sanitizedCheckpointId,
      checkpointName: checkpoint.name,
      points: checkpoint.points,
      message: `${player.displayName || "A teammate"} completed the challenge! +${checkpoint.points} XP earned`,
      createdAt: now,
    });

    // 2. Next checkpoint unlocked or adventure completed event
    if (isAdventureCompleted) {
      const completedEventRef = teamRef.collection("events").doc();
      transaction.set(completedEventRef, {
        id: completedEventRef.id,
        type: "adventure_completed",
        actorUid: uid,
        actorName: player.displayName || "Teammate",
        message: "Congratulations! Your team has completed the Campus Quest!",
        createdAt: new Date(now.getTime() + 10),
      });
    } else {
      const nextCheckpoint = checkpoints[nextIndex];
      const unlockEventRef = teamRef.collection("events").doc();
      transaction.set(unlockEventRef, {
        id: unlockEventRef.id,
        type: "checkpoint_unlocked",
        checkpointId: nextCheckpoint.id,
        checkpointName: nextCheckpoint.name,
        message: `New checkpoint unlocked: ${nextCheckpoint.name}!`,
        createdAt: new Date(now.getTime() + 10),
      });
    }

    return {
      success: true,
      pointsAwarded: checkpoint.points,
      rewardItem: checkpoint.rewardItem || null,
      score,
      completedCheckpoints: updatedCompletedCheckpoints,
      currentCheckpointIndex: nextIndex,
      inventory,
      nextCheckpoint: getCheckpointState(nextIndex),
      gameCompleted: isAdventureCompleted,
    };
  });
}

/**
 * Team-based Leaderboard with deterministic ranking rules:
 * 1. Highest total XP
 * 2. Most completed checkpoints
 * 3. Earliest timestamp at which tied score/progress was achieved
 * 4. Stable team ID ordering
 */
async function getLeaderboard(currentUid = null) {
  let currentTeamId = null;

  if (currentUid) {
    try {
      const playerSnap = await players.doc(currentUid).get();
      if (playerSnap.exists && playerSnap.data().teamId) {
        currentTeamId = playerSnap.data().teamId;
      }
    } catch {
      // Ignore lookup failure
    }
  }

  // Fetch all teams
  const snapshot = await teams.limit(100).get();

  let teamList = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      teamId: doc.id,
      name: sanitizeString(data.name || "Explorer Team", 30),
      displayName: sanitizeString(data.name || "Explorer Team", 30), // backward compatibility for tests
      score: data.score || 0,
      completedCount: (data.completedCheckpoints || []).length,
      totalCheckpoints: checkpoints.length,
      memberCount: data.memberCount || 1,
      lastScoreUpdatedAt:
        data.lastScoreUpdatedAt?.toMillis?.() ||
        data.createdAt?.toMillis?.() ||
        0,
      isCurrentTeam: currentTeamId ? doc.id === currentTeamId : false,
      isCurrentUser: currentTeamId ? doc.id === currentTeamId : false,
    };
  });

  // If no teams exist yet, check players collection as backward compatibility fallback
  if (teamList.length === 0) {
    const playerSnapshot = await players.limit(50).get();
    teamList = playerSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        teamId: doc.id,
        name: sanitizeString(data.displayName || "Explorer", 30),
        displayName: sanitizeString(data.displayName || "Explorer", 30),
        score: data.score || 0,
        completedCount: (data.completedCheckpoints || []).length,
        totalCheckpoints: checkpoints.length,
        memberCount: 1,
        lastScoreUpdatedAt: data.updatedAt?.toMillis?.() || 0,
        isCurrentTeam: currentUid ? doc.id === currentUid : false,
        isCurrentUser: currentUid ? doc.id === currentUid : false,
      };
    });
  }

  // Sort deterministically
  teamList.sort((a, b) => {
    // 1. Highest XP
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // 2. Most completed checkpoints
    if (b.completedCount !== a.completedCount) {
      return b.completedCount - a.completedCount;
    }
    // 3. Earliest timestamp of achieving score
    if (a.lastScoreUpdatedAt !== b.lastScoreUpdatedAt) {
      return a.lastScoreUpdatedAt - b.lastScoreUpdatedAt;
    }
    // 4. Stable team ID ordering
    return a.teamId.localeCompare(b.teamId);
  });

  // Assign ranks
  return teamList.map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));
}

function getCheckpoints() {
  return checkpoints.map((_, index) => getCheckpointState(index));
}

async function adminGetPlayersList() {
  const snapshot = await teams.orderBy("createdAt", "desc").limit(50).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      teamId: doc.id,
      name: data.name,
      displayName: data.name,
      score: data.score || 0,
      completedCount: (data.completedCheckpoints || []).length,
      memberCount: data.memberCount || 1,
      status: data.status,
      createdAt: data.createdAt,
    };
  });
}

async function adminResetPlayerProgress(targetTeamId) {
  validateUid(targetTeamId);
  const ref = teams.doc(targetTeamId);
  await ref.update({
    score: 0,
    currentCheckpointIndex: 0,
    claimedCheckpointId: null,
    completedCheckpoints: [],
    inventory: [],
    status: "waiting",
    lastScoreUpdatedAt: new Date(),
    updatedAt: new Date(),
  });
  return { success: true, message: `Reset progress for team ${targetTeamId}` };
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

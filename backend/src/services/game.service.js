const { db } = require("../config/firebase");
const checkpoints = require("../data/checkpoints");
const { sanitizeString, isValidCoordinate } = require("../middleware/security");
const { getOrCreateEventDoc } = require("./event.service");

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

  const rawName =
    customDisplayName ||
    user.name ||
    user.displayName ||
    (user.email ? user.email.split("@")[0] : "Explorer");

  const displayName = sanitizeString(rawName, 30) || "Explorer";

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
    currentCheckpoint: null,
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
  const { eventData } = await getOrCreateEventDoc();
  const isEventWaiting = eventData.status === "waiting";
  const isEventStoppedOrDone = eventData.status === "stopped" || eventData.status === "completed";

  // If player is mapped to a team, retrieve shared team game state
  if (playerData.teamId) {
    const teamSnap = await teams.doc(playerData.teamId).get();
    if (teamSnap.exists) {
      const team = teamSnap.data();
      const index = team.currentCheckpointIndex || 0;

      // Calculate dynamic team rank from authoritative leaderboard
      let rank = 1;
      try {
        const lb = await getLeaderboard(uid);
        const myEntry = lb.find((item) => item.teamId === (team.id || playerData.teamId));
        if (myEntry) {
          rank = myEntry.rank;
        }
      } catch (err) {
        // Fallback
      }

      // Checkpoint clue is HIDDEN if event is still waiting!
      const currentCheckpoint = isEventWaiting
        ? null
        : getCheckpointState(index);

      const currentClue = isEventWaiting || index >= checkpoints.length
        ? null
        : index === 0
          ? checkpoints[0]?.challenge?.question || null
          : checkpoints[index - 1]?.nextClue || checkpoints[index]?.challenge?.question || null;

      const completedIds = team.completedCheckpoints || [];
      const checkpointProgress = team.checkpointProgress || {};
      const completedJourney = checkpoints
        .filter((cp) => completedIds.includes(cp.id))
        .map((cp) => {
          const prog = checkpointProgress[cp.id] || {};
          return {
            id: cp.id,
            order: cp.order,
            name: cp.name,
            points: cp.points,
            claimedAt: prog.claimedAt?.toDate ? prog.claimedAt.toDate().toISOString() : prog.claimedAt || null,
            completedAt: prog.completedAt?.toDate ? prog.completedAt.toDate().toISOString() : prog.completedAt || null,
          };
        });

      return {
        uid,
        teamId: team.id || playerData.teamId,
        teamName: team.name,
        displayName: playerData.displayName || "Explorer",
        role: playerData.role || "member",
        memberCount: team.memberCount || 1,
        maxMembers: team.maxMembers || 4,
        status: isEventWaiting ? "waiting" : isEventStoppedOrDone ? eventData.status : team.status,
        eventStatus: eventData.status,
        eventStartedAt: eventData.startedAt?.toDate ? eventData.startedAt.toDate().toISOString() : eventData.startedAt,
        eventStoppedAt: eventData.stoppedAt?.toDate ? eventData.stoppedAt.toDate().toISOString() : eventData.stoppedAt || null,
        eventFinalizedAt: eventData.finalizedAt?.toDate ? eventData.finalizedAt.toDate().toISOString() : eventData.finalizedAt || null,
        score: team.score || 0,
        completedCheckpoints: completedIds,
        completedJourney,
        claimedCheckpointId: isEventWaiting ? null : (team.claimedCheckpointId || null),
        currentCheckpoint: currentCheckpoint
          ? { ...currentCheckpoint, mysteryClue: currentClue }
          : null,
        currentClue,
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
    claimedCheckpointId: null,
    currentCheckpoint: null,
    currentClue: null,
    currentCheckpointIndex: 0,
    gameCompleted: false,
    inventory: [],
    rank: 1,
    needsTeam: true,
    eventStatus: eventData.status,
    eventStartedAt: eventData.startedAt?.toDate ? eventData.startedAt.toDate().toISOString() : eventData.startedAt,
    eventStoppedAt: eventData.stoppedAt?.toDate ? eventData.stoppedAt.toDate().toISOString() : eventData.stoppedAt || null,
    eventFinalizedAt: eventData.finalizedAt?.toDate ? eventData.finalizedAt.toDate().toISOString() : eventData.finalizedAt || null,
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
    // 1. Authoritative global event state check inside the transaction
    const { eventData } = await getOrCreateEventDoc(transaction);

    if (eventData.status !== "active") {
      throw new GameError(
        `Checkpoint claims are disabled because the competition is currently '${eventData.status}'.`,
        403,
        "EVENT_NOT_ACTIVE",
      );
    }

    const teamSnap = await transaction.get(teamRef);

    if (!teamSnap.exists) {
      throw new GameError("Team game state not found.", 404, "TEAM_NOT_FOUND");
    }

    const team = teamSnap.data();

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

    // Track checkpoint arrival analytics (preserve original claim timestamp if already set)
    const checkpointProgress = { ...(team.checkpointProgress || {}) };
    checkpointProgress[sanitizedCheckpointId] = {
      claimedAt: checkpointProgress[sanitizedCheckpointId]?.claimedAt || now,
      completedAt: checkpointProgress[sanitizedCheckpointId]?.completedAt || null,
    };

    transaction.update(teamRef, {
      claimedCheckpointId: sanitizedCheckpointId,
      checkpointProgress,
      status: "active",
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
    // 1. Authoritative global event state check inside the transaction
    const { eventData } = await getOrCreateEventDoc(transaction);

    if (eventData.status !== "active") {
      throw new GameError(
        `Challenge submissions are disabled because the competition is currently '${eventData.status}'.`,
        403,
        "EVENT_NOT_ACTIVE",
      );
    }

    const teamSnap = await transaction.get(teamRef);

    if (!teamSnap.exists) {
      throw new GameError("Team game state not found.", 404, "TEAM_NOT_FOUND");
    }

    const team = teamSnap.data();

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

    // Track checkpoint arrival analytics
    const checkpointProgress = { ...(team.checkpointProgress || {}) };
    checkpointProgress[sanitizedCheckpointId] = {
      claimedAt: checkpointProgress[sanitizedCheckpointId]?.claimedAt || now,
      completedAt: now,
    };

    transaction.update(teamRef, {
      score,
      completedCheckpoints: updatedCompletedCheckpoints,
      currentCheckpointIndex: nextIndex,
      claimedCheckpointId: null,
      inventory,
      checkpointProgress,
      lastCheckpointCompletedAt: now,
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
        message: `New mystery clue unlocked!`,
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

function formatTime(timestamp) {
  if (!timestamp) return null;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return null;

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function toTimestampMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  const parsed = new Date(ts).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Player-Facing Race Leaderboard
 *
 * Ranking rules:
 * 1. Completed teams rank above unfinished teams.
 * 2. Completed teams rank by earliest official completion timestamp (completedAt).
 * 3. Unfinished teams rank by number of completed checkpoints.
 * 4. If tied, the team that completed its most recent checkpoint earlier ranks higher.
 * 5. If still tied, use XP.
 * 6. Finally, use stable team ID as a deterministic tie-breaker.
 *
 * Does NOT reveal undiscovered checkpoint names or coordinates!
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

  // Fetch all participating teams
  const snapshot = await teams.limit(100).get();

  let teamList = snapshot.docs.map((doc) => {
    const data = doc.data();
    const completedIds = data.completedCheckpoints || [];
    const completedCount = completedIds.length;
    const isCompleted = completedCount >= checkpoints.length || Boolean(data.completedAt);

    // Derive latest checkpoint completion timestamp from explicit field, checkpointProgress, or lastScoreUpdatedAt
    let latestCpMillis = toTimestampMillis(data.lastCheckpointCompletedAt);
    if (latestCpMillis == null && data.checkpointProgress && completedIds.length > 0) {
      const lastId = completedIds[completedIds.length - 1];
      latestCpMillis = toTimestampMillis(data.checkpointProgress[lastId]?.completedAt);
    }
    if (latestCpMillis == null && completedCount > 0) {
      latestCpMillis = toTimestampMillis(data.lastScoreUpdatedAt);
    }

    const completedAtMillis =
      toTimestampMillis(data.completedAt) ??
      (isCompleted ? latestCpMillis : null);

    const completedAtIso = data.completedAt?.toDate
      ? data.completedAt.toDate().toISOString()
      : typeof data.completedAt === "string"
        ? data.completedAt
        : completedAtMillis
          ? new Date(completedAtMillis).toISOString()
          : null;

    return {
      teamId: doc.id,
      name: sanitizeString(data.name || "Explorer Team", 30),
      displayName: sanitizeString(data.name || "Explorer Team", 30), // backward compatibility for tests
      score: data.score || 0,
      completedCount,
      totalCheckpoints: checkpoints.length,
      progress: `${completedCount}/${checkpoints.length}`,
      memberCount: data.memberCount || 1,
      isCompleted,
      completedAt: completedAtIso,
      completedAtMillis,
      finishedAt: isCompleted
        ? formatTime(data.completedAt || (completedAtMillis ? new Date(completedAtMillis) : data.lastScoreUpdatedAt)) || "—"
        : "—",
      lastScoreUpdatedAtMillis: latestCpMillis ?? Number.MAX_SAFE_INTEGER,
      isCurrentTeam: currentTeamId ? doc.id === currentTeamId : false,
      isCurrentUser: currentTeamId ? doc.id === currentTeamId : false,
    };
  });

  // Backward compatibility fallback if no teams exist
  if (teamList.length === 0) {
    const playerSnapshot = await players.limit(50).get();
    teamList = playerSnapshot.docs.map((doc) => {
      const data = doc.data();
      const completedCount = (data.completedCheckpoints || []).length;
      return {
        teamId: doc.id,
        name: sanitizeString(data.displayName || "Explorer", 30),
        displayName: sanitizeString(data.displayName || "Explorer", 30),
        score: data.score || 0,
        completedCount,
        totalCheckpoints: checkpoints.length,
        progress: `${completedCount}/${checkpoints.length}`,
        memberCount: 1,
        isCompleted: completedCount >= checkpoints.length,
        completedAt: null,
        completedAtMillis: null,
        finishedAt: "—",
        lastScoreUpdatedAtMillis: toTimestampMillis(data.updatedAt) ?? Number.MAX_SAFE_INTEGER,
        isCurrentTeam: currentUid ? doc.id === currentUid : false,
        isCurrentUser: currentUid ? doc.id === currentUid : false,
      };
    });
  }

  // Sort according to Race Leaderboard rules
  teamList.sort((a, b) => {
    // 1. Completed teams rank above unfinished teams
    if (a.isCompleted && !b.isCompleted) return -1;
    if (!a.isCompleted && b.isCompleted) return 1;

    // 2. Completed teams rank by earliest official completion timestamp
    if (a.isCompleted && b.isCompleted) {
      const aTime = a.completedAtMillis ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.completedAtMillis ?? Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) {
        return aTime - bTime; // earliest first
      }
    }

    // 3. Unfinished teams rank by number of completed checkpoints
    if (b.completedCount !== a.completedCount) {
      return b.completedCount - a.completedCount; // higher count first
    }

    // 4. If tied, team that completed most recent checkpoint earlier ranks higher
    if (a.completedCount > 0 && a.lastScoreUpdatedAtMillis !== b.lastScoreUpdatedAtMillis) {
      return a.lastScoreUpdatedAtMillis - b.lastScoreUpdatedAtMillis; // earlier timestamp first
    }

    // 5. If still tied, use XP
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    // 6. Stable team ID tie-breaker
    return String(a.teamId).localeCompare(String(b.teamId));
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
    checkpointProgress: {},
    inventory: [],
    status: "waiting",
    completedAt: null,
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

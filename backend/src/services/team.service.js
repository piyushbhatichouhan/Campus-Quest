const crypto = require("crypto");
const { db } = require("../config/firebase");
const checkpoints = require("../data/checkpoints");
const { sanitizeString } = require("../middleware/security");

const teamsCollection = db.collection("teams");
const playersCollection = db.collection("players");
const teamCodesCollection = db.collection("teamCodes");

class TeamError extends Error {
  constructor(message, status = 400, code = "TEAM_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// 6-character uppercase alphanumeric characters (excluding ambiguous: 0, O, 1, I, L)
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateJoinCode() {
  let result = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    result += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return result;
}

function validateUid(uid) {
  if (typeof uid !== "string" || !uid.trim() || uid.length > 128) {
    throw new TeamError("A valid user UID is required.", 400, "INVALID_UID");
  }
}

/**
 * Creates a new team with the leader as the first member.
 * Idempotent: If user already leads or belongs to a team, returns the existing team.
 */
async function createTeam(user, { teamName, leaderName }) {
  const uid = user.uid;
  validateUid(uid);

  const sanitizedTeamName = sanitizeString(teamName, 30);
  if (!sanitizedTeamName || sanitizedTeamName.length < 2) {
    throw new TeamError(
      "Team name must be between 2 and 30 characters.",
      400,
      "INVALID_TEAM_NAME",
    );
  }

  const rawLeaderName =
    leaderName ||
    user.name ||
    user.displayName ||
    (user.email ? user.email.split("@")[0] : "Leader");
  const sanitizedLeaderName = sanitizeString(rawLeaderName, 30) || "Leader";

  // Check if player already belongs to a team
  const playerDoc = await playersCollection.doc(uid).get();
  if (playerDoc.exists) {
    const existingPlayer = playerDoc.data();
    if (existingPlayer.teamId) {
      const existingTeamDoc = await teamsCollection.doc(existingPlayer.teamId).get();
      if (existingTeamDoc.exists) {
        // Return existing team safely (idempotent)
        const teamData = existingTeamDoc.data();
        const membersSnapshot = await teamsCollection
          .doc(existingPlayer.teamId)
          .collection("members")
          .get();
        const members = membersSnapshot.docs.map((d) => d.data());

        return {
          teamId: existingPlayer.teamId,
          name: teamData.name,
          joinCode: teamData.joinCode,
          leaderUid: teamData.leaderUid,
          status: teamData.status,
          memberCount: teamData.memberCount || members.length,
          maxMembers: teamData.maxMembers || 4,
          role: existingPlayer.role || "leader",
          isLeader: teamData.leaderUid === uid,
          members,
        };
      }
    }
  }

  // Generate unique team ID and atomic join code reservation
  const teamId = `team_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const teamRef = teamsCollection.doc(teamId);
  const playerRef = playersCollection.doc(uid);

  let assignedJoinCode = "";

  // Attempt up to 5 times to reserve a unique join code atomically
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidateCode = generateJoinCode();
    const codeRef = teamCodesCollection.doc(candidateCode);

    try {
      await db.runTransaction(async (transaction) => {
        const codeDoc = await transaction.get(codeRef);
        if (codeDoc.exists) {
          throw new Error("COLLISION");
        }

        // Check if player doc was created concurrently
        const pDoc = await transaction.get(playerRef);
        if (pDoc.exists && pDoc.data().teamId) {
          throw new TeamError(
            "User already belongs to a team.",
            409,
            "ALREADY_IN_TEAM",
          );
        }

        const now = new Date();

        // 1. Reserve join code
        transaction.set(codeRef, {
          teamId,
          createdAt: now,
        });

        // 2. Create team
        transaction.set(teamRef, {
          id: teamId,
          name: sanitizedTeamName,
          joinCode: candidateCode,
          leaderUid: uid,
          leaderName: sanitizedLeaderName,
          status: "waiting", // waiting | active | completed
          maxMembers: 4,
          memberCount: 1,
          score: 0,
          currentCheckpointIndex: 0,
          claimedCheckpointId: null,
          completedCheckpoints: [],
          inventory: [],
          createdAt: now,
          updatedAt: now,
          lastScoreUpdatedAt: now,
        });

        // 3. Create leader membership
        const leaderMemberRef = teamRef.collection("members").doc(uid);
        transaction.set(leaderMemberRef, {
          uid,
          displayName: sanitizedLeaderName,
          role: "leader",
          joinedAt: now,
        });

        // 4. Update player mapping
        transaction.set(
          playerRef,
          {
            uid,
            teamId,
            displayName: sanitizedLeaderName,
            role: "leader",
            email: user.email || "",
            createdAt: now,
            updatedAt: now,
          },
          { merge: true },
        );

        // 5. Add initial event
        const eventRef = teamRef.collection("events").doc();
        transaction.set(eventRef, {
          id: eventRef.id,
          type: "member_joined",
          actorUid: uid,
          actorName: sanitizedLeaderName,
          message: `${sanitizedLeaderName} created the team.`,
          createdAt: now,
        });
      });

      assignedJoinCode = candidateCode;
      break;
    } catch (err) {
      if (err.message === "COLLISION") {
        continue;
      }
      throw err;
    }
  }

  if (!assignedJoinCode) {
    throw new TeamError(
      "Failed to allocate a unique join code. Please try again.",
      500,
      "CODE_GENERATION_FAILED",
    );
  }

  return {
    teamId,
    name: sanitizedTeamName,
    joinCode: assignedJoinCode,
    leaderUid: uid,
    status: "waiting",
    memberCount: 1,
    maxMembers: 4,
    role: "leader",
    isLeader: true,
    members: [
      {
        uid,
        displayName: sanitizedLeaderName,
        role: "leader",
        joinedAt: new Date(),
      },
    ],
  };
}

/**
 * Join an existing team using a 6-character team join code.
 */
async function joinTeam(user, { joinCode, displayName }) {
  const uid = user.uid;
  validateUid(uid);

  const rawCode = (joinCode || "").toString().trim().toUpperCase();
  if (!rawCode || rawCode.length !== 6) {
    throw new TeamError("A valid 6-character team code is required.", 400, "INVALID_CODE");
  }

  const rawName =
    displayName ||
    user.name ||
    user.displayName ||
    (user.email ? user.email.split("@")[0] : "Member");
  const sanitizedName = sanitizeString(rawName, 30) || "Member";

  // Check if player is already in a team
  const playerDoc = await playersCollection.doc(uid).get();
  if (playerDoc.exists) {
    const playerData = playerDoc.data();
    if (playerData.teamId) {
      // Find what team they are in
      const currentTeamDoc = await teamsCollection.doc(playerData.teamId).get();
      if (currentTeamDoc.exists) {
        const currentTeam = currentTeamDoc.data();
        if (currentTeam.joinCode === rawCode) {
          // Idempotent: already in this team
          return getMyTeam(uid);
        }
        throw new TeamError(
          "You already belong to another team. Leave your current team before joining a new one.",
          409,
          "ALREADY_IN_TEAM",
        );
      }
    }
  }

  // Lookup team by join code
  const codeDoc = await teamCodesCollection.doc(rawCode).get();
  if (!codeDoc.exists) {
    throw new TeamError(
      "Invalid team code. Please check the code and try again.",
      404,
      "TEAM_NOT_FOUND",
    );
  }

  const { teamId } = codeDoc.data();
  const teamRef = teamsCollection.doc(teamId);
  const playerRef = playersCollection.doc(uid);
  const memberRef = teamRef.collection("members").doc(uid);

  await db.runTransaction(async (transaction) => {
    const [teamSnap, memberSnap, playerSnap] = await Promise.all([
      transaction.get(teamRef),
      transaction.get(memberRef),
      transaction.get(playerRef),
    ]);

    if (!teamSnap.exists) {
      throw new TeamError("Team does not exist.", 404, "TEAM_NOT_FOUND");
    }

    const team = teamSnap.data();

    // Verify team is accepting members
    if (team.status !== "waiting") {
      throw new TeamError(
        "This team's adventure has already begun. New members cannot join.",
        409,
        "TEAM_LOCKED",
      );
    }

    // Check capacity
    const currentCount = team.memberCount || 1;
    const maxMembers = team.maxMembers || 4;

    if (memberSnap.exists) {
      // Already a member
      return;
    }

    if (currentCount >= maxMembers) {
      throw new TeamError(
        "This team has already reached its maximum capacity of 4 players.",
        409,
        "TEAM_FULL",
      );
    }

    if (playerSnap.exists && playerSnap.data().teamId && playerSnap.data().teamId !== teamId) {
      throw new TeamError(
        "You already belong to another team.",
        409,
        "ALREADY_IN_TEAM",
      );
    }

    const now = new Date();

    // Add member to team subcollection
    transaction.set(memberRef, {
      uid,
      displayName: sanitizedName,
      role: "member",
      joinedAt: now,
    });

    // Update team member count
    transaction.update(teamRef, {
      memberCount: currentCount + 1,
      updatedAt: now,
    });

    // Update player profile
    transaction.set(
      playerRef,
      {
        uid,
        teamId,
        displayName: sanitizedName,
        role: "member",
        email: user.email || "",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    // Record activity event
    const eventRef = teamRef.collection("events").doc();
    transaction.set(eventRef, {
      id: eventRef.id,
      type: "member_joined",
      actorUid: uid,
      actorName: sanitizedName,
      message: `${sanitizedName} joined the team.`,
      createdAt: now,
    });
  });

  return getMyTeam(uid);
}

/**
 * Retrieves the current player's team information, roster, and status.
 */
async function getMyTeam(uid) {
  validateUid(uid);

  const playerDoc = await playersCollection.doc(uid).get();
  if (!playerDoc.exists) {
    return { hasTeam: false };
  }

  const playerData = playerDoc.data();
  if (!playerData.teamId) {
    return { hasTeam: false };
  }

  const teamDoc = await teamsCollection.doc(playerData.teamId).get();
  if (!teamDoc.exists) {
    return { hasTeam: false };
  }

  const team = teamDoc.data();

  // Fetch roster
  const membersSnapshot = await teamsCollection
    .doc(playerData.teamId)
    .collection("members")
    .orderBy("joinedAt", "asc")
    .get();

  const members = membersSnapshot.docs.map((d) => d.data());

  const isLeader = team.leaderUid === uid;
  const currentCheckpointIndex = team.currentCheckpointIndex || 0;

  return {
    hasTeam: true,
    teamId: team.id || playerData.teamId,
    name: team.name,
    joinCode: team.joinCode,
    leaderUid: team.leaderUid,
    status: team.status, // waiting | active | completed
    memberCount: members.length,
    maxMembers: team.maxMembers || 4,
    role: isLeader ? "leader" : playerData.role || "member",
    isLeader,
    displayName: playerData.displayName || "Player",
    members,
    gameState: {
      score: team.score || 0,
      currentCheckpointIndex,
      claimedCheckpointId: team.claimedCheckpointId || null,
      completedCheckpoints: team.completedCheckpoints || [],
      gameCompleted: currentCheckpointIndex >= checkpoints.length,
    },
  };
}

/**
 * Starts the adventure for the team. Leader only.
 */
async function startAdventure(user) {
  const uid = user.uid;
  validateUid(uid);

  const playerDoc = await playersCollection.doc(uid).get();
  if (!playerDoc.exists || !playerDoc.data().teamId) {
    throw new TeamError("Team not found.", 404, "TEAM_NOT_FOUND");
  }

  const teamId = playerDoc.data().teamId;
  const teamRef = teamsCollection.doc(teamId);

  return db.runTransaction(async (transaction) => {
    const teamSnap = await transaction.get(teamRef);
    if (!teamSnap.exists) {
      throw new TeamError("Team not found.", 404, "TEAM_NOT_FOUND");
    }

    const team = teamSnap.data();

    if (team.leaderUid !== uid) {
      throw new TeamError(
        "Only the team leader can start the adventure.",
        403,
        "NOT_LEADER",
      );
    }

    if (team.status === "active") {
      // Idempotent
      return { success: true, status: "active", message: "Adventure already started." };
    }

    if (team.status !== "waiting") {
      throw new TeamError(
        "Cannot start adventure from current state.",
        400,
        "INVALID_STATUS",
      );
    }

    const now = new Date();

    transaction.update(teamRef, {
      status: "active",
      startedAt: now,
      updatedAt: now,
    });

    const eventRef = teamRef.collection("events").doc();
    transaction.set(eventRef, {
      id: eventRef.id,
      type: "game_started",
      actorUid: uid,
      actorName: team.leaderName || "Leader",
      message: "The adventure has begun!",
      createdAt: now,
    });

    return { success: true, status: "active" };
  });
}

/**
 * Leave a team before the game starts.
 */
async function leaveTeam(user) {
  const uid = user.uid;
  validateUid(uid);

  const playerDoc = await playersCollection.doc(uid).get();
  if (!playerDoc.exists || !playerDoc.data().teamId) {
    return { success: true };
  }

  const { teamId, displayName } = playerDoc.data();
  const teamRef = teamsCollection.doc(teamId);
  const playerRef = playersCollection.doc(uid);
  const memberRef = teamRef.collection("members").doc(uid);

  return db.runTransaction(async (transaction) => {
    const teamSnap = await transaction.get(teamRef);
    if (!teamSnap.exists) {
      transaction.delete(playerRef);
      return { success: true };
    }

    const team = teamSnap.data();

    if (team.status !== "waiting") {
      throw new TeamError(
        "Cannot leave the team once the adventure has started.",
        400,
        "CANNOT_LEAVE_ACTIVE_GAME",
      );
    }

    if (team.leaderUid === uid) {
      // Leader is leaving
      if (team.memberCount <= 1) {
        // Disband the team and release joinCode
        if (team.joinCode) {
          transaction.delete(teamCodesCollection.doc(team.joinCode));
        }
        transaction.delete(teamRef);
        transaction.delete(memberRef);
        transaction.delete(playerRef);
        return { success: true, disbanded: true };
      } else {
        throw new TeamError(
          "Leader cannot leave while other members are in the team.",
          400,
          "LEADER_CANNOT_LEAVE",
        );
      }
    }

    // Regular member leaving
    transaction.delete(memberRef);
    transaction.delete(playerRef);
    transaction.update(teamRef, {
      memberCount: Math.max(1, (team.memberCount || 1) - 1),
      updatedAt: new Date(),
    });

    const eventRef = teamRef.collection("events").doc();
    transaction.set(eventRef, {
      id: eventRef.id,
      type: "member_left",
      actorUid: uid,
      actorName: displayName || "Member",
      message: `${displayName || "A member"} left the team.`,
      createdAt: new Date(),
    });

    return { success: true };
  });
}

/**
 * Remove a member from the team before the game starts. Leader only.
 */
async function removeMember(user, targetUid) {
  const uid = user.uid;
  validateUid(uid);
  validateUid(targetUid);

  if (uid === targetUid) {
    throw new TeamError("Leader cannot remove themselves.", 400, "CANNOT_REMOVE_SELF");
  }

  const playerDoc = await playersCollection.doc(uid).get();
  if (!playerDoc.exists || !playerDoc.data().teamId) {
    throw new TeamError("Team not found.", 404, "TEAM_NOT_FOUND");
  }

  const teamId = playerDoc.data().teamId;
  const teamRef = teamsCollection.doc(teamId);
  const targetMemberRef = teamRef.collection("members").doc(targetUid);
  const targetPlayerRef = playersCollection.doc(targetUid);

  return db.runTransaction(async (transaction) => {
    const [teamSnap, memberSnap] = await Promise.all([
      transaction.get(teamRef),
      transaction.get(targetMemberRef),
    ]);

    if (!teamSnap.exists) {
      throw new TeamError("Team not found.", 404, "TEAM_NOT_FOUND");
    }

    const team = teamSnap.data();

    if (team.leaderUid !== uid) {
      throw new TeamError("Only the leader can remove members.", 403, "NOT_LEADER");
    }

    if (team.status !== "waiting") {
      throw new TeamError("Cannot remove members once the adventure has begun.", 400, "GAME_ACTIVE");
    }

    if (!memberSnap.exists) {
      return { success: true };
    }

    const memberData = memberSnap.data();

    transaction.delete(targetMemberRef);
    transaction.delete(targetPlayerRef);
    transaction.update(teamRef, {
      memberCount: Math.max(1, (team.memberCount || 1) - 1),
      updatedAt: new Date(),
    });

    const eventRef = teamRef.collection("events").doc();
    transaction.set(eventRef, {
      id: eventRef.id,
      type: "member_left",
      actorUid: targetUid,
      actorName: memberData.displayName || "Member",
      message: `${memberData.displayName || "A member"} was removed from the team.`,
      createdAt: new Date(),
    });

    return { success: true };
  });
}

/**
 * Retrieve team activity events for multiplayer live notification toasts.
 */
async function getTeamEvents(uid, sinceTimestamp = 0) {
  validateUid(uid);

  const playerDoc = await playersCollection.doc(uid).get();
  if (!playerDoc.exists || !playerDoc.data().teamId) {
    return [];
  }

  const teamId = playerDoc.data().teamId;
  const eventsCollection = teamsCollection.doc(teamId).collection("events");

  let query = eventsCollection.orderBy("createdAt", "asc").limit(50);

  if (sinceTimestamp) {
    const sinceDate = new Date(
      typeof sinceTimestamp === "string" ? sinceTimestamp : Number(sinceTimestamp),
    );
    if (!isNaN(sinceDate.getTime())) {
      query = eventsCollection
        .where("createdAt", ">", sinceDate)
        .orderBy("createdAt", "asc")
        .limit(50);
    }
  }

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      type: data.type,
      actorUid: data.actorUid,
      actorName: data.actorName,
      checkpointId: data.checkpointId || null,
      checkpointName: data.checkpointName || null,
      points: data.points || null,
      message: data.message || "",
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
    };
  });
}

module.exports = {
  createTeam,
  joinTeam,
  getMyTeam,
  startAdventure,
  leaveTeam,
  removeMember,
  getTeamEvents,
  TeamError,
};

const { db } = require("../config/firebase");
const checkpoints = require("../data/checkpoints");

const eventsCollection = db.collection("events");
const teamsCollection = db.collection("teams");
const playersCollection = db.collection("players");

const MAIN_EVENT_ID = "main";

class EventError extends Error {
  constructor(message, status = 400, code = "EVENT_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Retrieves or initializes the single authoritative main event document.
 */
async function getOrCreateEventDoc(transaction = null) {
  const eventRef = eventsCollection.doc(MAIN_EVENT_ID);

  if (transaction) {
    const snap = await transaction.get(eventRef);
    if (!snap.exists) {
      const initial = {
        id: MAIN_EVENT_ID,
        status: "waiting", // waiting | active | stopped | completed
        startedAt: null,
        stoppedAt: null,
        finalizedAt: null,
        startedBy: null,
        stoppedBy: null,
        finalizedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      transaction.set(eventRef, initial);
      return { eventRef, eventData: initial };
    }
    return { eventRef, eventData: snap.data() };
  }

  const snap = await eventRef.get();
  if (!snap.exists) {
    const initial = {
      id: MAIN_EVENT_ID,
      status: "waiting",
      startedAt: null,
      stoppedAt: null,
      finalizedAt: null,
      startedBy: null,
      stoppedBy: null,
      finalizedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await eventRef.set(initial);
    return { eventRef, eventData: initial };
  }

  return { eventRef, eventData: snap.data() };
}

/**
 * Public/Player-facing event status.
 */
async function getPublicEventStatus() {
  const { eventData } = await getOrCreateEventDoc();

  let elapsedSeconds = 0;
  if (eventData.startedAt) {
    const startTime = eventData.startedAt.toMillis
      ? eventData.startedAt.toMillis()
      : new Date(eventData.startedAt).getTime();

    const endTime = eventData.stoppedAt
      ? (eventData.stoppedAt.toMillis
          ? eventData.stoppedAt.toMillis()
          : new Date(eventData.stoppedAt).getTime())
      : Date.now();

    elapsedSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
  }

  return {
    status: eventData.status, // waiting | active | stopped | completed
    startedAt: eventData.startedAt?.toDate ? eventData.startedAt.toDate().toISOString() : eventData.startedAt,
    stoppedAt: eventData.stoppedAt?.toDate ? eventData.stoppedAt.toDate().toISOString() : eventData.stoppedAt,
    finalizedAt: eventData.finalizedAt?.toDate ? eventData.finalizedAt.toDate().toISOString() : eventData.finalizedAt,
    elapsedSeconds,
    totalCheckpoints: checkpoints.length,
  };
}

/**
 * Admin action: Start the event.
 * Transition: waiting -> active
 */
async function startEvent(adminUser) {
  const adminId = adminUser.email || adminUser.uid || "admin";

  return db.runTransaction(async (transaction) => {
    const { eventRef, eventData } = await getOrCreateEventDoc(transaction);

    if (eventData.status === "active") {
      // Idempotent return if already started by admin
      return {
        success: true,
        status: "active",
        message: "Event is already active.",
        startedAt: eventData.startedAt,
      };
    }

    if (eventData.status !== "waiting") {
      throw new EventError(
        `Event cannot be started from current status '${eventData.status}'. Only 'waiting' events can be started.`,
        400,
        "INVALID_TRANSITION",
      );
    }

    const now = new Date();

    transaction.update(eventRef, {
      status: "active",
      startedAt: now,
      startedBy: adminId,
      updatedAt: now,
    });

    return {
      success: true,
      status: "active",
      startedAt: now.toISOString(),
      startedBy: adminId,
    };
  });
}

/**
 * Admin action: Stop the event.
 * Transition: active -> stopped
 */
async function stopEvent(adminUser) {
  const adminId = adminUser.email || adminUser.uid || "admin";

  return db.runTransaction(async (transaction) => {
    const { eventRef, eventData } = await getOrCreateEventDoc(transaction);

    if (eventData.status === "stopped") {
      return {
        success: true,
        status: "stopped",
        message: "Event is already stopped.",
        stoppedAt: eventData.stoppedAt,
      };
    }

    if (eventData.status !== "active") {
      throw new EventError(
        `Event cannot be stopped from current status '${eventData.status}'. Only 'active' events can be stopped.`,
        400,
        "INVALID_TRANSITION",
      );
    }

    const now = new Date();

    transaction.update(eventRef, {
      status: "stopped",
      stoppedAt: now,
      stoppedBy: adminId,
      updatedAt: now,
    });

    return {
      success: true,
      status: "stopped",
      stoppedAt: now.toISOString(),
      stoppedBy: adminId,
    };
  });
}

/**
 * Admin action: Finalize event results.
 * Transition: stopped -> completed
 */
async function finalizeEvent(adminUser) {
  const adminId = adminUser.email || adminUser.uid || "admin";

  return db.runTransaction(async (transaction) => {
    const { eventRef, eventData } = await getOrCreateEventDoc(transaction);

    if (eventData.status === "completed") {
      return {
        success: true,
        status: "completed",
        message: "Event is already finalized.",
        finalizedAt: eventData.finalizedAt,
      };
    }

    if (eventData.status !== "stopped") {
      throw new EventError(
        `Event results can only be finalized from 'stopped' status. Current status is '${eventData.status}'.`,
        400,
        "INVALID_TRANSITION",
      );
    }

    const now = new Date();

    transaction.update(eventRef, {
      status: "completed",
      finalizedAt: now,
      finalizedBy: adminId,
      updatedAt: now,
    });

    return {
      success: true,
      status: "completed",
      finalizedAt: now.toISOString(),
      finalizedBy: adminId,
    };
  });
}

/**
 * Admin overview metrics.
 */
async function getAdminOverview() {
  const [eventData, teamsSnap, playersSnap] = await Promise.all([
    getPublicEventStatus(),
    teamsCollection.get(),
    playersCollection.get(),
  ]);

  const teams = teamsSnap.docs.map((d) => d.data());
  const completedTeams = teams.filter(
    (t) => (t.completedCheckpoints || []).length >= checkpoints.length,
  ).length;

  return {
    event: eventData,
    metrics: {
      totalTeams: teams.length,
      totalPlayers: playersSnap.size,
      completedTeams,
      inProgressTeams: teams.length - completedTeams,
      totalCheckpoints: checkpoints.length,
    },
  };
}

/**
 * Admin teams list with progression status.
 */
async function getAdminTeamsList() {
  const teamsSnap = await teamsCollection.orderBy("createdAt", "asc").get();

  return teamsSnap.docs.map((d) => {
    const t = d.data();
    return {
      teamId: d.id,
      name: t.name,
      joinCode: t.joinCode,
      leaderUid: t.leaderUid,
      leaderName: t.leaderName,
      memberCount: t.memberCount || 1,
      maxMembers: t.maxMembers || 4,
      score: t.score || 0,
      completedCount: (t.completedCheckpoints || []).length,
      totalCheckpoints: checkpoints.length,
      completedAt: t.completedAt?.toDate ? t.completedAt.toDate().toISOString() : t.completedAt,
      createdAt: t.createdAt?.toDate ? t.createdAt.toDate().toISOString() : t.createdAt,
    };
  });
}

/**
 * Admin single team detail with member roster and checkpoint timeline.
 */
async function getAdminTeamDetail(teamId) {
  const teamDoc = await teamsCollection.doc(teamId).get();
  if (!teamDoc.exists) {
    throw new EventError("Team not found.", 404, "NOT_FOUND");
  }

  const team = teamDoc.data();
  const membersSnap = await teamsCollection
    .doc(teamId)
    .collection("members")
    .orderBy("joinedAt", "asc")
    .get();

  const members = membersSnap.docs.map((d) => d.data());

  // Build ordered checkpoint timeline
  const checkpointProgress = team.checkpointProgress || {};
  const timeline = checkpoints.map((cp) => {
    const progress = checkpointProgress[cp.id] || null;
    return {
      checkpointId: cp.id,
      name: cp.name,
      order: cp.order,
      claimed: Boolean(progress?.claimedAt),
      claimedAt: progress?.claimedAt?.toDate
        ? progress.claimedAt.toDate().toISOString()
        : progress?.claimedAt || null,
      completed: Boolean(progress?.completedAt),
      completedAt: progress?.completedAt?.toDate
        ? progress.completedAt.toDate().toISOString()
        : progress?.completedAt || null,
    };
  });

  return {
    teamId,
    name: team.name,
    joinCode: team.joinCode,
    leaderUid: team.leaderUid,
    leaderName: team.leaderName,
    memberCount: members.length,
    score: team.score || 0,
    completedCount: (team.completedCheckpoints || []).length,
    completedAt: team.completedAt?.toDate ? team.completedAt.toDate().toISOString() : team.completedAt,
    members,
    timeline,
  };
}

/**
 * Checkpoint-specific analytics leaderboard:
 * Ranks all teams that reached a specific checkpoint by original claim timestamp.
 */
async function getCheckpointAnalytics(checkpointId) {
  const cp = checkpoints.find((item) => item.id === checkpointId);
  if (!cp) {
    throw new EventError("Checkpoint not found.", 404, "NOT_FOUND");
  }

  const teamsSnap = await teamsCollection.get();
  const arrivals = [];

  teamsSnap.docs.forEach((doc) => {
    const t = doc.data();
    const progress = t.checkpointProgress?.[checkpointId];

    if (progress?.claimedAt) {
      const claimMillis = progress.claimedAt.toMillis
        ? progress.claimedAt.toMillis()
        : new Date(progress.claimedAt).getTime();

      const completedMillis = progress.completedAt
        ? (progress.completedAt.toMillis
            ? progress.completedAt.toMillis()
            : new Date(progress.completedAt).getTime())
        : null;

      arrivals.push({
        teamId: doc.id,
        teamName: t.name,
        claimMillis,
        claimedAt: progress.claimedAt.toDate
          ? progress.claimedAt.toDate().toISOString()
          : progress.claimedAt,
        completedAt: progress.completedAt?.toDate
          ? progress.completedAt.toDate().toISOString()
          : progress.completedAt || null,
        durationSeconds:
          completedMillis && claimMillis
            ? Math.max(0, Math.floor((completedMillis - claimMillis) / 1000))
            : null,
      });
    }
  });

  // Rank by claim timestamp (earliest first)
  arrivals.sort((a, b) => a.claimMillis - b.claimMillis);

  return {
    checkpointId: cp.id,
    checkpointName: cp.name,
    arrivals: arrivals.map((item, index) => ({
      rank: index + 1,
      ...item,
    })),
  };
}

module.exports = {
  getOrCreateEventDoc,
  getPublicEventStatus,
  startEvent,
  stopEvent,
  finalizeEvent,
  getAdminOverview,
  getAdminTeamsList,
  getAdminTeamDetail,
  getCheckpointAnalytics,
  EventError,
  MAIN_EVENT_ID,
};

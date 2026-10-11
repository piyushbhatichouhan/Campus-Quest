const { db, serverTimestamp } = require("../config/firebase");
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

function toIso(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  if (typeof ts === "string") return ts;
  if (typeof ts === "number") return new Date(ts).toISOString();
  return null;
}

function toMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  const parsed = new Date(ts).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function formatTimeShort(ts) {
  const iso = toIso(ts);
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Retrieves or initializes the single authoritative main event document.
 */
async function getOrCreateEventDoc(transaction = null) {
  const eventRef = eventsCollection.doc(MAIN_EVENT_ID);

  if (transaction) {
    const snap = await transaction.get(eventRef);
    if (!snap.exists) {
      const now = serverTimestamp();
      const initial = {
        id: MAIN_EVENT_ID,
        status: "waiting", // waiting | active | stopped | completed
        startedAt: null,
        stoppedAt: null,
        finalizedAt: null,
        startedBy: null,
        stoppedBy: null,
        finalizedBy: null,
        createdAt: now,
        updatedAt: now,
      };
      transaction.set(eventRef, initial);
      return { eventRef, eventData: { ...initial, status: "waiting" } };
    }
    return { eventRef, eventData: snap.data() };
  }

  const snap = await eventRef.get();
  if (!snap.exists) {
    const now = serverTimestamp();
    const initial = {
      id: MAIN_EVENT_ID,
      status: "waiting",
      startedAt: null,
      stoppedAt: null,
      finalizedAt: null,
      startedBy: null,
      stoppedBy: null,
      finalizedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    await eventRef.set(initial);
    const createdSnap = await eventRef.get();
    return { eventRef, eventData: createdSnap.exists ? createdSnap.data() : initial };
  }

  return { eventRef, eventData: snap.data() };
}

/**
 * Public/Player-facing event status.
 * Exposes ONLY public event lifecycle fields, never admin identities or hidden checkpoint data.
 */
async function getPublicEventStatus() {
  const { eventData } = await getOrCreateEventDoc();

  let elapsedSeconds = 0;
  const startMillis = toMillis(eventData.startedAt);
  if (startMillis) {
    const stopMillis = toMillis(eventData.stoppedAt);
    const endMillis = stopMillis || Date.now();
    elapsedSeconds = Math.max(0, Math.floor((endMillis - startMillis) / 1000));
  }

  return {
    status: eventData.status, // waiting | active | stopped | completed
    startedAt: toIso(eventData.startedAt),
    stoppedAt: toIso(eventData.stoppedAt),
    finalizedAt: toIso(eventData.finalizedAt),
    elapsedSeconds,
    totalCheckpoints: checkpoints.length,
    isOfficial: eventData.status === "completed",
    serverTime: new Date().toISOString(),
  };
}

/**
 * Admin-facing event status (includes audit metadata and checkpoint list for analytics).
 */
async function getAdminEventStatus() {
  const { eventData } = await getOrCreateEventDoc();
  const publicStatus = await getPublicEventStatus();

  return {
    ...publicStatus,
    startedBy: eventData.startedBy || null,
    stoppedBy: eventData.stoppedBy || null,
    finalizedBy: eventData.finalizedBy || null,
    checkpoints: checkpoints.map((cp) => ({
      id: cp.id,
      order: cp.order,
      name: cp.name,
      points: cp.points,
    })),
  };
}

/**
 * Admin action: Start the event.
 * Transition: waiting -> active (strictly from waiting)
 */
async function startEvent(adminUser) {
  if (!adminUser) {
    throw new EventError("Administrator authentication required.", 401, "UNAUTHORIZED");
  }
  const adminId = adminUser.email || adminUser.uid || "admin";
  const eventRef = eventsCollection.doc(MAIN_EVENT_ID);

  await db.runTransaction(async (transaction) => {
    const { eventData } = await getOrCreateEventDoc(transaction);

    if (eventData.status !== "waiting") {
      throw new EventError(
        `Event cannot be started from current status '${eventData.status}'. Only 'waiting' events can be started.`,
        400,
        "INVALID_TRANSITION",
      );
    }

    const ts = serverTimestamp();

    transaction.update(eventRef, {
      status: "active",
      startedAt: ts,
      stoppedAt: null,
      finalizedAt: null,
      startedBy: adminId,
      stoppedBy: null,
      finalizedBy: null,
      updatedAt: ts,
    });
  });

  // Read authoritative server timestamp after transaction commit
  const updatedSnap = await eventRef.get();
  const updatedEvent = updatedSnap.data() || {};
  const startedAtIso = toIso(updatedEvent.startedAt) || new Date().toISOString();

  // Unlock first mystery clue for all eligible registered teams & send start notification
  try {
    const teamsSnap = await teamsCollection.get();
    await Promise.all(
      teamsSnap.docs.map(async (teamDoc) => {
        const tData = teamDoc.data();
        const teamRef = teamsCollection.doc(teamDoc.id);
        const ts = serverTimestamp();
        if (tData.status === "waiting") {
          await teamRef.update({
            status: "active",
            updatedAt: ts,
          });
        }
        const evRef = teamRef.collection("events").doc();
        await evRef.set({
          id: evRef.id,
          type: "event_started",
          actorUid: adminUser.uid || "admin",
          actorName: "Administrator",
          message:
            "The Campus Quest competition has started! Your first mystery clue is now unlocked.",
          createdAt: ts,
        });
      }),
    );
  } catch (err) {
    // Non-fatal notification broadcast error; global event doc is already active
  }

  return {
    success: true,
    status: "active",
    startedAt: startedAtIso,
    startedBy: adminId,
  };
}

/**
 * Admin action: Stop the event.
 * Transition: active -> stopped (strictly from active)
 */
async function stopEvent(adminUser) {
  if (!adminUser) {
    throw new EventError("Administrator authentication required.", 401, "UNAUTHORIZED");
  }
  const adminId = adminUser.email || adminUser.uid || "admin";
  const eventRef = eventsCollection.doc(MAIN_EVENT_ID);

  await db.runTransaction(async (transaction) => {
    const { eventData } = await getOrCreateEventDoc(transaction);

    if (eventData.status !== "active") {
      throw new EventError(
        `Event cannot be stopped from current status '${eventData.status}'. Only 'active' events can be stopped.`,
        400,
        "INVALID_TRANSITION",
      );
    }

    const ts = serverTimestamp();

    transaction.update(eventRef, {
      status: "stopped",
      stoppedAt: ts,
      stoppedBy: adminId,
      updatedAt: ts,
    });
  });

  const updatedSnap = await eventRef.get();
  const updatedEvent = updatedSnap.data() || {};
  const stoppedAtIso = toIso(updatedEvent.stoppedAt) || new Date().toISOString();

  // Notify connected teams that the event has ended without deleting any progress
  try {
    const teamsSnap = await teamsCollection.get();
    await Promise.all(
      teamsSnap.docs.map(async (teamDoc) => {
        const teamRef = teamsCollection.doc(teamDoc.id);
        const evRef = teamRef.collection("events").doc();
        await evRef.set({
          id: evRef.id,
          type: "event_stopped",
          actorUid: adminUser.uid || "admin",
          actorName: "Administrator",
          message:
            "The administrator has stopped the event. Gameplay is now disabled and results are frozen.",
          createdAt: serverTimestamp(),
        });
      }),
    );
  } catch (err) {
    // Non-fatal notification broadcast error
  }

  return {
    success: true,
    status: "stopped",
    stoppedAt: stoppedAtIso,
    stoppedBy: adminId,
  };
}

/**
 * Admin action: Finalize event results.
 * Transition: stopped -> completed (strictly from stopped)
 */
async function finalizeEvent(adminUser) {
  if (!adminUser) {
    throw new EventError("Administrator authentication required.", 401, "UNAUTHORIZED");
  }
  const adminId = adminUser.email || adminUser.uid || "admin";
  const eventRef = eventsCollection.doc(MAIN_EVENT_ID);

  await db.runTransaction(async (transaction) => {
    const { eventData } = await getOrCreateEventDoc(transaction);

    if (eventData.status !== "stopped") {
      throw new EventError(
        `Event results can only be finalized from 'stopped' status. Current status is '${eventData.status}'.`,
        400,
        "INVALID_TRANSITION",
      );
    }

    const ts = serverTimestamp();

    transaction.update(eventRef, {
      status: "completed",
      finalizedAt: ts,
      finalizedBy: adminId,
      updatedAt: ts,
    });
  });

  const updatedSnap = await eventRef.get();
  const updatedEvent = updatedSnap.data() || {};
  const finalizedAtIso = toIso(updatedEvent.finalizedAt) || new Date().toISOString();

  return {
    success: true,
    status: "completed",
    isOfficial: true,
    finalizedAt: finalizedAtIso,
    finalizedBy: adminId,
  };
}

/**
 * Admin overview metrics.
 */
async function getAdminOverview() {
  const [eventData, teamsSnap, playersSnap] = await Promise.all([
    getAdminEventStatus(),
    teamsCollection.get(),
    playersCollection.get(),
  ]);

  const teams = teamsSnap.docs.map((d) => d.data());
  const completedTeams = teams.filter(
    (t) => (t.completedCheckpoints || []).length >= checkpoints.length || Boolean(t.completedAt),
  ).length;

  return {
    event: eventData,
    metrics: {
      totalTeams: teams.length,
      totalPlayers: playersSnap.size,
      completedTeams,
      inProgressTeams: Math.max(0, teams.length - completedTeams),
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
    const completedCount = (t.completedCheckpoints || []).length;
    return {
      teamId: d.id,
      name: t.name,
      joinCode: t.joinCode,
      leaderUid: t.leaderUid,
      leaderName: t.leaderName,
      memberCount: t.memberCount || 1,
      maxMembers: t.maxMembers || 4,
      score: t.score || 0,
      completedCount,
      totalCheckpoints: checkpoints.length,
      progress: `${completedCount}/${checkpoints.length}`,
      completedAt: toIso(t.completedAt),
      completedAtFormatted: formatTimeShort(t.completedAt) || "—",
      createdAt: toIso(t.createdAt),
    };
  });
}

/**
 * Admin single team detail with member roster and checkpoint timeline.
 */
async function getAdminTeamDetail(teamId) {
  const [teamDoc, { eventData }] = await Promise.all([
    teamsCollection.doc(teamId).get(),
    getOrCreateEventDoc(),
  ]);

  if (!teamDoc.exists) {
    throw new EventError("Team not found.", 404, "NOT_FOUND");
  }

  const team = teamDoc.data();
  const membersSnap = await teamsCollection
    .doc(teamId)
    .collection("members")
    .orderBy("joinedAt", "asc")
    .get();

  const members = membersSnap.docs.map((d) => {
    const m = d.data();
    return {
      ...m,
      joinedAt: toIso(m.joinedAt),
    };
  });

  // Build ordered checkpoint timeline
  const checkpointProgress = team.checkpointProgress || {};
  const timeline = checkpoints.map((cp) => {
    const progress = checkpointProgress[cp.id] || null;
    const claimedAtIso = toIso(progress?.claimedAt);
    const completedAtIso = toIso(progress?.completedAt);
    return {
      checkpointId: cp.id,
      name: cp.name,
      order: cp.order,
      points: cp.points,
      claimed: Boolean(claimedAtIso),
      claimedAt: claimedAtIso,
      claimedAtFormatted: formatTimeShort(claimedAtIso) || "—",
      completed: Boolean(completedAtIso),
      completedAt: completedAtIso,
      completedAtFormatted: formatTimeShort(completedAtIso) || "—",
    };
  });

  // Build chronological step-by-step journey timeline for Admin Inspection
  const eventStartedAtIso = toIso(eventData.startedAt);
  const adventureCompletedAtIso = toIso(team.completedAt);

  const journeySteps = [
    {
      stepType: "event_start",
      label: "Event start time",
      reached: Boolean(eventStartedAtIso),
      timestamp: eventStartedAtIso,
      formattedTime: formatTimeShort(eventStartedAtIso) || "Not started",
    },
  ];

  timeline.forEach((cp) => {
    journeySteps.push({
      stepType: "checkpoint_claimed",
      checkpointId: cp.checkpointId,
      checkpointOrder: cp.order,
      checkpointName: cp.name,
      label: `Checkpoint ${cp.order} claimed (${cp.name})`,
      reached: cp.claimed,
      timestamp: cp.claimedAt,
      formattedTime: cp.claimedAtFormatted,
    });
    journeySteps.push({
      stepType: "challenge_completed",
      checkpointId: cp.checkpointId,
      checkpointOrder: cp.order,
      checkpointName: cp.name,
      label: `Checkpoint ${cp.order} challenge completed (${cp.name})`,
      reached: cp.completed,
      timestamp: cp.completedAt,
      formattedTime: cp.completedAtFormatted,
    });
  });

  journeySteps.push({
    stepType: "adventure_completion",
    label: "Adventure completion",
    reached: Boolean(adventureCompletedAtIso),
    timestamp: adventureCompletedAtIso,
    formattedTime: formatTimeShort(adventureCompletedAtIso) || "—",
  });

  const completedCount = (team.completedCheckpoints || []).length;

  return {
    teamId,
    name: team.name,
    joinCode: team.joinCode,
    leaderUid: team.leaderUid,
    leaderName: team.leaderName,
    memberCount: members.length || team.memberCount || 1,
    maxMembers: team.maxMembers || 4,
    score: team.score || 0,
    completedCount,
    totalCheckpoints: checkpoints.length,
    progress: `${completedCount}/${checkpoints.length}`,
    eventStatus: eventData.status,
    eventStartedAt: eventStartedAtIso,
    eventStartedAtFormatted: formatTimeShort(eventStartedAtIso) || "—",
    completedAt: adventureCompletedAtIso,
    completedAtFormatted: formatTimeShort(adventureCompletedAtIso) || "—",
    members,
    timeline,
    journeySteps,
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
      const claimMillis = toMillis(progress.claimedAt) || 0;
      const completedMillis = toMillis(progress.completedAt);
      const claimedAtIso = toIso(progress.claimedAt);
      const completedAtIso = toIso(progress.completedAt);

      arrivals.push({
        teamId: doc.id,
        teamName: t.name,
        claimMillis,
        claimedAt: claimedAtIso,
        claimedAtFormatted: formatTimeShort(claimedAtIso) || "—",
        completedAt: completedAtIso,
        completedAtFormatted: formatTimeShort(completedAtIso) || "—",
        durationSeconds:
          completedMillis && claimMillis
            ? Math.max(0, Math.floor((completedMillis - claimMillis) / 1000))
            : null,
      });
    }
  });

  // Rank by original successful claim timestamp (earliest first, deterministic tie-breaker by teamId)
  arrivals.sort((a, b) => {
    if (a.claimMillis !== b.claimMillis) {
      return a.claimMillis - b.claimMillis;
    }
    return String(a.teamId).localeCompare(String(b.teamId));
  });

  return {
    checkpointId: cp.id,
    checkpointOrder: cp.order,
    checkpointName: cp.name,
    points: cp.points,
    arrivals: arrivals.map((item, index) => ({
      rank: index + 1,
      ...item,
    })),
  };
}

module.exports = {
  getOrCreateEventDoc,
  getPublicEventStatus,
  getAdminEventStatus,
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

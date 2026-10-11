import { useCallback, useEffect, useMemo, useState } from "react";
import { getDistanceToCheckpoint, isInsideGeofence } from "../utils/geofence";
import { gameApi } from "../services/gameApi";
import { useAuth } from "../context/AuthContext";

function useGameEngine(location) {
  const { user } = useAuth();
  const [checkpoints, setCheckpoints] = useState([]);
  const [serverState, setServerState] = useState(null);
  const [loadingGame, setLoadingGame] = useState(true);
  const [apiError, setApiError] = useState("");
  const [challengeResults, setChallengeResults] = useState({});

  const refreshState = useCallback(async () => {
    if (!user) return null;
    try {
      const state = await gameApi.getGameState();
      setServerState(state);
      return state;
    } catch (error) {
      setApiError(error.message);
      return null;
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function initializeGame() {
      if (!user) {
        setLoadingGame(false);
        return;
      }

      setLoadingGame(true);
      setApiError("");

      try {
        const [checkpointData, state] = await Promise.all([
          gameApi.getCheckpoints(),
          gameApi.startGame(user.displayName),
        ]);

        if (cancelled) return;

        if (!Array.isArray(checkpointData) || checkpointData.length === 0) {
          throw new Error("The server returned no checkpoints.");
        }

        setCheckpoints(checkpointData);
        setServerState(state);
      } catch (error) {
        if (!cancelled) {
          setApiError(error.message);
        }
      } finally {
        if (!cancelled) {
          setLoadingGame(false);
        }
      }
    }

    initializeGame();

    // Background polling for team state synchronization across devices
    let pollInterval = null;
    const scheduleStatePoll = () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        refreshState();
      }
      pollInterval = window.setTimeout(scheduleStatePoll, 4000);
    };

    pollInterval = window.setTimeout(scheduleStatePoll, 4000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshState();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      if (pollInterval) clearTimeout(pollInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [user, refreshState]);

  const currentCheckpointIndex = serverState?.gameCompleted
    ? checkpoints.length
    : checkpoints.findIndex(
        (checkpoint) => checkpoint.id === serverState?.currentCheckpoint?.id,
      );

  const safeIndex = currentCheckpointIndex < 0 ? 0 : currentCheckpointIndex;

  const completedCheckpoints = serverState?.completedCheckpoints;
  const claimedCheckpointId = serverState?.claimedCheckpointId || null;
  const score = serverState?.score || 0;
  const gameCompleted = Boolean(serverState?.gameCompleted);
  const inventory = serverState?.inventory || [];
  const rank = serverState?.rank || 1;
  const teamName = serverState?.teamName || "CAMPUS QUEST";
  const memberCount = serverState?.memberCount || 1;
  const maxMembers = serverState?.maxMembers || 4;
  const teamStatus = serverState?.status || "active";
  const level = Math.floor(score / 250) + 1;
  const nextLevelXP = level * 250;

  const currentCheckpoint = checkpoints[safeIndex] || null;

  const checkpointStates = useMemo(() => {
    const completedList = completedCheckpoints || [];
    return checkpoints.map((checkpoint, index) => {
      const distance = getDistanceToCheckpoint(location, checkpoint);
      const inside = isInsideGeofence(location, checkpoint);

      let status = "HIDDEN";

      if (completedList.includes(checkpoint.id)) {
        status = "COMPLETED";
      } else if (!gameCompleted && index === safeIndex) {
        status =
          claimedCheckpointId === checkpoint.id
            ? "CHALLENGE"
            : inside
              ? "DISCOVERED"
              : "REVEALED";
      }

      return {
        ...checkpoint,
        distance,
        inside,
        status,
      };
    });
  }, [
    checkpoints,
    location,
    completedCheckpoints,
    gameCompleted,
    safeIndex,
    claimedCheckpointId,
  ]);

  const currentCheckpointState =
    checkpointStates.find(
      (checkpoint) => checkpoint.id === currentCheckpoint?.id,
    ) || null;

  async function claimCheckpoint(checkpointId) {
    const checkpoint = checkpoints.find((item) => item.id === checkpointId);

    if (
      !checkpoint ||
      !currentCheckpoint ||
      checkpointId !== currentCheckpoint.id
    ) {
      return false;
    }

    if (!isInsideGeofence(location, checkpoint)) {
      setApiError("Move inside the checkpoint area before claiming it.");
      return false;
    }

    const latitude =
      location?.latitude ?? location?.lat ?? location?.coords?.latitude;

    const longitude =
      location?.longitude ?? location?.lng ?? location?.coords?.longitude;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setApiError("Your current GPS position is not available yet.");
      return false;
    }

    try {
      setApiError("");

      await gameApi.claimCheckpoint(checkpointId, latitude, longitude);

      await refreshState();
      return true;
    } catch (error) {
      setApiError(error.message);
      return false;
    }
  }

  async function submitChallenge(checkpointId, answer) {
    if (claimedCheckpointId !== checkpointId) {
      return {
        success: false,
        reason: "Claim the checkpoint before solving its challenge.",
      };
    }

    try {
      setApiError("");

      const result = await gameApi.submitChallenge(checkpointId, answer);

      if (!result.success) {
        setChallengeResults((previous) => ({
          ...previous,
          [checkpointId]: false,
        }));

        return {
          success: false,
          reason: result.message || "Incorrect answer. Try again.",
        };
      }

      setChallengeResults((previous) => ({
        ...previous,
        [checkpointId]: true,
      }));

      await refreshState();

      return {
        success: true,
        points: result.pointsAwarded,
      };
    } catch (error) {
      setApiError(error.message);

      return {
        success: false,
        reason: error.message,
      };
    }
  }

  return {
    checkpoints: checkpointStates,
    currentCheckpoint: currentCheckpointState,
    currentCheckpointIndex: safeIndex,
    claimedCheckpoints: claimedCheckpointId ? [claimedCheckpointId] : [],
    completedCheckpoints: completedCheckpoints || [],
    challengeResults,
    score,
    teamName,
    memberCount,
    maxMembers,
    teamStatus,
    inventory,
    rank,
    level,
    nextLevelXP,
    gameCompleted,
    loadingGame,
    apiError,
    claimCheckpoint,
    submitChallenge,
    refreshState,
  };
}

export default useGameEngine;

import { useMemo, useState } from "react";

import checkpoints from "../data/checkpoints";

import { getDistanceToCheckpoint, isInsideGeofence } from "../utils/geofence";

function useGameEngine(location) {
  // --------------------------------------------------
  // Checkpoints that the player has claimed
  // --------------------------------------------------

  const [claimedCheckpoints, setClaimedCheckpoints] = useState([]);

  // --------------------------------------------------
  // Checkpoints that the player has completed
  // --------------------------------------------------

  const [completedCheckpoints, setCompletedCheckpoints] = useState([]);

  // --------------------------------------------------
  // Calculate current state of every checkpoint
  // --------------------------------------------------

  const checkpointStates = useMemo(() => {
    return checkpoints.map((checkpoint) => {
      const distance = getDistanceToCheckpoint(location, checkpoint);

      const inside = isInsideGeofence(location, checkpoint);

      let status = "LOCKED";

      if (completedCheckpoints.includes(checkpoint.id)) {
        status = "COMPLETED";
      } else if (claimedCheckpoints.includes(checkpoint.id)) {
        status = "CLAIMED";
      } else if (inside) {
        status = "AVAILABLE";
      }

      return {
        ...checkpoint,
        distance,
        inside,
        status,
      };
    });
  }, [location, claimedCheckpoints, completedCheckpoints]);

  // --------------------------------------------------
  // Claim a checkpoint
  // --------------------------------------------------

  function claimCheckpoint(checkpointId) {
    const checkpoint = checkpoints.find(
      (checkpoint) => checkpoint.id === checkpointId,
    );

    if (!checkpoint) {
      return false;
    }

    // Check player's current GPS position again
    const inside = isInsideGeofence(location, checkpoint);

    // Player must actually be inside
    if (!inside) {
      return false;
    }

    // Cannot claim something already claimed
    if (claimedCheckpoints.includes(checkpointId)) {
      return false;
    }

    // Cannot claim something already completed
    if (completedCheckpoints.includes(checkpointId)) {
      return false;
    }

    setClaimedCheckpoints((current) => [...current, checkpointId]);

    return true;
  }

  // --------------------------------------------------
  // Complete a checkpoint
  // --------------------------------------------------

  function completeCheckpoint(checkpointId) {
    if (!claimedCheckpoints.includes(checkpointId)) {
      return false;
    }

    if (completedCheckpoints.includes(checkpointId)) {
      return false;
    }

    setCompletedCheckpoints((current) => [...current, checkpointId]);

    return true;
  }

  // --------------------------------------------------
  // Calculate XP
  // --------------------------------------------------

  const score = checkpointStates
    .filter((checkpoint) => checkpoint.status === "COMPLETED")
    .reduce((total, checkpoint) => total + checkpoint.points, 0);

  // --------------------------------------------------
  // Return game engine API
  // --------------------------------------------------

  return {
    checkpoints: checkpointStates,

    claimedCheckpoints,
    completedCheckpoints,

    claimCheckpoint,
    completeCheckpoint,

    score,
  };
}

export default useGameEngine;

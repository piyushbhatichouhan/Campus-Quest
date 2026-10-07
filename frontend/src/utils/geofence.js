import { calculateDistance } from "./distance";

export function getDistanceToCheckpoint(playerLocation, checkpoint) {
  if (!playerLocation || !checkpoint) {
    return null;
  }

  return calculateDistance(
    playerLocation.latitude,
    playerLocation.longitude,
    checkpoint.latitude,
    checkpoint.longitude,
  );
}

export function isInsideGeofence(playerLocation, checkpoint) {
  const distance = getDistanceToCheckpoint(playerLocation, checkpoint);

  if (distance === null) {
    return false;
  }

  return distance <= checkpoint.radius;
}

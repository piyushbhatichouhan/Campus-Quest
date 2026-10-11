const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const latitudeDifference = toRadians(lat2 - lat1);
  const longitudeDifference = toRadians(lon2 - lon1);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(longitudeDifference / 2) ** 2;

  const boundedA = Math.min(1, Math.max(0, a));

  const centralAngle =
    2 * Math.atan2(Math.sqrt(boundedA), Math.sqrt(1 - boundedA));

  return EARTH_RADIUS_METERS * centralAngle;
}

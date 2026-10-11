import { useEffect, useState } from "react";

function useGeolocation() {
  const isSupported =
    typeof navigator !== "undefined" && Boolean(navigator.geolocation);

  const [location, setLocation] = useState(null);
  const [error, setError] = useState(
    isSupported ? null : "Geolocation is not supported by this browser.",
  );
  const [loading, setLoading] = useState(isSupported);

  useEffect(() => {
    if (!navigator.geolocation) {
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });

        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return {
    location,
    error,
    loading,
  };
}

export default useGeolocation;

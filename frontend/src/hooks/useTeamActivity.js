import { useEffect, useState, useRef } from "react";
import { gameApi } from "../services/gameApi";
import { useAuth } from "../context/AuthContext";
import { playDiscoverySound, playSuccessSound } from "../utils/sounds";

export function useTeamActivity() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const seenEventIdsRef = useRef(new Set());
  const baselineTimestampRef = useRef(null);
  const isPollingRef = useRef(false);

  // Initialize baseline timestamp on mount
  useEffect(() => {
    if (!baselineTimestampRef.current) {
      baselineTimestampRef.current = new Date().toISOString();
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    let timerId = null;
    let isMounted = true;

    async function pollEvents() {
      if (isPollingRef.current || !baselineTimestampRef.current) return;
      isPollingRef.current = true;

      try {
        const events = await gameApi.getTeamEvents(baselineTimestampRef.current);

        if (isMounted && Array.isArray(events)) {
          const newEvents = events.filter((e) => !seenEventIdsRef.current.has(e.id));

          if (newEvents.length > 0) {
            newEvents.forEach((e) => seenEventIdsRef.current.add(e.id));

            // Update baseline to the latest event's timestamp
            const latest = newEvents[newEvents.length - 1];
            if (latest.createdAt) {
              baselineTimestampRef.current = latest.createdAt;
            }

            // Play appropriate sound for team notifications
            if (newEvents.some((e) => e.type === "challenge_completed")) {
              playSuccessSound();
            } else if (newEvents.some((e) => e.type === "checkpoint_claimed")) {
              playDiscoverySound();
            }

            // Add new toasts to queue
            setNotifications((prev) => [...prev, ...newEvents]);

            // Auto-dismiss each event after 3.8 seconds
            newEvents.forEach((e) => {
              window.setTimeout(() => {
                if (isMounted) {
                  setNotifications((current) => current.filter((item) => item.id !== e.id));
                }
              }, 3800);
            });
          }
        }
      } catch (err) {
        // Silently handle polling errors
      } finally {
        isPollingRef.current = false;
      }
    }

    const schedulePoll = () => {
      if (!isMounted) return;
      if (document.visibilityState === "visible") {
        pollEvents();
      }
      timerId = window.setTimeout(schedulePoll, 4000);
    };

    // Initial check and start poll cycle
    schedulePoll();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        pollEvents();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [user]);

  const dismissNotification = (id) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  return {
    notifications,
    dismissNotification,
  };
}

export default useTeamActivity;

"use client";

import { useEffect } from "react";
import { recordHeartbeat } from "@/lib/actions/presence";

const INTERVAL_MS = 30_000;

/**
 * Invisible component that pings the server on a timer while the dashboard is
 * open, so teammates can see this agent as online. Pauses when the tab is
 * hidden and fires once immediately on becoming visible again.
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    let stopped = false;
    const beat = () => {
      if (!stopped && document.visibilityState === "visible") {
        void recordHeartbeat();
      }
    };
    beat();
    const id = setInterval(beat, INTERVAL_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);

  return null;
}

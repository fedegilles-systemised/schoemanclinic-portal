"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { SESSION_LIMITS, type SessionKind } from "@/lib/supabase/session-limits";

const HEARTBEAT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

/**
 * Keeps the server's idle clock moving while the person is working, and asks the server
 * to check the limits once they stop. The refresh goes through the proxy, which ends an
 * expired session and sends the person to sign in, so an abandoned screen does not stay
 * readable. Renders nothing.
 */
export function SessionGuard({ kind }: { kind: SessionKind }) {
  const router = useRouter();

  useEffect(() => {
    const idleMs = SESSION_LIMITS[kind].idleSeconds * 1000;
    let idleTimer: ReturnType<typeof setTimeout>;
    let lastPing = Date.now();

    const armIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => router.refresh(), idleMs);
    };

    const onActivity = () => {
      armIdleTimer();
      if (Date.now() - lastPing >= HEARTBEAT_MS) {
        lastPing = Date.now();
        router.refresh();
      }
    };

    armIdleTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    return () => {
      clearTimeout(idleTimer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, [kind, router]);

  return null;
}

"use client";
import { useEffect, useRef } from "react";

/**
 * Browser error reporter: forwards window errors to /api/monitoring/error,
 * which forwards them to Sentry server-side (the DSN never reaches the
 * browser). Throttled — at most 5 reports per page load, one per 5 seconds —
 * so a broken loop cannot flood the endpoint. A failed report is silent:
 * reporting must never break the page.
 */
export default function ErrorReporter() {
  const sent = useRef(0);
  const lastAt = useRef(0);
  useEffect(() => {
    const send = (message: string) => {
      const now = Date.now();
      if (sent.current >= 5 || now - lastAt.current < 5000) return;
      sent.current += 1;
      lastAt.current = now;
      fetch("/api/monitoring/error", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, url: location.href }),
      }).catch(() => undefined);
    };
    const onError = (e: ErrorEvent) => send(e.message || "window error");
    const onRejection = (e: PromiseRejectionEvent) =>
      send(e.reason instanceof Error ? `${e.reason.name}: ${e.reason.message}` : String(e.reason ?? "unhandled rejection"));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}

"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js. Deliberately production-only: a service worker
 * intercepting fetches in dev would fight with Turbopack's Fast Refresh and
 * make code changes look like they aren't taking effect.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

// Registers the service worker that makes the site installable and keeps opened boards for use offline. Draws nothing.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installing is a convenience; the site works without it.
    });
  }, []);
  return null;
}

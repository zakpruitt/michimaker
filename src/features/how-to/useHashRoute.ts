/**
 * Minimal hash "router": the app has exactly two views (the planner and the
 * how-to guide), so a full router would be overkill. The share-link flow
 * uses query parameters, not the hash, so the two never collide.
 */
import { useSyncExternalStore } from "react";

export const HOW_TO_HASH = "#/how-to";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getSnapshot(): string {
  return window.location.hash;
}

export function useHashRoute(): string {
  return useSyncExternalStore(subscribe, getSnapshot);
}

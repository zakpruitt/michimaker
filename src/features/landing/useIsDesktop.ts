/**
 * Decides whether the full planner UI is available on this device.
 *
 * The planner needs a reasonably wide viewport and a mouse (drag-selection
 * of art spans is mouse-driven), so touch-only devices (phones and tablets
 * alike) get the landing page instead. Re-evaluates live on resize, so
 * rotating a device or resizing a window switches views immediately.
 */
import { useSyncExternalStore } from "react";

const DESKTOP_QUERY = "(min-width: 768px) and (hover: hover) and (pointer: fine)";

function subscribe(onChange: () => void): () => void {
  const mediaQueryList = window.matchMedia(DESKTOP_QUERY);
  mediaQueryList.addEventListener("change", onChange);
  return () => mediaQueryList.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}

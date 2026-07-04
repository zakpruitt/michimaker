/**
 * Auto-save persistence: the current binder is written to localStorage on
 * every change and restored on the next visit. Storage failures (quota,
 * privacy mode, corrupted data) are never fatal; worst case the user starts
 * with a fresh binder.
 */
import type { Binder } from "../../types/binder";
import { envelopeToJson, parseBinderJson } from "./binderCodec";

const STORAGE_KEY = "pokemon-binder-planner.binder.v1";

export function saveBinderToLocalStorage(binder: Binder): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, envelopeToJson(binder, false));
  } catch {
    // Quota exceeded (e.g. many large uploaded images) or storage disabled.
    // Auto-save is best-effort; the user still has file export.
  }
}

export function loadBinderFromLocalStorage(): Binder | null {
  try {
    const json = window.localStorage.getItem(STORAGE_KEY);
    if (json === null) {
      return null;
    }
    return parseBinderJson(json);
  } catch {
    return null;
  }
}

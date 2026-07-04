/**
 * Share-by-URL support: the whole binder travels inside a "?binder=" query
 * parameter, so pasting the link to someone else fully restores the binder
 * with no server involved.
 */
import type { Binder } from "../../types/binder";
import { BinderDecodeError, decodeBinderFromParam, encodeBinderToParam } from "./binderCodec";

export const SHARE_PARAM = "binder";

/**
 * Links longer than this may get truncated by chat apps or refused by some
 * servers/browsers; the UI warns (but still copies) past this point.
 */
export const SHARE_URL_LENGTH_WARNING = 8000;

export function buildShareUrl(binder: Binder): string {
  const url = new URL(window.location.href);
  url.search = `${SHARE_PARAM}=${encodeBinderToParam(binder)}`;
  return url.toString();
}

export type ShareLinkReadResult =
  | { status: "absent" }
  | { status: "ok"; binder: Binder }
  | { status: "error"; message: string };

/** Reads and decodes the share parameter from the current page URL, if any. */
export function readBinderFromCurrentUrl(): ShareLinkReadResult {
  const encoded = new URLSearchParams(window.location.search).get(SHARE_PARAM);
  if (encoded === null || encoded === "") {
    return { status: "absent" };
  }
  try {
    return { status: "ok", binder: decodeBinderFromParam(encoded) };
  } catch (error) {
    const message =
      error instanceof BinderDecodeError
        ? error.message
        : "The share link could not be read.";
    return { status: "error", message };
  }
}

/**
 * Drops the share parameter from the address bar after a successful import,
 * so a later refresh resumes from auto-save instead of resetting to the
 * shared snapshot.
 */
export function removeShareParamFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(SHARE_PARAM);
  window.history.replaceState(null, "", url.toString());
}

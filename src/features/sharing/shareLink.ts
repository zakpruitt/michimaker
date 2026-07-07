import type {Binder} from "../../types/binder";
import {BinderDecodeError, decodeBinderFromParam, encodeBinderToParam} from "./binderCodec";

export const SHARE_PARAM = "binder";

/** Longer links risk truncation by chat apps; the UI warns (but still copies) past this. */
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
        return {status: "absent"};
    }
    try {
        return {status: "ok", binder: decodeBinderFromParam(encoded)};
    } catch (error) {
        const message =
            error instanceof BinderDecodeError
                ? error.message
                : "The share link could not be read.";
        return {status: "error", message};
    }
}

/** Dropped after import so a refresh resumes from auto-save, not the shared snapshot. */
export function removeShareParamFromUrl(): void {
    const url = new URL(window.location.href);
    url.searchParams.delete(SHARE_PARAM);
    window.history.replaceState(null, "", url.toString());
}

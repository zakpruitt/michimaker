import type {Binder} from "../../../types/binder";
import {readBinderFromCurrentUrl} from "../../sharing/shareLink";
import {backupStoredBinder, loadBinderFromLocalStorage} from "../../sharing/storage";
import {createDefaultBinder} from "./binderReducer";

export interface InitialLoad {
    binder: Binder;
    replacedBinder: Binder | null;
    source: "share-link" | "local-storage" | "default";
    shareLinkError: string | null;
}

export function resolveInitialBinder(): InitialLoad {
    const fromUrl = readBinderFromCurrentUrl();
    const stored = loadBinderFromLocalStorage();
    if (fromUrl.status === "ok") {
        if (stored !== null) {
            backupStoredBinder();
        }
        return {binder: fromUrl.binder, replacedBinder: stored, source: "share-link", shareLinkError: null};
    }
    const shareLinkError = fromUrl.status === "error" ? fromUrl.message : null;
    if (stored !== null) {
        return {binder: stored, replacedBinder: null, source: "local-storage", shareLinkError};
    }
    return {binder: createDefaultBinder(), replacedBinder: null, source: "default", shareLinkError};
}

export function listInlinedCardImageIds(binder: Binder): string[] {
    const ids = new Set<string>();
    for (const page of binder.pages) {
        for (const card of page.pockets) {
            if (card !== null && card.smallImageUrl.startsWith("data:")) {
                ids.add(card.id);
            }
        }
    }
    return [...ids];
}

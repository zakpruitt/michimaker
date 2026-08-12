import type {Binder} from "../../types/binder";
import {envelopeToJson, parseBinderJson} from "./binderCodec";

const STORAGE_KEY = "pokemon-binder-planner.binder.v1";

export function saveBinderToLocalStorage(binder: Binder): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, envelopeToJson(binder, false));
    } catch {
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

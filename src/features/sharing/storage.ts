import type {Binder} from "../../types/binder";
import {envelopeToJson, parseBinderJson} from "./binderCodec";

const STORAGE_KEY = "pokemon-binder-planner.binder.v1";

export type SaveResult =
    | {status: "saved"; bytes: number}
    | {status: "unchanged"}
    | {status: "quota-exceeded"; bytes: number}
    | {status: "failed"};

let lastSavedJson: string | null = null;

function isQuotaError(error: unknown): boolean {
    if (!(error instanceof DOMException)) {
        return false;
    }
    return (
        error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        error.code === 22
    );
}

export function saveBinderToLocalStorage(binder: Binder): SaveResult {
    let json: string;
    try {
        json = envelopeToJson(binder, false);
    } catch {
        return {status: "failed"};
    }
    if (json === lastSavedJson) {
        return {status: "unchanged"};
    }
    try {
        window.localStorage.setItem(STORAGE_KEY, json);
        lastSavedJson = json;
        return {status: "saved", bytes: json.length};
    } catch (error) {
        if (isQuotaError(error)) {
            return {status: "quota-exceeded", bytes: json.length};
        }
        return {status: "failed"};
    }
}

export function loadBinderFromLocalStorage(): Binder | null {
    try {
        const json = window.localStorage.getItem(STORAGE_KEY);
        if (json === null) {
            return null;
        }
        const binder = parseBinderJson(json);
        lastSavedJson = json;
        return binder;
    } catch {
        return null;
    }
}

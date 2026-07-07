import {useSyncExternalStore} from "react";

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

import {useSyncExternalStore} from "react";

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

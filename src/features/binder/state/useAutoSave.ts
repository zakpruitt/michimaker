import {useCallback, useEffect, useRef} from "react";
import type {Binder} from "../../../types/binder";
import {useNotices} from "../../../components/notices/NoticeContext";
import {type SaveResult, saveBinderToLocalStorage} from "../../sharing/storage";

const AUTO_SAVE_DELAY_MS = 150;
const AUTO_SAVE_MAX_WAIT_MS = 1500;

export function useAutoSave(binder: Binder): void {
    const {showNotice} = useNotices();
    const latestBinderRef = useRef(binder);
    const pendingSinceRef = useRef<number | null>(null);
    const failureReportedRef = useRef(false);

    useEffect(() => {
        latestBinderRef.current = binder;
    }, [binder]);

    const save = useCallback(() => {
        pendingSinceRef.current = null;
        const result = saveBinderToLocalStorage(latestBinderRef.current);
        if (result.status === "saved" || result.status === "unchanged") {
            failureReportedRef.current = false;
        } else if (!failureReportedRef.current) {
            failureReportedRef.current = true;
            showNotice(describeSaveFailure(result), "error");
        }
    }, [showNotice]);

    useEffect(() => {
        pendingSinceRef.current ??= Date.now();
        const waited = Date.now() - pendingSinceRef.current;
        const delay = Math.max(0, Math.min(AUTO_SAVE_DELAY_MS, AUTO_SAVE_MAX_WAIT_MS - waited));
        const timeoutId = window.setTimeout(save, delay);
        return () => window.clearTimeout(timeoutId);
    }, [binder, save]);

    useEffect(() => {
        function saveWhenHidden() {
            if (document.visibilityState === "hidden") {
                save();
            }
        }

        window.addEventListener("pagehide", save);
        document.addEventListener("visibilitychange", saveWhenHidden);
        return () => {
            window.removeEventListener("pagehide", save);
            document.removeEventListener("visibilitychange", saveWhenHidden);
        };
    }, [save]);
}

function describeSaveFailure(result: Exclude<SaveResult, {status: "saved" | "unchanged"}>): string {
    if (result.status === "quota-exceeded") {
        const megabytes = (result.bytes / (1024 * 1024)).toFixed(1);
        return `This binder is now ${megabytes} MB and no longer fits in browser storage, so auto-save has stopped. Use Export in the toolbar to keep a copy, then remove some uploaded art.`;
    }
    return "Auto-save to this browser failed. Use Export in the toolbar to keep a copy of your work.";
}

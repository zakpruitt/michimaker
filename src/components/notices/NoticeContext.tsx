import {createContext, type ReactNode, use, useCallback, useEffect, useMemo, useRef, useState} from "react";

export type NoticeKind = "info" | "success" | "error";

export interface NoticeAction {
    label: string;
    onAction: () => void;
}

export interface Notice {
    id: number;
    kind: NoticeKind;
    message: string;
    action: NoticeAction | null;
}

interface NoticeActions {
    showNotice: (message: string, kind?: NoticeKind, action?: NoticeAction) => void;
    dismissNotice: (id: number) => void;
}

const NoticeListContext = createContext<Notice[] | null>(null);
const NoticeActionsContext = createContext<NoticeActions | null>(null);

const AUTO_DISMISS_MS = 6000;
const AUTO_DISMISS_WITH_ACTION_MS = 15000;

export function NoticeProvider({children}: { children: ReactNode }) {
    const [notices, setNotices] = useState<Notice[]>([]);
    const nextIdRef = useRef(1);
    const timeoutsRef = useRef(new Map<number, number>());

    useEffect(() => {
        const timeouts = timeoutsRef.current;
        return () => timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    }, []);

    const dismissNotice = useCallback((id: number) => {
        window.clearTimeout(timeoutsRef.current.get(id));
        timeoutsRef.current.delete(id);
        setNotices((current) => current.filter((notice) => notice.id !== id));
    }, []);

    const showNotice = useCallback(
        (message: string, kind: NoticeKind = "info", action?: NoticeAction) => {
            const id = nextIdRef.current++;
            setNotices((current) => [...current, {id, kind, message, action: action ?? null}]);
            const delay = action === undefined ? AUTO_DISMISS_MS : AUTO_DISMISS_WITH_ACTION_MS;
            timeoutsRef.current.set(id, window.setTimeout(() => dismissNotice(id), delay));
        },
        [dismissNotice]
    );

    const actions = useMemo(() => ({showNotice, dismissNotice}), [showNotice, dismissNotice]);

    return (
        <NoticeActionsContext value={actions}>
            <NoticeListContext value={notices}>{children}</NoticeListContext>
        </NoticeActionsContext>
    );
}

export function useNotices(): NoticeActions {
    const value = use(NoticeActionsContext);
    if (value === null) {
        throw new Error("useNotices must be used inside a NoticeProvider");
    }
    return value;
}

export function useNoticeList(): Notice[] {
    const value = use(NoticeListContext);
    if (value === null) {
        throw new Error("useNoticeList must be used inside a NoticeProvider");
    }
    return value;
}

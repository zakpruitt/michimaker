import {createContext, type ReactNode, use, useCallback, useMemo, useRef, useState,} from "react";

export type NoticeKind = "info" | "success" | "error";

export interface Notice {
    id: number;
    kind: NoticeKind;
    message: string;
}

interface NoticeContextValue {
    notices: Notice[];
    showNotice: (message: string, kind?: NoticeKind) => void;
    dismissNotice: (id: number) => void;
}

const NoticeContext = createContext<NoticeContextValue | null>(null);

const AUTO_DISMISS_MS = 6000;

export function NoticeProvider({children}: { children: ReactNode }) {
    const [notices, setNotices] = useState<Notice[]>([]);
    const nextIdRef = useRef(1);

    const dismissNotice = useCallback((id: number) => {
        setNotices((current) => current.filter((notice) => notice.id !== id));
    }, []);

    const showNotice = useCallback(
        (message: string, kind: NoticeKind = "info") => {
            const id = nextIdRef.current++;
            setNotices((current) => [...current, {id, kind, message}]);
            window.setTimeout(() => dismissNotice(id), AUTO_DISMISS_MS);
        },
        [dismissNotice]
    );

    const value = useMemo(
        () => ({notices, showNotice, dismissNotice}),
        [notices, showNotice, dismissNotice]
    );

    return <NoticeContext value={value}>{children}</NoticeContext>;
}

export function useNotices(): NoticeContextValue {
    const value = use(NoticeContext);
    if (value === null) {
        throw new Error("useNotices must be used inside a NoticeProvider");
    }
    return value;
}

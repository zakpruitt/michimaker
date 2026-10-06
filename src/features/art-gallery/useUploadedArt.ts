import {useCallback, useEffect, useRef, useState} from "react";
import type {ArtPiece} from "../../types/art";
import {useNotices} from "../../components/notices/NoticeContext";
import {deleteUpload, loadUploads, saveUploads} from "./uploadStore";

const STORAGE_UNAVAILABLE_MESSAGE =
    "Uploads can't be saved in this browser (storage is blocked or full), so they will disappear when you close the tab. Art you have placed is still saved with your binder.";

export function useUploadedArt() {
    const {showNotice} = useNotices();
    const [uploads, setUploads] = useState<ArtPiece[]>([]);
    const warnedRef = useRef(false);

    const warnUnavailable = useCallback(() => {
        if (!warnedRef.current) {
            warnedRef.current = true;
            showNotice(STORAGE_UNAVAILABLE_MESSAGE, "error");
        }
    }, [showNotice]);

    useEffect(() => {
        let cancelled = false;
        loadUploads().then(
            (stored) => {
                if (!cancelled) {
                    setUploads((current) => [
                        ...current,
                        ...stored.filter((piece) => !current.some((existing) => existing.id === piece.id)),
                    ]);
                }
            },
            () => {
                if (!cancelled) {
                    warnUnavailable();
                }
            }
        );
        return () => {
            cancelled = true;
        };
    }, [warnUnavailable]);

    const addUploads = useCallback(
        (pieces: ArtPiece[]) => {
            setUploads((current) => [...pieces, ...current.filter((existing) => !pieces.some((piece) => piece.id === existing.id))]);
            saveUploads(pieces).catch(warnUnavailable);
        },
        [warnUnavailable]
    );

    const removeUpload = useCallback(
        (id: string) => {
            setUploads((current) => current.filter((piece) => piece.id !== id));
            deleteUpload(id).catch(warnUnavailable);
        },
        [warnUnavailable]
    );

    return {uploads, addUploads, removeUpload};
}

import {type ChangeEvent, useRef, useState} from "react";
import {GITHUB_REPO_URL} from "../../appLinks";
import {useBinderActions, useBinderState} from "../binder/BinderContext";
import {usePrintDialog} from "../print/PrintContext";
import {useNotices} from "../../components/notices/NoticeContext";
import {BinderDecodeError} from "./binderCodec";
import {downloadBinderAsFile, readBinderFromFile} from "./fileTransfer";
import {buildShareUrl, SHARE_URL_LENGTH_WARNING} from "./shareLink";
import styles from "./BinderToolbar.module.css";

export function BinderToolbar() {
    const {binder} = useBinderState();
    const {replaceBinder, resetBinder, setPocketColumns} = useBinderActions();
    const {showNotice} = useNotices();
    const openPrintDialog = usePrintDialog();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isConfirmingReset, setIsConfirmingReset] = useState(false);

    async function handleCopyShareLink() {
        const url = buildShareUrl(binder);
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            showNotice("Could not access the clipboard. Use “Export file” instead.", "error");
            return;
        }
        if (url.length > SHARE_URL_LENGTH_WARNING) {
            showNotice(
                "Share link copied, but it is very long (uploaded images travel inside it). If it breaks when pasted, use “Export file” instead.",
                "info"
            );
        } else {
            showNotice("Share link copied to clipboard.", "success");
        }
    }

    function handleExportFile() {
        downloadBinderAsFile(binder);
        showNotice("Binder downloaded as a .json file.", "success");
    }

    async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file === undefined) {
            return;
        }
        try {
            const imported = await readBinderFromFile(file);
            replaceBinder(imported);
            showNotice(`Imported binder from ${file.name}.`, "success");
        } catch (error) {
            const message =
                error instanceof BinderDecodeError
                    ? error.message
                    : "That file is not a binder export.";
            showNotice(message, "error");
        }
    }

    function handleResetClick() {
        if (!isConfirmingReset) {
            setIsConfirmingReset(true);
            // Disarm automatically if the user doesn't confirm.
            window.setTimeout(() => setIsConfirmingReset(false), 4000);
            return;
        }
        setIsConfirmingReset(false);
        resetBinder();
        showNotice("Started a fresh binder.", "info");
    }

    return (
        <div className={styles.toolbar} data-print="hide">
            <div
                className={styles.layoutToggle}
                role="group"
                aria-label="Pockets per page"
                title="Pockets per page"
            >
                <button
                    type="button"
                    className={binder.pocketColumns === 3 ? styles.layoutActive : undefined}
                    onClick={() => setPocketColumns(3)}
                >
                    9
                </button>
                <button
                    type="button"
                    className={binder.pocketColumns === 4 ? styles.layoutActive : undefined}
                    onClick={() => setPocketColumns(4)}
                >
                    12
                </button>
            </div>

            <div className={styles.buttonGroup}>
                <button type="button" onClick={handleCopyShareLink} title="Copy a share link to the clipboard">
                    Share
                </button>
                <button type="button" onClick={handleExportFile} title="Download the binder as a .json file">
                    Export
                </button>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Load a binder from a .json file"
                >
                    Import
                </button>
            </div>

            <button
                type="button"
                className={styles.printButton}
                onClick={openPrintDialog}
                title="Print the cut guide"
            >
                Print
            </button>

            <button
                type="button"
                className={isConfirmingReset ? `${styles.newButton} ${styles.resetArmed}` : styles.newButton}
                onClick={handleResetClick}
                title="Start a fresh binder"
            >
                {isConfirmingReset ? "Really start over?" : "New binder"}
            </button>

            <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className={styles.hiddenInput}
                onChange={handleImportFileChange}
            />

            <div className={styles.iconLinks}>
                <a className={styles.iconButton} href="#/how-to" title="How to use" aria-label="How to use">
                    ?
                </a>
                <a
                    className={styles.iconButton}
                    href={GITHUB_REPO_URL}
                    target="_blank"
                    rel="noreferrer"
                    title="View on GitHub"
                    aria-label="View on GitHub"
                >
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <path
                            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                </a>
            </div>
        </div>
    );
}

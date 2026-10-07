import {createContext, type ReactNode, use, useCallback, useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {resolveArtImageUrl} from "../../artImageUrl";
import {PAPER_SPECS} from "./paper";
import {PrintDialog} from "./PrintDialog";
import {listPrintCells, type PrintLayout} from "./printLayout";
import {PrintSheets} from "./PrintSheets";

const IMAGE_WAIT_TIMEOUT_MS = 15000;
const PRINTING_BODY_CLASS = "michimaker-printing";

const OpenPrintDialogContext = createContext<(() => void) | null>(null);

export function usePrintDialog(): () => void {
    const openDialog = use(OpenPrintDialogContext);
    if (openDialog === null) {
        throw new Error("usePrintDialog must be used within PrintProvider");
    }
    return openDialog;
}

export function PrintProvider({children}: { children: ReactNode }) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [printLayout, setPrintLayout] = useState<PrintLayout | null>(null);
    const printRootRef = useRef<HTMLDivElement>(null);

    const openDialog = useCallback(() => setIsDialogOpen(true), []);

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
                event.preventDefault();
                setIsDialogOpen(true);
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    useEffect(() => {
        if (printLayout === null) {
            return;
        }
        document.body.classList.add(PRINTING_BODY_CLASS);
        let cancelled = false;
        void waitForPrintImages(printRootRef.current, printLayout).then(() => {
            if (!cancelled) {
                window.print();
                setPrintLayout(null);
            }
        });
        return () => {
            cancelled = true;
            document.body.classList.remove(PRINTING_BODY_CLASS);
        };
    }, [printLayout]);

    return (
        <OpenPrintDialogContext value={openDialog}>
            {children}
            {isDialogOpen && (
                <PrintDialog
                    onClose={() => setIsDialogOpen(false)}
                    onPrint={(layout) => {
                        setIsDialogOpen(false);
                        setPrintLayout(layout);
                    }}
                />
            )}
            {printLayout !== null &&
                createPortal(
                    <div data-print-root="" ref={printRootRef}>
                        <style>
                            {`@page { size: ${PAPER_SPECS[printLayout.paper].cssName} ${printLayout.orientation}; margin: ${printLayout.marginMm}mm; }`}
                        </style>
                        <PrintSheets layout={printLayout}/>
                    </div>,
                    document.body
                )}
        </OpenPrintDialogContext>
    );
}

async function waitForPrintImages(root: HTMLElement | null, layout: PrintLayout): Promise<void> {
    const imageElements = root === null ? [] : [...root.querySelectorAll("img")];
    const artUrls = new Set(
        listPrintCells(layout).flatMap((cell) =>
            cell.content.kind === "art" ? [resolveArtImageUrl(cell.content.placement.art)] : []
        )
    );
    const pending = [
        ...imageElements.map((image) => image.decode()),
        ...[...artUrls].map((url) => {
            const image = new Image();
            image.src = url;
            return image.decode();
        }),
    ].map((promise) => promise.catch(() => undefined));
    const timeout = new Promise((resolve) => window.setTimeout(resolve, IMAGE_WAIT_TIMEOUT_MS));
    await Promise.race([Promise.all(pending), timeout]);
}

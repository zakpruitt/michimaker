import {createContext, type ReactNode, useCallback, useContext, useEffect, useState,} from "react";
import {ArtOnlyPrintSheets} from "./ArtOnlyPrintSheets";
import {PrintDialog} from "./PrintDialog";
import {PrintPageSetup} from "./PrintPageSetup";

export interface PrintOptions {
    /** "pages": the classic per-page cut guide. "art-only": packed art sheets. */
    mode: "pages" | "art-only";
    /** Which binder pages to include. */
    pageIndexes: number[] | "all";
    /** Print side-by-side art on the same page as one uncut strip. */
    connectStrips: boolean;
}

const OpenPrintDialogContext = createContext<(() => void) | null>(null);
const ActivePrintContext = createContext<PrintOptions | null>(null);

/** The toolbar uses this to open the print dialog. */
export function usePrintDialog(): () => void {
    const openDialog = useContext(OpenPrintDialogContext);
    if (openDialog === null) {
        throw new Error("usePrintDialog must be used within PrintProvider");
    }
    return openDialog;
}

/** Options of the print job in progress, or null when not printing. */
export function useActivePrintOptions(): PrintOptions | null {
    return useContext(ActivePrintContext);
}

export function PrintProvider({children}: { children: ReactNode }) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [activeOptions, setActiveOptions] = useState<PrintOptions | null>(null);

    const openDialog = useCallback(() => setIsDialogOpen(true), []);

    useEffect(() => {
        if (activeOptions === null) {
            return;
        }
        const bodyClasses = document.body.classList;
        if (!activeOptions.connectStrips) {
            bodyClasses.add("print-cut-all");
        }
        if (activeOptions.mode === "art-only") {
            bodyClasses.add("print-art-only");
        }

        // Two frames so the hidden pages / art sheets are painted before the
        // print dialog snapshots the document. window.print() blocks until the
        // browser dialog closes, after which the job state resets.
        let cancelled = false;
        const frame = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (cancelled) {
                    return;
                }
                window.print();
                setActiveOptions(null);
            });
        });

        return () => {
            cancelled = true;
            cancelAnimationFrame(frame);
            bodyClasses.remove("print-cut-all", "print-art-only");
        };
    }, [activeOptions]);

    return (
        <OpenPrintDialogContext.Provider value={openDialog}>
            <ActivePrintContext.Provider value={activeOptions}>
                {children}
                <PrintPageSetup/>
                {isDialogOpen && (
                    <PrintDialog
                        onCancel={() => setIsDialogOpen(false)}
                        onConfirm={(options) => {
                            setIsDialogOpen(false);
                            setActiveOptions(options);
                        }}
                    />
                )}
                {activeOptions !== null && activeOptions.mode === "art-only" && (
                    <ArtOnlyPrintSheets pageIndexes={activeOptions.pageIndexes}/>
                )}
            </ActivePrintContext.Provider>
        </OpenPrintDialogContext.Provider>
    );
}

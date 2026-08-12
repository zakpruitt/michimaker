import {createContext, type ReactNode, use, useCallback, useEffect, useState,} from "react";
import {ArtOnlyPrintSheets} from "./ArtOnlyPrintSheets";
import {PrintDialog} from "./PrintDialog";
import {PrintPageSetup} from "./PrintPageSetup";

export interface PrintOptions {
    mode: "pages" | "art-only";
    pageIndexes: number[] | "all";
    connectStrips: boolean;
}

const OpenPrintDialogContext = createContext<(() => void) | null>(null);
const ActivePrintContext = createContext<PrintOptions | null>(null);

export function usePrintDialog(): () => void {
    const openDialog = use(OpenPrintDialogContext);
    if (openDialog === null) {
        throw new Error("usePrintDialog must be used within PrintProvider");
    }
    return openDialog;
}

export function useActivePrintOptions(): PrintOptions | null {
    return use(ActivePrintContext);
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
        <OpenPrintDialogContext value={openDialog}>
            <ActivePrintContext value={activeOptions}>
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
            </ActivePrintContext>
        </OpenPrintDialogContext>
    );
}

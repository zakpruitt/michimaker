import {guessPaperSize, type PaperSize} from "./paper";
import type {PrintJob} from "./printLayout";

const PREFERENCES_STORAGE_KEY = "michimaker.print.preferences";
const LEGACY_PAPER_STORAGE_KEY = "michimaker.print.paper";

export interface PrintPreferences {
    paper: PaperSize;
    job: PrintJob | null;
    grayscaleCards: boolean;
}

export function loadPrintPreferences(): PrintPreferences {
    const defaults: PrintPreferences = {paper: guessPaperSize(), job: null, grayscaleCards: false};
    try {
        const legacyPaper = window.localStorage.getItem(LEGACY_PAPER_STORAGE_KEY);
        const stored = JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? "{}") as Partial<
            Record<keyof PrintPreferences, unknown>
        >;
        const paper = stored.paper ?? legacyPaper;
        return {
            paper: paper === "letter" || paper === "a4" ? paper : defaults.paper,
            job: stored.job === "art" || stored.job === "proxies" || stored.job === "pages" ? stored.job : null,
            grayscaleCards: stored.grayscaleCards === true,
        };
    } catch {
        return defaults;
    }
}

export function savePrintPreferences(preferences: PrintPreferences): void {
    try {
        window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
        window.localStorage.removeItem(LEGACY_PAPER_STORAGE_KEY);
    } catch {
        return;
    }
}

export type PaperSize = "letter" | "a4";
export type Orientation = "portrait" | "landscape";

export interface PaperSpec {
    label: string;
    cssName: string;
    widthMm: number;
    heightMm: number;
}

export const PAPER_SPECS: Record<PaperSize, PaperSpec> = {
    letter: {label: "US Letter", cssName: "letter", widthMm: 215.9, heightMm: 279.4},
    a4: {label: "A4", cssName: "A4", widthMm: 210, heightMm: 297},
};

export const PRINT_MARGIN_MM = 5;

const LETTER_REGIONS = new Set(["US", "CA", "MX", "PH", "CL", "CO", "VE", "GT", "CR", "PR"]);

export function pageSizeMm(paper: PaperSize, orientation: Orientation): {widthMm: number; heightMm: number} {
    const {widthMm, heightMm} = PAPER_SPECS[paper];
    return orientation === "portrait" ? {widthMm, heightMm} : {widthMm: heightMm, heightMm: widthMm};
}

export function guessPaperSize(): PaperSize {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return region !== undefined && LETTER_REGIONS.has(region) ? "letter" : "a4";
}

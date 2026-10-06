import type {CardSummary} from "./card";
import type {ArtPiece} from "./art";

export const ROWS_PER_PAGE = 3;

export type PocketColumns = 3 | 4;

export const DEFAULT_POCKET_COLUMNS: PocketColumns = 3;

export function pocketsPerPage(columns: PocketColumns): number {
    return ROWS_PER_PAGE * columns;
}

export const POCKET_WIDTH_MM = 63;
export const POCKET_HEIGHT_MM = 88;

export interface PocketGap {
    xMm: number;
    yMm: number;
}

export const DEFAULT_POCKET_GAP: PocketGap = {xMm: 7, yMm: 7};
export const MAX_POCKET_GAP_MM = 25;

export function artSpanSizeMm(rect: GridRect, gap: PocketGap): {widthMm: number; heightMm: number} {
    return {
        widthMm: rect.columnCount * POCKET_WIDTH_MM + (rect.columnCount - 1) * gap.xMm,
        heightMm: rect.rowCount * POCKET_HEIGHT_MM + (rect.rowCount - 1) * gap.yMm,
    };
}

export function artCellOffsetMm(rowOffset: number, columnOffset: number, gap: PocketGap): {leftMm: number; topMm: number} {
    return {
        leftMm: columnOffset * (POCKET_WIDTH_MM + gap.xMm),
        topMm: rowOffset * (POCKET_HEIGHT_MM + gap.yMm),
    };
}

export interface PocketRef {
    pageIndex: number;
    row: number;
    column: number;
}

export interface GridRect {
    pageIndex: number;
    row: number;
    column: number;
    rowCount: number;
    columnCount: number;
}

export interface ArtCrop {
    zoom: number;
    panX: number;
    panY: number;
}

export const DEFAULT_ART_CROP: ArtCrop = {zoom: 1, panX: 0, panY: 0};

export const MIN_ART_ZOOM = 1;
export const MAX_ART_ZOOM = 4;

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, value));
}

export function normalizeArtCrop(value: unknown): ArtCrop {
    if (typeof value !== "object" || value === null) {
        return DEFAULT_ART_CROP;
    }
    const crop = value as Partial<ArtCrop>;
    return {
        zoom: clampNumber(crop.zoom, MIN_ART_ZOOM, MAX_ART_ZOOM, DEFAULT_ART_CROP.zoom),
        panX: clampNumber(crop.panX, -1, 1, DEFAULT_ART_CROP.panX),
        panY: clampNumber(crop.panY, -1, 1, DEFAULT_ART_CROP.panY),
    };
}

export function normalizePocketGap(value: unknown): PocketGap {
    if (typeof value !== "object" || value === null) {
        return DEFAULT_POCKET_GAP;
    }
    const gap = value as Partial<PocketGap>;
    return {
        xMm: clampNumber(gap.xMm, 0, MAX_POCKET_GAP_MM, DEFAULT_POCKET_GAP.xMm),
        yMm: clampNumber(gap.yMm, 0, MAX_POCKET_GAP_MM, DEFAULT_POCKET_GAP.yMm),
    };
}

export interface ArtPlacement {
    id: string;
    art: ArtPiece;
    rect: GridRect;
    crop: ArtCrop;
}

export interface BinderPageData {
    pockets: (CardSummary | null)[];
}

export const DEFAULT_BINDER_TITLE = "My Michi Binder";

export interface Binder {
    title: string;
    pocketColumns: PocketColumns;
    pocketGap: PocketGap;
    pages: BinderPageData[];
    artPlacements: ArtPlacement[];
}

export type PocketContent =
    | { kind: "empty" }
    | { kind: "card"; card: CardSummary }
    | {
    kind: "art";
    placement: ArtPlacement;
    rowOffset: number;
    columnOffset: number;
    holes: ReadonlySet<string>;
};

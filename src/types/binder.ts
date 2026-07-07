import type {CardSummary} from "./card";
import type {ArtPiece} from "./art";

export const ROWS_PER_PAGE = 3;

/** Columns per page: 3 for 9-pocket binders, 4 for 12-pocket binders. */
export type PocketColumns = 3 | 4;

export const DEFAULT_POCKET_COLUMNS: PocketColumns = 3;

export function pocketsPerPage(columns: PocketColumns): number {
    return ROWS_PER_PAGE * columns;
}

/** Physical pocket size, the reference unit for span math and the printed cut guide. */
export const POCKET_WIDTH_MM = 63;
export const POCKET_HEIGHT_MM = 88;

/** Address of a single pocket in the binder. */
export interface PocketRef {
    pageIndex: number;
    /** 0..2, top to bottom. */
    row: number;
    /** 0..2, left to right within the page. */
    column: number;
}

/**
 * A rectangular block of pockets anchored at its top-left pocket. column +
 * columnCount may exceed the page width only on a left-hand (odd-index) page:
 * the overflow continues across the gutter onto pageIndex + 1.
 */
export interface GridRect {
    pageIndex: number;
    row: number;
    column: number;
    rowCount: number;
    columnCount: number;
}

/** One piece of art assigned to a rectangular span of pockets. */
export interface ArtPlacement {
    id: string;
    art: ArtPiece;
    rect: GridRect;
}

/** A single binder page. Pockets hold a card or null (empty). */
export interface BinderPageData {
    /** Row-major, pocketsPerPage entries. Pockets under art are null here; art lives in artPlacements. */
    pockets: (CardSummary | null)[];
}

/** Cover title used until the owner renames their binder. */
export const DEFAULT_BINDER_TITLE = "My Michi Binder";

/** The whole binder: what gets persisted, shared, and printed. */
export interface Binder {
    /** Shown on the inside of the front cover, e.g. "Zak's Michi Binder". */
    title: string;
    /** 3 = 9-pocket pages, 4 = 12-pocket pages. Applies to every page. */
    pocketColumns: PocketColumns;
    pages: BinderPageData[];
    artPlacements: ArtPlacement[];
}

/** For art, the offsets pick which cell of the placement's rect this pocket crops. */
export type PocketContent =
    | { kind: "empty" }
    | { kind: "card"; card: CardSummary }
    | { kind: "art"; placement: ArtPlacement; rowOffset: number; columnOffset: number };

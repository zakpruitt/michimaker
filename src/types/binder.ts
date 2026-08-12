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

export interface ArtPlacement {
    id: string;
    art: ArtPiece;
    rect: GridRect;
}

export interface BinderPageData {
    pockets: (CardSummary | null)[];
}

export const DEFAULT_BINDER_TITLE = "My Michi Binder";

export interface Binder {
    title: string;
    pocketColumns: PocketColumns;
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

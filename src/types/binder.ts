/**
 * Core domain model for the binder itself: pages, pockets, and art spans.
 *
 * Coordinate system
 * -----------------
 * Pages are stored in reading order and pair up the way a real binder opens:
 * page 0 sits alone on the right of the first spread (facing the inside of
 * the front cover), then pages (1,2) face each other, then (3,4), etc. Left
 * pages are therefore the odd-indexed ones. Within a page, pockets form a
 * grid addressed by (row, column), both 0-based, row-major: always 3 rows,
 * and 3 or 4 columns depending on the binder's pocket layout (9-pocket vs
 * 12-pocket pages).
 *
 * An art span (GridRect) is anchored to one page but its columns may overflow
 * past the right edge of a left-hand (odd-index) page, in which case it
 * continues onto the facing page. That is how "Michi method" art crosses the
 * binder's center gutter. Page 0 has no left-hand partner, so spans anchored
 * there can never cross.
 */
import type { CardSummary } from "./card";
import type { ArtPiece } from "./art";

export const ROWS_PER_PAGE = 3;

/** Columns per page: 3 for 9-pocket binders, 4 for 12-pocket binders. */
export type PocketColumns = 3 | 4;

export const DEFAULT_POCKET_COLUMNS: PocketColumns = 3;

export function pocketsPerPage(columns: PocketColumns): number {
  return ROWS_PER_PAGE * columns;
}

/**
 * Physical size of a standard 9-pocket-page trading card pocket, used as the
 * reference unit for all span math and for the printable cut guide.
 */
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
 * A rectangular block of pockets.
 *
 * (pageIndex, row, column) is the top-left pocket. column + columnCount may
 * exceed the binder's column count only when pageIndex is a left-hand
 * (odd-index) page, meaning the rectangle continues across the gutter onto
 * the facing page (raw columns past the page edge land on the same columns
 * of pageIndex + 1, shifted back by the page width).
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
  /**
   * Exactly pocketsPerPage(binder.pocketColumns) entries, row-major
   * (index = row * columns + column). A pocket covered by an art placement
   * is also null here; art occupancy lives in Binder.artPlacements, not in
   * the page.
   */
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

/**
 * Resolved content of a single pocket, derived from a Binder by
 * buildPocketContentMap (features/binder/gridMath.ts). For art, the offsets
 * say which cell of the placement's rectangle this pocket shows, so the
 * renderer can crop the right slice of the image.
 */
export type PocketContent =
  | { kind: "empty" }
  | { kind: "card"; card: CardSummary }
  | { kind: "art"; placement: ArtPlacement; rowOffset: number; columnOffset: number };

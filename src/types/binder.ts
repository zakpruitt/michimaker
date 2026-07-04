/**
 * Core domain model for the binder itself: pages, pockets, and art spans.
 *
 * Coordinate system
 * -----------------
 * Pages are stored in reading order and pair up the way a real binder opens:
 * page 0 sits alone on the right of the first spread (facing the inside of
 * the front cover), then pages (1,2) face each other, then (3,4), etc. Left
 * pages are therefore the odd-indexed ones. Within a page, pockets form a
 * 3×3 grid addressed by (row, column), both 0-based, row-major.
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
export const COLUMNS_PER_PAGE = 3;
export const POCKETS_PER_PAGE = ROWS_PER_PAGE * COLUMNS_PER_PAGE;

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
 * exceed 3 only when pageIndex is a left-hand (odd-index) page, meaning the
 * rectangle continues across the gutter onto the facing page (columns 3..5
 * land on columns 0..2 of pageIndex + 1).
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

/** A single 9-pocket binder page. Pockets hold a card or null (empty). */
export interface BinderPageData {
  /**
   * Exactly POCKETS_PER_PAGE entries, row-major (index = row * 3 + column).
   * A pocket covered by an art placement is also null here; art occupancy
   * lives in Binder.artPlacements, not in the page.
   */
  pockets: (CardSummary | null)[];
}

/** Cover title used until the owner renames their binder. */
export const DEFAULT_BINDER_TITLE = "My Michi Binder";

/** The whole binder: what gets persisted, shared, and printed. */
export interface Binder {
  /** Shown on the inside of the front cover, e.g. "Zak's Michi Binder". */
  title: string;
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

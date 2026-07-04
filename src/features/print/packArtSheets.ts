/**
 * Pure math for the ink-saving "art only" print mode: turn the binder's art
 * placements into printable pieces and pack them onto as few A4 sheets as
 * possible.
 *
 * A placement that crosses the spread gutter lands in two different physical
 * binder pages, so it always needs a cut at the gutter anyway. We therefore
 * split it into one piece per page up front; every piece is then at most
 * 3 columns x 3 rows (189mm x 264mm), which is guaranteed to fit on one A4
 * sheet inside the print margins.
 *
 * Packing uses a simple shelf algorithm: sort pieces tallest-first, fill a
 * horizontal shelf left to right, start a new shelf below when a piece does
 * not fit, and a new sheet when the shelf would run off the page. Not
 * optimal, but predictable and close enough for at most a few dozen pieces.
 */
import {
  COLUMNS_PER_PAGE,
  POCKET_HEIGHT_MM,
  POCKET_WIDTH_MM,
  type ArtPlacement,
} from "../../types/binder";

/** Usable A4 area inside the @page 8mm margins, minus a rounding cushion. */
export const SHEET_WIDTH_MM = 193;
export const SHEET_HEIGHT_MM = 278;

/** Height reserved above each piece for its "Page N" assembly label. */
export const PIECE_LABEL_HEIGHT_MM = 6;

/** Breathing room between packed pieces so their cut lines stay distinct. */
const PIECE_SPACING_MM = 4;

/** The part of one art placement that lands on a single binder page. */
export interface ArtSheetPiece {
  placement: ArtPlacement;
  /** The binder page this piece slides into once cut. */
  pageIndex: number;
  /** Inclusive column-offset range within the placement's rect. */
  columnOffsetStart: number;
  columnOffsetEnd: number;
  widthMm: number;
  /** Height of the art itself; the label strip comes on top of this. */
  heightMm: number;
}

/** A piece with its top-left position (label included) on a sheet. */
export interface PositionedPiece {
  piece: ArtSheetPiece;
  xMm: number;
  yMm: number;
}

export interface ArtSheet {
  pieces: PositionedPiece[];
}

/**
 * Split placements into per-page pieces, keeping only pieces whose target
 * page is in `pageIndexes` ("all" keeps everything).
 */
export function splitPlacementsIntoPieces(
  placements: ArtPlacement[],
  pageIndexes: number[] | "all"
): ArtSheetPiece[] {
  const pieces: ArtSheetPiece[] = [];

  for (const placement of placements) {
    const rect = placement.rect;
    // Column offsets on the anchor page vs. the facing page (absolute
    // columns 3..5 continue past the gutter).
    const anchorPageOffsets: number[] = [];
    const facingPageOffsets: number[] = [];
    for (let offset = 0; offset < rect.columnCount; offset++) {
      if (rect.column + offset < COLUMNS_PER_PAGE) {
        anchorPageOffsets.push(offset);
      } else {
        facingPageOffsets.push(offset);
      }
    }

    const parts: { pageIndex: number; offsets: number[] }[] = [
      { pageIndex: rect.pageIndex, offsets: anchorPageOffsets },
      { pageIndex: rect.pageIndex + 1, offsets: facingPageOffsets },
    ];

    for (const part of parts) {
      if (part.offsets.length === 0) {
        continue;
      }
      if (pageIndexes !== "all" && !pageIndexes.includes(part.pageIndex)) {
        continue;
      }
      pieces.push({
        placement,
        pageIndex: part.pageIndex,
        columnOffsetStart: part.offsets[0],
        columnOffsetEnd: part.offsets[part.offsets.length - 1],
        widthMm: part.offsets.length * POCKET_WIDTH_MM,
        heightMm: rect.rowCount * POCKET_HEIGHT_MM,
      });
    }
  }

  return pieces;
}

/** Shelf-pack pieces onto sheets. Piece heights include the label strip. */
export function packPiecesIntoSheets(pieces: ArtSheetPiece[]): ArtSheet[] {
  const sorted = [...pieces].sort(
    (a, b) => b.heightMm - a.heightMm || b.widthMm - a.widthMm
  );

  const sheets: ArtSheet[] = [];
  let current: ArtSheet | null = null;
  let shelfTopMm = 0;
  let shelfHeightMm = 0;
  let cursorXMm = 0;

  for (const piece of sorted) {
    const totalHeightMm = piece.heightMm + PIECE_LABEL_HEIGHT_MM;

    const fitsOnShelf =
      current !== null && cursorXMm + piece.widthMm <= SHEET_WIDTH_MM;
    if (!fitsOnShelf) {
      // Move down to a fresh shelf; open a fresh sheet if it will not fit.
      shelfTopMm = current === null ? 0 : shelfTopMm + shelfHeightMm + PIECE_SPACING_MM;
      if (current === null || shelfTopMm + totalHeightMm > SHEET_HEIGHT_MM) {
        current = { pieces: [] };
        sheets.push(current);
        shelfTopMm = 0;
      }
      cursorXMm = 0;
      shelfHeightMm = 0;
    }

    current!.pieces.push({ piece, xMm: cursorXMm, yMm: shelfTopMm });
    cursorXMm += piece.widthMm + PIECE_SPACING_MM;
    shelfHeightMm = Math.max(shelfHeightMm, totalHeightMm);
  }

  return sheets;
}

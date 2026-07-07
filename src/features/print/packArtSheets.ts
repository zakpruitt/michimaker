import {type ArtPlacement, POCKET_HEIGHT_MM, POCKET_WIDTH_MM, type PocketColumns,} from "../../types/binder";

/** Usable A4 area inside the @page 8mm margins, minus a rounding cushion. */
export interface SheetDimensions {
    widthMm: number;
    heightMm: number;
}

/** 12-pocket rows (252mm) only fit A4 sideways; PrintPageSetup.tsx switches
 *  the @page orientation to match. */
export function sheetDimensionsFor(columns: PocketColumns): SheetDimensions {
    return columns === 4
        ? {widthMm: 278, heightMm: 186} // A4 landscape
        : {widthMm: 193, heightMm: 278}; // A4 portrait
}

/** Height reserved above each piece for its "Page N" assembly label. */
export const PIECE_LABEL_HEIGHT_MM = 6;

/** Breathing room between packed pieces so their cut lines stay distinct. */
const PIECE_SPACING_MM = 4;

/** The part of one art placement on a single binder page, chunked by rows. */
export interface ArtSheetPiece {
    placement: ArtPlacement;
    /** The binder page this piece slides into once cut. */
    pageIndex: number;
    /** Inclusive column-offset range within the placement's rect. */
    columnOffsetStart: number;
    columnOffsetEnd: number;
    /** Inclusive row-offset range within the placement's rect. */
    rowOffsetStart: number;
    rowOffsetEnd: number;
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

/** Splits placements into per-page, sheet-height pieces for the pages in pageIndexes. */
export function splitPlacementsIntoPieces(
    placements: ArtPlacement[],
    pageIndexes: number[] | "all",
    columns: PocketColumns
): ArtSheetPiece[] {
    const sheet = sheetDimensionsFor(columns);
    const maxRowsPerPiece = Math.max(
        1,
        Math.floor((sheet.heightMm - PIECE_LABEL_HEIGHT_MM) / POCKET_HEIGHT_MM)
    );
    const pieces: ArtSheetPiece[] = [];

    for (const placement of placements) {
        const rect = placement.rect;
        // Column offsets on the anchor page vs. the facing page (absolute
        // columns past the page edge continue across the gutter).
        const anchorPageOffsets: number[] = [];
        const facingPageOffsets: number[] = [];
        for (let offset = 0; offset < rect.columnCount; offset++) {
            if (rect.column + offset < columns) {
                anchorPageOffsets.push(offset);
            } else {
                facingPageOffsets.push(offset);
            }
        }

        const parts: { pageIndex: number; offsets: number[] }[] = [
            {pageIndex: rect.pageIndex, offsets: anchorPageOffsets},
            {pageIndex: rect.pageIndex + 1, offsets: facingPageOffsets},
        ];

        for (const part of parts) {
            if (part.offsets.length === 0) {
                continue;
            }
            if (pageIndexes !== "all" && !pageIndexes.includes(part.pageIndex)) {
                continue;
            }
            // Chunk the rows so every piece fits the sheet height.
            for (
                let rowStart = 0;
                rowStart < rect.rowCount;
                rowStart += maxRowsPerPiece
            ) {
                const rowEnd = Math.min(rowStart + maxRowsPerPiece, rect.rowCount) - 1;
                pieces.push({
                    placement,
                    pageIndex: part.pageIndex,
                    columnOffsetStart: part.offsets[0],
                    columnOffsetEnd: part.offsets[part.offsets.length - 1],
                    rowOffsetStart: rowStart,
                    rowOffsetEnd: rowEnd,
                    widthMm: part.offsets.length * POCKET_WIDTH_MM,
                    heightMm: (rowEnd - rowStart + 1) * POCKET_HEIGHT_MM,
                });
            }
        }
    }

    return pieces;
}

/** Shelf-pack pieces onto sheets. Piece heights include the label strip. */
export function packPiecesIntoSheets(
    pieces: ArtSheetPiece[],
    sheet: SheetDimensions
): ArtSheet[] {
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
            current !== null && cursorXMm + piece.widthMm <= sheet.widthMm;
        if (!fitsOnShelf) {
            // Move down to a fresh shelf; open a fresh sheet if it will not fit.
            shelfTopMm = current === null ? 0 : shelfTopMm + shelfHeightMm + PIECE_SPACING_MM;
            if (current === null || shelfTopMm + totalHeightMm > sheet.heightMm) {
                current = {pieces: []};
                sheets.push(current);
                shelfTopMm = 0;
            }
            cursorXMm = 0;
            shelfHeightMm = 0;
        }

        current!.pieces.push({piece, xMm: cursorXMm, yMm: shelfTopMm});
        cursorXMm += piece.widthMm + PIECE_SPACING_MM;
        shelfHeightMm = Math.max(shelfHeightMm, totalHeightMm);
    }

    return sheets;
}

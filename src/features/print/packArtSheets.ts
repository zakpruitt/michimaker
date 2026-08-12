import {type ArtPlacement, POCKET_HEIGHT_MM, POCKET_WIDTH_MM, type PocketColumns,} from "../../types/binder";

export interface SheetDimensions {
    widthMm: number;
    heightMm: number;
}

export function sheetDimensionsFor(columns: PocketColumns): SheetDimensions {
    return columns === 4
        ? {widthMm: 278, heightMm: 186}
        : {widthMm: 193, heightMm: 278};
}

export const PIECE_LABEL_HEIGHT_MM = 6;

const PIECE_SPACING_MM = 4;

export interface ArtSheetPiece {
    placement: ArtPlacement;
    pageIndex: number;
    columnOffsetStart: number;
    columnOffsetEnd: number;
    rowOffsetStart: number;
    rowOffsetEnd: number;
    widthMm: number;
    heightMm: number;
}

export interface PositionedPiece {
    piece: ArtSheetPiece;
    xMm: number;
    yMm: number;
}

export interface ArtSheet {
    pieces: PositionedPiece[];
}

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

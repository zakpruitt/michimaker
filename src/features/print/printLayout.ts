import {
    type ArtPlacement,
    type Binder,
    POCKET_HEIGHT_MM,
    POCKET_WIDTH_MM,
    type PocketContent,
    type PocketGap,
    ROWS_PER_PAGE,
} from "../../types/binder";
import type {CardSummary} from "../../types/card";
import {artHoleOffsetsByPlacement, artOffsetKey, pocketKey} from "../binder/state/gridMath";
import {padNumber, slugify} from "../../text";
import {type Orientation, pageSizeMm, type PaperSize, PRINT_MARGIN_MM} from "./paper";

export type PrintJob = "pages" | "art" | "proxies";
export type ProxySelection = "needed" | "all";

export interface PrintSettings {
    job: PrintJob;
    pageIndexes: number[] | "all";
    paper: PaperSize;
    connectStrips: boolean;
    proxySelection: ProxySelection;
    proxyCopies: ReadonlyMap<string, number>;
    grayscaleCards: boolean;
}

export interface ProxyCandidate {
    card: CardSummary;
    pageIndex: number;
    row: number;
    column: number;
    pocketCount: number;
    neededCount: number;
}

export const MAX_PROXY_COPIES = 9;

export type PrintCellContent =
    | {kind: "empty"}
    | {kind: "card"; card: CardSummary}
    | {kind: "art"; placement: ArtPlacement; rowOffset: number; columnOffset: number};

export interface CutEdges {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
}

export interface PrintCell {
    content: PrintCellContent;
    cut: CutEdges;
    fileName: string;
}

export interface ArtFill {
    placement: ArtPlacement;
    rowOffset: number;
    columnOffset: number;
}

export interface PrintPiece {
    key: string;
    label: string | null;
    columns: number;
    rows: number;
    cells: (PrintCell | null)[];
    artFill: ArtFill | null;
}

export interface PlacedPiece {
    piece: PrintPiece;
    xMm: number;
    yMm: number;
}

export interface PrintSheet {
    pieces: PlacedPiece[];
}

export interface PrintLayout {
    paper: PaperSize;
    orientation: Orientation;
    pageWidthMm: number;
    pageHeightMm: number;
    marginMm: number;
    labelHeightMm: number;
    pocketGap: PocketGap;
    grayscaleCards: boolean;
    sheets: PrintSheet[];
}

const LABEL_HEIGHT_MM = 4;
const ART_SPACING_MM = 4;
const NO_GAP: PocketGap = {xMm: 0, yMm: 0};

interface JobPacking {
    labelHeightMm: number;
    spacingMm: number;
    keepOrder: boolean;
}

const JOB_PACKING: Record<PrintJob, JobPacking> = {
    pages: {labelHeightMm: LABEL_HEIGHT_MM, spacingMm: ART_SPACING_MM, keepOrder: true},
    art: {labelHeightMm: LABEL_HEIGHT_MM, spacingMm: ART_SPACING_MM, keepOrder: false},
    proxies: {labelHeightMm: 0, spacingMm: 0, keepOrder: true},
};

interface PieceGrid {
    key: string;
    label: string | null;
    columns: number;
    rows: number;
    cellAt(row: number, column: number): PrintCellContent | null;
    fileNameAt(row: number, column: number): string;
    artFillAt?(row: number, column: number): ArtFill;
}

export function buildPrintLayout(
    binder: Binder,
    pocketContents: Map<string, PocketContent>,
    settings: PrintSettings
): PrintLayout {
    const grids = buildGrids(binder, pocketContents, settings);
    const packing = JOB_PACKING[settings.job];
    const gap = settings.job === "art" ? binder.pocketGap : NO_GAP;
    const [portrait, landscape] = (["portrait", "landscape"] as const).map((orientation) => ({
        layout: layoutFor(grids, settings, packing, orientation, gap),
        splitsColumns: grids.some(
            (grid) => blockWidthMm(grid.columns, gap) > usableSize(settings.paper, orientation).widthMm
        ),
    }));
    const score = (candidate: typeof portrait) => candidate.layout.sheets.length * 2 + (candidate.splitsColumns ? 1 : 0);
    return score(landscape) < score(portrait) ? landscape.layout : portrait.layout;
}

function usableSize(paper: PaperSize, orientation: Orientation): {widthMm: number; heightMm: number} {
    const page = pageSizeMm(paper, orientation);
    return {widthMm: page.widthMm - 2 * PRINT_MARGIN_MM, heightMm: page.heightMm - 2 * PRINT_MARGIN_MM};
}

export function listProxyCandidates(binder: Binder, pageIndexes: number[] | "all"): ProxyCandidate[] {
    const byCardId = new Map<string, ProxyCandidate>();
    const columns = binder.pocketColumns;
    binder.pages.forEach((page, pageIndex) => {
        if (!includesPage(pageIndexes, pageIndex)) {
            return;
        }
        page.pockets.forEach((card, pocketIndex) => {
            if (card === null) {
                return;
            }
            const needed = card.owned === true ? 0 : 1;
            const existing = byCardId.get(card.id);
            if (existing === undefined) {
                byCardId.set(card.id, {
                    card,
                    pageIndex,
                    row: Math.floor(pocketIndex / columns),
                    column: pocketIndex % columns,
                    pocketCount: 1,
                    neededCount: needed,
                });
            } else {
                existing.pocketCount += 1;
                existing.neededCount += needed;
            }
        });
    });
    return [...byCardId.values()];
}

export function proxyCopiesFor(candidate: ProxyCandidate, settings: Pick<PrintSettings, "proxySelection" | "proxyCopies">): number {
    const override = settings.proxyCopies.get(candidate.card.id);
    if (override !== undefined) {
        return override;
    }
    return settings.proxySelection === "all" ? candidate.pocketCount : candidate.neededCount;
}

export function countProxyCopies(
    binder: Binder,
    settings: Pick<PrintSettings, "pageIndexes" | "proxySelection" | "proxyCopies">
): number {
    return listProxyCandidates(binder, settings.pageIndexes).reduce(
        (total, candidate) => total + proxyCopiesFor(candidate, settings),
        0
    );
}

export function listPrintCells(layout: PrintLayout): PrintCell[] {
    return layout.sheets.flatMap((sheet) =>
        sheet.pieces.flatMap(({piece}) => piece.cells.filter((cell): cell is PrintCell => cell !== null))
    );
}

export function cellOriginMm(piece: PrintPiece, index: number, gap: PocketGap): {xMm: number; yMm: number} {
    return {
        xMm: (index % piece.columns) * (POCKET_WIDTH_MM + gap.xMm),
        yMm: Math.floor(index / piece.columns) * (POCKET_HEIGHT_MM + gap.yMm),
    };
}

export function blockSizeMm(piece: PrintPiece, gap: PocketGap): {widthMm: number; heightMm: number} {
    return {widthMm: blockWidthMm(piece.columns, gap), heightMm: blockHeightMm(piece.rows, gap)};
}

function blockWidthMm(columns: number, gap: PocketGap): number {
    return columns * POCKET_WIDTH_MM + (columns - 1) * gap.xMm;
}

function blockHeightMm(rows: number, gap: PocketGap): number {
    return rows * POCKET_HEIGHT_MM + (rows - 1) * gap.yMm;
}

function pieceSizeMm(piece: PrintPiece, labelHeightMm: number, gap: PocketGap): {widthMm: number; heightMm: number} {
    const block = blockSizeMm(piece, gap);
    return {widthMm: block.widthMm, heightMm: block.heightMm + (piece.label === null ? 0 : labelHeightMm)};
}

function includesPage(pageIndexes: number[] | "all", pageIndex: number): boolean {
    return pageIndexes === "all" || pageIndexes.includes(pageIndex);
}

function buildGrids(binder: Binder, pocketContents: Map<string, PocketContent>, settings: PrintSettings): PieceGrid[] {
    switch (settings.job) {
        case "pages":
            return pageGrids(binder, pocketContents, settings.pageIndexes);
        case "art":
            return artGrids(binder, settings.pageIndexes);
        case "proxies":
            return proxyGrids(binder, settings);
    }
}

function pageGrids(binder: Binder, pocketContents: Map<string, PocketContent>, pageIndexes: number[] | "all"): PieceGrid[] {
    return binder.pages.flatMap((_, pageIndex) => {
        if (!includesPage(pageIndexes, pageIndex)) {
            return [];
        }
        return [{
            key: `page-${pageIndex}`,
            label: `Page ${pageIndex + 1}`,
            columns: binder.pocketColumns,
            rows: ROWS_PER_PAGE,
            cellAt(row, column) {
                const content = pocketContents.get(pocketKey({pageIndex, row, column}));
                if (content === undefined || content.kind === "empty") {
                    return {kind: "empty"};
                }
                if (content.kind === "card") {
                    return {kind: "card", card: content.card};
                }
                return {
                    kind: "art",
                    placement: content.placement,
                    rowOffset: content.rowOffset,
                    columnOffset: content.columnOffset,
                };
            },
            fileNameAt(row, column) {
                const content = pocketContents.get(pocketKey({pageIndex, row, column}));
                const name = content?.kind === "card"
                    ? content.card.name
                    : content?.kind === "art" ? content.placement.art.title : "empty";
                return pocketFileName(pageIndex, row, column, name);
            },
        }];
    });
}

function artGrids(binder: Binder, pageIndexes: number[] | "all"): PieceGrid[] {
    const columns = binder.pocketColumns;
    const holesByPlacement = artHoleOffsetsByPlacement(binder);

    return binder.artPlacements.flatMap((placement) => {
        const {rect} = placement;
        const holes = holesByPlacement.get(placement.id) ?? new Set<string>();
        const anchorColumns = Math.min(rect.columnCount, columns - rect.column);
        const parts = [
            {pageIndex: rect.pageIndex, firstOffset: 0, count: anchorColumns},
            {pageIndex: rect.pageIndex + 1, firstOffset: anchorColumns, count: rect.columnCount - anchorColumns},
        ];
        return parts.flatMap((part): PieceGrid[] => {
            if (part.count === 0 || !includesPage(pageIndexes, part.pageIndex)) {
                return [];
            }
            return [{
                key: `art-${placement.id}-${part.pageIndex}`,
                label: `Page ${part.pageIndex + 1} · ${placement.art.title} (${rect.rowCount}×${rect.columnCount})`,
                columns: part.count,
                rows: rect.rowCount,
                cellAt(row, column) {
                    const columnOffset = part.firstOffset + column;
                    return holes.has(artOffsetKey(row, columnOffset))
                        ? null
                        : {kind: "art", placement, rowOffset: row, columnOffset};
                },
                fileNameAt: (row, column) =>
                    pocketFileName(part.pageIndex, row, part.firstOffset + column, placement.art.title),
                artFillAt: (row, column) => ({placement, rowOffset: row, columnOffset: part.firstOffset + column}),
            }];
        });
    });
}

function proxyGrids(binder: Binder, settings: PrintSettings): PieceGrid[] {
    return listProxyCandidates(binder, settings.pageIndexes).flatMap((candidate) => {
        const {card, pageIndex, row, column} = candidate;
        const baseName = pocketFileName(pageIndex, row, column, card.name);
        return Array.from({length: proxyCopiesFor(candidate, settings)}, (_, copy): PieceGrid => ({
            key: `proxy-${card.id}-${copy}`,
            label: null,
            columns: 1,
            rows: 1,
            cellAt: () => ({kind: "card", card}),
            fileNameAt: () => (copy === 0 ? baseName : `${baseName}-${copy + 1}`),
        }));
    });
}

function pocketFileName(pageIndex: number, row: number, column: number, name: string): string {
    return `page${padNumber(pageIndex + 1)}_r${row + 1}c${column + 1}_${slugify(name)}`;
}

function layoutFor(
    grids: PieceGrid[],
    settings: PrintSettings,
    packing: JobPacking,
    orientation: Orientation,
    gap: PocketGap
): PrintLayout {
    const page = pageSizeMm(settings.paper, orientation);
    const {widthMm: usableWidth, heightMm: usableHeight} = usableSize(settings.paper, orientation);
    const maxColumns = Math.max(1, Math.floor((usableWidth + gap.xMm) / (POCKET_WIDTH_MM + gap.xMm)));
    const maxRows = Math.max(
        1,
        Math.floor((usableHeight - packing.labelHeightMm + gap.yMm) / (POCKET_HEIGHT_MM + gap.yMm))
    );
    const connectStrips = settings.connectStrips && gap.xMm === 0;

    const pieces = grids.flatMap((grid) => splitGrid(grid, maxRows, maxColumns, connectStrips));
    const sheets = packPieces(pieces, usableWidth, usableHeight, packing, gap);

    return {
        paper: settings.paper,
        orientation,
        pageWidthMm: page.widthMm,
        pageHeightMm: page.heightMm,
        marginMm: PRINT_MARGIN_MM,
        labelHeightMm: packing.labelHeightMm,
        pocketGap: gap,
        grayscaleCards: settings.grayscaleCards && settings.job !== "art",
        sheets,
    };
}

function splitGrid(grid: PieceGrid, maxRows: number, maxColumns: number, connectStrips: boolean): PrintPiece[] {
    const pieces: PrintPiece[] = [];
    const splitsRows = grid.rows > maxRows;
    const splitsColumns = grid.columns > maxColumns;

    for (let rowStart = 0; rowStart < grid.rows; rowStart += maxRows) {
        for (let columnStart = 0; columnStart < grid.columns; columnStart += maxColumns) {
            const rowEnd = Math.min(rowStart + maxRows, grid.rows);
            const columnEnd = Math.min(columnStart + maxColumns, grid.columns);
            const bounds = trimmedBounds(grid, rowStart, rowEnd, columnStart, columnEnd);
            if (bounds === null) {
                continue;
            }

            const cells: (PrintCell | null)[] = [];
            for (let row = bounds.rowStart; row < bounds.rowEnd; row++) {
                for (let column = bounds.columnStart; column < bounds.columnEnd; column++) {
                    const content = grid.cellAt(row, column);
                    cells.push(
                        content === null
                            ? null
                            : {
                                content,
                                cut: cutEdges(grid, row, column, content, bounds, connectStrips),
                                fileName: grid.fileNameAt(row, column),
                            }
                    );
                }
            }

            pieces.push({
                key: `${grid.key}-${bounds.rowStart}-${bounds.columnStart}`,
                label: grid.label === null ? null : grid.label + chunkSuffix(bounds, splitsRows, splitsColumns),
                columns: bounds.columnEnd - bounds.columnStart,
                rows: bounds.rowEnd - bounds.rowStart,
                cells,
                artFill: grid.artFillAt?.(bounds.rowStart, bounds.columnStart) ?? null,
            });
        }
    }
    return pieces;
}

interface Bounds {
    rowStart: number;
    rowEnd: number;
    columnStart: number;
    columnEnd: number;
}

function trimmedBounds(grid: PieceGrid, rowStart: number, rowEnd: number, columnStart: number, columnEnd: number): Bounds | null {
    let bounds: Bounds | null = null;
    for (let row = rowStart; row < rowEnd; row++) {
        for (let column = columnStart; column < columnEnd; column++) {
            if (grid.cellAt(row, column) === null) {
                continue;
            }
            bounds = bounds === null
                ? {rowStart: row, rowEnd: row + 1, columnStart: column, columnEnd: column + 1}
                : {
                    rowStart: Math.min(bounds.rowStart, row),
                    rowEnd: Math.max(bounds.rowEnd, row + 1),
                    columnStart: Math.min(bounds.columnStart, column),
                    columnEnd: Math.max(bounds.columnEnd, column + 1),
                };
        }
    }
    return bounds;
}

function chunkSuffix(bounds: Bounds, splitsRows: boolean, splitsColumns: boolean): string {
    const parts = [
        splitsRows ? rangeLabel("row", bounds.rowStart, bounds.rowEnd) : null,
        splitsColumns ? rangeLabel("column", bounds.columnStart, bounds.columnEnd) : null,
    ].filter((part) => part !== null);
    return parts.length === 0 ? "" : ` · ${parts.join(", ")}`;
}

function rangeLabel(noun: string, start: number, end: number): string {
    return end - start === 1 ? `${noun} ${start + 1}` : `${noun}s ${start + 1}-${end}`;
}

function cutEdges(
    grid: PieceGrid,
    row: number,
    column: number,
    content: PrintCellContent,
    bounds: Bounds,
    connectStrips: boolean
): CutEdges {
    const joinsHorizontally = (neighborColumn: number) => {
        if (!connectStrips || content.kind !== "art") {
            return false;
        }
        if (neighborColumn < bounds.columnStart || neighborColumn >= bounds.columnEnd) {
            return false;
        }
        const neighbor = grid.cellAt(row, neighborColumn);
        return neighbor?.kind === "art" && neighbor.placement.id === content.placement.id;
    };
    return {
        top: true,
        bottom: true,
        left: !joinsHorizontally(column - 1),
        right: !joinsHorizontally(column + 1),
    };
}

interface OpenSheet {
    sheet: PrintSheet;
    shelfTop: number;
    shelfHeight: number;
    cursorX: number;
}

function packPieces(
    pieces: PrintPiece[],
    usableWidth: number,
    usableHeight: number,
    packing: JobPacking,
    gap: PocketGap
): PrintSheet[] {
    const ordered = packing.keepOrder
        ? pieces
        : [...pieces].sort((a, b) => b.rows - a.rows || b.columns - a.columns);
    const fits = (value: number, limit: number) => value <= limit + 0.01;
    const open: OpenSheet[] = [];

    for (const piece of ordered) {
        const {widthMm, heightMm} = pieceSizeMm(piece, packing.labelHeightMm, gap);
        const sameShelf = open.find(
            (candidate) =>
                candidate.cursorX > 0 &&
                fits(candidate.cursorX + widthMm, usableWidth) &&
                fits(candidate.shelfTop + heightMm, usableHeight)
        );
        if (sameShelf !== undefined) {
            place(sameShelf, piece, widthMm, heightMm);
            continue;
        }
        const newShelf = open.find((candidate) =>
            fits(candidate.shelfTop + candidate.shelfHeight + packing.spacingMm + heightMm, usableHeight)
        );
        if (newShelf !== undefined) {
            newShelf.shelfTop += newShelf.shelfHeight + packing.spacingMm;
            newShelf.shelfHeight = 0;
            newShelf.cursorX = 0;
            place(newShelf, piece, widthMm, heightMm);
            continue;
        }
        const fresh: OpenSheet = {sheet: {pieces: []}, shelfTop: 0, shelfHeight: 0, cursorX: 0};
        open.push(fresh);
        place(fresh, piece, widthMm, heightMm);
    }

    function place(target: OpenSheet, piece: PrintPiece, widthMm: number, heightMm: number): void {
        target.sheet.pieces.push({piece, xMm: target.cursorX, yMm: target.shelfTop});
        target.cursorX += widthMm + packing.spacingMm;
        target.shelfHeight = Math.max(target.shelfHeight, heightMm);
    }

    return open.map(({sheet}) => centerSheet(sheet, usableWidth, gap));
}

function centerSheet(sheet: PrintSheet, usableWidth: number, gap: PocketGap): PrintSheet {
    const right = Math.max(...sheet.pieces.map(({piece, xMm}) => xMm + blockSizeMm(piece, gap).widthMm));
    const offsetX = Math.max(0, (usableWidth - right) / 2);
    return {pieces: sheet.pieces.map((placed) => ({...placed, xMm: placed.xMm + offsetX}))};
}

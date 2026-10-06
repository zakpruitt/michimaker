import {
    type ArtPlacement,
    type Binder,
    type GridRect,
    type PocketColumns,
    type PocketContent,
    type PocketRef,
    ROWS_PER_PAGE,
} from "../../../types/binder";

function spreadIndexOfPage(pageIndex: number): number {
    return Math.floor((pageIndex + 1) / 2);
}

function isLeftPage(pageIndex: number): boolean {
    return pageIndex % 2 === 1;
}

export function pocketKey(pocket: PocketRef): string {
    return `${pocket.pageIndex}:${pocket.row}:${pocket.column}`;
}

function rectCrossesGutter(rect: GridRect, columns: PocketColumns): boolean {
    return rect.column + rect.columnCount > columns;
}

export function rectOrigin(rect: GridRect): PocketRef {
    return {pageIndex: rect.pageIndex, row: rect.row, column: rect.column};
}

export function singlePocketRect(pocket: PocketRef): GridRect {
    return {...pocket, rowCount: 1, columnCount: 1};
}

export function rectArea(rect: GridRect): number {
    return rect.rowCount * rect.columnCount;
}

export function listCoveredPockets(rect: GridRect, columns: PocketColumns): PocketRef[] {
    const covered: PocketRef[] = [];
    for (let rowOffset = 0; rowOffset < rect.rowCount; rowOffset++) {
        for (let columnOffset = 0; columnOffset < rect.columnCount; columnOffset++) {
            const rawColumn = rect.column + columnOffset;
            covered.push({
                pageIndex: rect.pageIndex + Math.floor(rawColumn / columns),
                row: rect.row + rowOffset,
                column: rawColumn % columns,
            });
        }
    }
    return covered;
}

export function validateRectShape(
    rect: GridRect,
    pageCount: number,
    columns: PocketColumns
): string | null {
    if (rect.rowCount < 1 || rect.columnCount < 1) {
        return "The selected region is empty.";
    }
    if (rect.row < 0 || rect.row + rect.rowCount > ROWS_PER_PAGE) {
        return "The selected region does not fit the page vertically.";
    }
    if (rect.column < 0 || rect.column >= columns) {
        return "The selected region starts outside the page.";
    }
    if (rect.column + rect.columnCount > columns * 2) {
        return "The selected region is wider than a two-page spread.";
    }
    if (rectCrossesGutter(rect, columns) && !isLeftPage(rect.pageIndex)) {
        return "Art can only continue across the middle of a spread, not across a page turn.";
    }
    const lastPageIndex = rect.pageIndex + (rectCrossesGutter(rect, columns) ? 1 : 0);
    if (rect.pageIndex < 0 || lastPageIndex >= pageCount) {
        return "The selected region extends past the last page.";
    }
    return null;
}

export function rectFromPockets(
    a: PocketRef,
    b: PocketRef,
    columns: PocketColumns
): GridRect | null {
    const spreadIndex = spreadIndexOfPage(a.pageIndex);
    if (spreadIndex !== spreadIndexOfPage(b.pageIndex)) {
        return null;
    }

    function spreadColumn(pocket: PocketRef): number {
        return (isLeftPage(pocket.pageIndex) ? 0 : columns) + pocket.column;
    }

    const firstColumn = Math.min(spreadColumn(a), spreadColumn(b));
    const lastColumn = Math.max(spreadColumn(a), spreadColumn(b));
    const firstRow = Math.min(a.row, b.row);
    const lastRow = Math.max(a.row, b.row);

    const startsOnRightPage = firstColumn >= columns;
    return {
        pageIndex: startsOnRightPage ? spreadIndex * 2 : spreadIndex * 2 - 1,
        row: firstRow,
        column: startsOnRightPage ? firstColumn - columns : firstColumn,
        rowCount: lastRow - firstRow + 1,
        columnCount: lastColumn - firstColumn + 1,
    };
}

export function moveRectToPocket(
    rect: GridRect,
    grabRowOffset: number,
    grabColumnOffset: number,
    target: PocketRef,
    columns: PocketColumns
): GridRect | null {
    const spreadIndex = spreadIndexOfPage(target.pageIndex);
    const targetSpreadColumn = (isLeftPage(target.pageIndex) ? 0 : columns) + target.column;
    const anchorSpreadColumn = targetSpreadColumn - grabColumnOffset;
    const row = target.row - grabRowOffset;
    if (anchorSpreadColumn < 0 || row < 0) {
        return null;
    }
    const startsOnRightPage = anchorSpreadColumn >= columns;
    const pageIndex = startsOnRightPage ? spreadIndex * 2 : spreadIndex * 2 - 1;
    if (pageIndex < 0) {
        return null;
    }
    return {
        pageIndex,
        row,
        column: startsOnRightPage ? anchorSpreadColumn - columns : anchorSpreadColumn,
        rowCount: rect.rowCount,
        columnCount: rect.columnCount,
    };
}

export function artOffsetKey(rowOffset: number, columnOffset: number): string {
    return `${rowOffset}:${columnOffset}`;
}

export function listCardPocketKeys(binder: Binder): Set<string> {
    const keys = new Set<string>();
    binder.pages.forEach((page, pageIndex) => {
        page.pockets.forEach((card, pocketIndex) => {
            if (card !== null) {
                keys.add(
                    pocketKey({
                        pageIndex,
                        row: Math.floor(pocketIndex / binder.pocketColumns),
                        column: pocketIndex % binder.pocketColumns,
                    })
                );
            }
        });
    });
    return keys;
}

export function artHoleOffsets(
    rect: GridRect,
    columns: PocketColumns,
    cardPocketKeys: ReadonlySet<string>
): Set<string> {
    const holes = new Set<string>();
    listCoveredPockets(rect, columns).forEach((pocket, index) => {
        if (cardPocketKeys.has(pocketKey(pocket))) {
            holes.add(
                artOffsetKey(Math.floor(index / rect.columnCount), index % rect.columnCount)
            );
        }
    });
    return holes;
}

export function firstVisibleArtOffset(rect: GridRect, holes: ReadonlySet<string>): string | null {
    for (let rowOffset = 0; rowOffset < rect.rowCount; rowOffset++) {
        for (let columnOffset = 0; columnOffset < rect.columnCount; columnOffset++) {
            const key = artOffsetKey(rowOffset, columnOffset);
            if (!holes.has(key)) {
                return key;
            }
        }
    }
    return null;
}

export function artHoleOffsetsByPlacement(binder: Binder): Map<string, ReadonlySet<string>> {
    const cardPocketKeys = listCardPocketKeys(binder);
    return new Map(
        binder.artPlacements.map((placement) => [
            placement.id,
            artHoleOffsets(placement.rect, binder.pocketColumns, cardPocketKeys),
        ])
    );
}

export function buildPocketContentMap(binder: Binder): Map<string, PocketContent> {
    const contents = new Map<string, PocketContent>();
    const columns = binder.pocketColumns;

    binder.pages.forEach((page, pageIndex) => {
        page.pockets.forEach((card, pocketIndex) => {
            if (card !== null) {
                const pocket: PocketRef = {
                    pageIndex,
                    row: Math.floor(pocketIndex / columns),
                    column: pocketIndex % columns,
                };
                contents.set(pocketKey(pocket), {kind: "card", card});
            }
        });
    });

    const cardPocketKeys = new Set(contents.keys());

    for (const placement of binder.artPlacements) {
        const holes = artHoleOffsets(placement.rect, columns, cardPocketKeys);
        const pockets = listCoveredPockets(placement.rect, columns);
        pockets.forEach((pocket, index) => {
            const key = pocketKey(pocket);
            if (contents.has(key)) {
                return;
            }
            contents.set(key, {
                kind: "art",
                placement,
                rowOffset: Math.floor(index / placement.rect.columnCount),
                columnOffset: index % placement.rect.columnCount,
                holes,
            });
        });
    }

    return contents;
}

function rectCoversPocket(
    rect: GridRect,
    pocket: PocketRef,
    columns: PocketColumns
): boolean {
    if (pocket.row < rect.row || pocket.row >= rect.row + rect.rowCount) {
        return false;
    }
    let spreadColumn: number;
    if (pocket.pageIndex === rect.pageIndex) {
        spreadColumn = pocket.column;
    } else if (
        pocket.pageIndex === rect.pageIndex + 1 &&
        rectCrossesGutter(rect, columns)
    ) {
        spreadColumn = pocket.column + columns;
    } else {
        return false;
    }
    return spreadColumn >= rect.column && spreadColumn < rect.column + rect.columnCount;
}

export function findPlacementCovering(
    placements: ArtPlacement[],
    pocket: PocketRef,
    columns: PocketColumns
): ArtPlacement | null {
    for (const placement of placements) {
        if (rectCoversPocket(placement.rect, pocket, columns)) {
            return placement;
        }
    }
    return null;
}

export function findPlacementMatchingRect(
    placements: ArtPlacement[],
    rect: GridRect
): ArtPlacement | null {
    return (
        placements.find(
            (placement) =>
                placement.rect.pageIndex === rect.pageIndex &&
                placement.rect.row === rect.row &&
                placement.rect.column === rect.column &&
                placement.rect.rowCount === rect.rowCount &&
                placement.rect.columnCount === rect.columnCount
        ) ?? null
    );
}

export interface PlacementRemapResult {
    kept: ArtPlacement[];
    droppedTitles: string[];
}

export function remapPlacements(
    placements: ArtPlacement[],
    mapPageIndex: (oldPageIndex: number) => number | null,
    newPageCount: number,
    columns: PocketColumns
): PlacementRemapResult {
    const kept: ArtPlacement[] = [];
    const droppedTitles: string[] = [];

    for (const placement of placements) {
        const crossesGutter = rectCrossesGutter(placement.rect, columns);
        const newAnchorPage = mapPageIndex(placement.rect.pageIndex);
        const newSecondPage = crossesGutter
            ? mapPageIndex(placement.rect.pageIndex + 1)
            : null;

        let survives = newAnchorPage !== null;
        if (survives && crossesGutter) {
            survives =
                newSecondPage !== null &&
                newSecondPage === (newAnchorPage as number) + 1 &&
                isLeftPage(newAnchorPage as number);
        }
        if (survives) {
            const remapped: ArtPlacement = {
                ...placement,
                rect: {...placement.rect, pageIndex: newAnchorPage as number},
            };
            survives = validateRectShape(remapped.rect, newPageCount, columns) === null;
            if (survives) {
                kept.push(remapped);
                continue;
            }
        }
        droppedTitles.push(placement.art.title);
    }

    return {kept, droppedTitles};
}

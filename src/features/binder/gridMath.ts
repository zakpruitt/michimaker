import {
    type ArtPlacement,
    type Binder,
    type GridRect,
    type PocketColumns,
    type PocketContent,
    type PocketRef,
    ROWS_PER_PAGE,
} from "../../types/binder";

/** Spread 0 is the cover plus page 0 on the right; spread s pairs pages (2s-1, 2s). */
export function spreadIndexOfPage(pageIndex: number): number {
    return Math.floor((pageIndex + 1) / 2);
}

/** Left-hand pages are the odd-indexed ones (1, 3, 5, ...); page 0 always
 *  sits on the right, facing the cover. */
export function isLeftPage(pageIndex: number): boolean {
    return pageIndex % 2 === 1;
}

/** Stable map key for a pocket, e.g. "3:1:2" = page 3, row 1, column 2. */
export function pocketKey(pocket: PocketRef): string {
    return `${pocket.pageIndex}:${pocket.row}:${pocket.column}`;
}

/** True when the rect spills past its anchor page onto the facing page. */
export function rectCrossesGutter(rect: GridRect, columns: PocketColumns): boolean {
    return rect.column + rect.columnCount > columns;
}

/** Number of pockets covered by the rect. */
export function rectArea(rect: GridRect): number {
    return rect.rowCount * rect.columnCount;
}

/** Expands a rect into every pocket it covers, resolving gutter overflow. */
export function listCoveredPockets(rect: GridRect, columns: PocketColumns): PocketRef[] {
    const covered: PocketRef[] = [];
    for (let rowOffset = 0; rowOffset < rect.rowCount; rowOffset++) {
        for (let columnOffset = 0; columnOffset < rect.columnCount; columnOffset++) {
            // Raw columns past the page edge land on the facing page.
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

/** Returns a user-facing error message when the rect is not a legal span, or null when valid. */
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

/** Smallest rect containing both pockets, or null when they sit on different spreads. */
export function rectFromPockets(
    a: PocketRef,
    b: PocketRef,
    columns: PocketColumns
): GridRect | null {
    const spreadIndex = spreadIndexOfPage(a.pageIndex);
    if (spreadIndex !== spreadIndexOfPage(b.pageIndex)) {
        return null;
    }

    // Work in "spread columns": 0..columns-1 on the left page, then the right
    // page's columns continue from there.
    function spreadColumn(pocket: PocketRef): number {
        return (isLeftPage(pocket.pageIndex) ? 0 : columns) + pocket.column;
    }

    const firstColumn = Math.min(spreadColumn(a), spreadColumn(b));
    const lastColumn = Math.max(spreadColumn(a), spreadColumn(b));
    const firstRow = Math.min(a.row, b.row);
    const lastRow = Math.max(a.row, b.row);

    // Anchor on the left page if the rect starts there, otherwise on the
    // right. Spread s holds pages (2s-1, 2s); page 0 is spread 0's right page.
    const startsOnRightPage = firstColumn >= columns;
    return {
        pageIndex: startsOnRightPage ? spreadIndex * 2 : spreadIndex * 2 - 1,
        row: firstRow,
        column: startsOnRightPage ? firstColumn - columns : firstColumn,
        rowCount: lastRow - firstRow + 1,
        columnCount: lastColumn - firstColumn + 1,
    };
}

/** Pockets absent from the map are empty. */
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

    for (const placement of binder.artPlacements) {
        const pockets = listCoveredPockets(placement.rect, columns);
        pockets.forEach((pocket, index) => {
            contents.set(pocketKey(pocket), {
                kind: "art",
                placement,
                rowOffset: Math.floor(index / placement.rect.columnCount),
                columnOffset: index % placement.rect.columnCount,
            });
        });
    }

    return contents;
}

/** Finds the art placement covering a pocket, if any. */
export function findPlacementCovering(
    placements: ArtPlacement[],
    pocket: PocketRef,
    columns: PocketColumns
): ArtPlacement | null {
    const targetKey = pocketKey(pocket);
    for (const placement of placements) {
        const isCovered = listCoveredPockets(placement.rect, columns).some(
            (covered) => pocketKey(covered) === targetKey
        );
        if (isCovered) {
            return placement;
        }
    }
    return null;
}

/** Result of re-anchoring placements after a page insert/delete. */
export interface PlacementRemapResult {
    kept: ArtPlacement[];
    /** Titles of art pieces that no longer fit and were removed. */
    droppedTitles: string[];
}

/**
 * Re-anchors art placements after pages move; mapPageIndex gives a page's new
 * index, or null when it was deleted. Placements whose geometry no longer
 * works (deleted page, split halves, flipped parity) are dropped.
 */
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

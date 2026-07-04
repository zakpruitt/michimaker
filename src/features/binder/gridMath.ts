/**
 * Pure grid math for the binder. No React in here.
 *
 * Responsibilities:
 *  - expanding a GridRect into the individual pockets it covers,
 *  - validating that a rect is a legal art span (in bounds, only crosses the
 *    spread gutter, never a "page turn" boundary),
 *  - building the pocket → content lookup used by the renderer,
 *  - re-anchoring art placements when pages are inserted or deleted.
 *
 * Rough Java analogy: a static utility class over the domain model.
 */
import {
  COLUMNS_PER_PAGE,
  ROWS_PER_PAGE,
  type ArtPlacement,
  type Binder,
  type GridRect,
  type PocketContent,
  type PocketRef,
} from "../../types/binder";

/**
 * Spreads pair like a real binder: spread 0 is the inside of the front cover
 * plus page 0 alone on the right; every later spread s pairs pages
 * (2s-1, 2s). See the coordinate-system note in types/binder.ts.
 */
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
export function rectCrossesGutter(rect: GridRect): boolean {
  return rect.column + rect.columnCount > COLUMNS_PER_PAGE;
}

/** Number of pockets covered by the rect. */
export function rectArea(rect: GridRect): number {
  return rect.rowCount * rect.columnCount;
}

/** Expands a rect into every pocket it covers, resolving gutter overflow. */
export function listCoveredPockets(rect: GridRect): PocketRef[] {
  const covered: PocketRef[] = [];
  for (let rowOffset = 0; rowOffset < rect.rowCount; rowOffset++) {
    for (let columnOffset = 0; columnOffset < rect.columnCount; columnOffset++) {
      // Raw columns 0..2 sit on the anchor page; 3..5 land on the facing page.
      const rawColumn = rect.column + columnOffset;
      covered.push({
        pageIndex: rect.pageIndex + Math.floor(rawColumn / COLUMNS_PER_PAGE),
        row: rect.row + rowOffset,
        column: rawColumn % COLUMNS_PER_PAGE,
      });
    }
  }
  return covered;
}

/**
 * Checks that a rect is a geometrically legal span for a binder with
 * pageCount pages. Returns a user-facing error message, or null when valid.
 */
export function validateRectShape(rect: GridRect, pageCount: number): string | null {
  if (rect.rowCount < 1 || rect.columnCount < 1) {
    return "The selected region is empty.";
  }
  if (rect.row < 0 || rect.row + rect.rowCount > ROWS_PER_PAGE) {
    return "The selected region does not fit the page vertically.";
  }
  if (rect.column < 0 || rect.column >= COLUMNS_PER_PAGE) {
    return "The selected region starts outside the page.";
  }
  if (rect.column + rect.columnCount > COLUMNS_PER_PAGE * 2) {
    return "The selected region is wider than a two-page spread.";
  }
  if (rectCrossesGutter(rect) && !isLeftPage(rect.pageIndex)) {
    return "Art can only continue across the middle of a spread, not across a page turn.";
  }
  const lastPageIndex = rect.pageIndex + (rectCrossesGutter(rect) ? 1 : 0);
  if (rect.pageIndex < 0 || lastPageIndex >= pageCount) {
    return "The selected region extends past the last page.";
  }
  return null;
}

/**
 * Builds the smallest rect containing both pockets, or null when the pockets
 * are on different spreads (a span can never cross a page turn).
 *
 * Used by drag-selection: the anchor pocket is where the drag started, the
 * other pocket is where the mouse currently is.
 */
export function rectFromPockets(a: PocketRef, b: PocketRef): GridRect | null {
  const spreadIndex = spreadIndexOfPage(a.pageIndex);
  if (spreadIndex !== spreadIndexOfPage(b.pageIndex)) {
    return null;
  }

  // Work in "spread columns": 0..2 on the left page, 3..5 on the right page.
  function spreadColumn(pocket: PocketRef): number {
    return (isLeftPage(pocket.pageIndex) ? 0 : COLUMNS_PER_PAGE) + pocket.column;
  }

  const firstColumn = Math.min(spreadColumn(a), spreadColumn(b));
  const lastColumn = Math.max(spreadColumn(a), spreadColumn(b));
  const firstRow = Math.min(a.row, b.row);
  const lastRow = Math.max(a.row, b.row);

  // Anchor on the left page if the rect starts there, otherwise on the
  // right. Spread s holds pages (2s-1, 2s); page 0 is spread 0's right page.
  const startsOnRightPage = firstColumn >= COLUMNS_PER_PAGE;
  return {
    pageIndex: startsOnRightPage ? spreadIndex * 2 : spreadIndex * 2 - 1,
    row: firstRow,
    column: startsOnRightPage ? firstColumn - COLUMNS_PER_PAGE : firstColumn,
    rowCount: lastRow - firstRow + 1,
    columnCount: lastColumn - firstColumn + 1,
  };
}

/**
 * Resolves what every non-empty pocket shows: cards from the pages plus art
 * cells from the placements. Pockets absent from the map are empty.
 */
export function buildPocketContentMap(binder: Binder): Map<string, PocketContent> {
  const contents = new Map<string, PocketContent>();

  binder.pages.forEach((page, pageIndex) => {
    page.pockets.forEach((card, pocketIndex) => {
      if (card !== null) {
        const pocket: PocketRef = {
          pageIndex,
          row: Math.floor(pocketIndex / COLUMNS_PER_PAGE),
          column: pocketIndex % COLUMNS_PER_PAGE,
        };
        contents.set(pocketKey(pocket), { kind: "card", card });
      }
    });
  });

  for (const placement of binder.artPlacements) {
    const pockets = listCoveredPockets(placement.rect);
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
  pocket: PocketRef
): ArtPlacement | null {
  const targetKey = pocketKey(pocket);
  for (const placement of placements) {
    const isCovered = listCoveredPockets(placement.rect).some(
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
 * Re-anchors art placements after pages move.
 *
 * mapPageIndex translates an old page index to its new index, or null when
 * that page was deleted. A placement is dropped when any page it covered was
 * deleted, when its two halves are no longer adjacent (a page was inserted
 * between them), or when a gutter-crossing span no longer starts on a
 * left-hand page (page parity flipped, so it would now cross a page turn).
 */
export function remapPlacements(
  placements: ArtPlacement[],
  mapPageIndex: (oldPageIndex: number) => number | null,
  newPageCount: number
): PlacementRemapResult {
  const kept: ArtPlacement[] = [];
  const droppedTitles: string[] = [];

  for (const placement of placements) {
    const crossesGutter = rectCrossesGutter(placement.rect);
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
        rect: { ...placement.rect, pageIndex: newAnchorPage as number },
      };
      survives = validateRectShape(remapped.rect, newPageCount) === null;
      if (survives) {
        kept.push(remapped);
        continue;
      }
    }
    droppedTitles.push(placement.art.title);
  }

  return { kept, droppedTitles };
}

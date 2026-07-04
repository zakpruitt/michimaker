/**
 * State transitions for the binder, as a pure reducer. Validation with user
 * feedback happens one layer up in BinderContext; the reducer only guards
 * against illegal states.
 */
import {
  DEFAULT_BINDER_TITLE,
  DEFAULT_POCKET_COLUMNS,
  pocketsPerPage,
  type ArtPlacement,
  type Binder,
  type BinderPageData,
  type PocketColumns,
  type PocketRef,
} from "../../types/binder";
import type { CardSummary } from "../../types/card";
import {
  findPlacementCovering,
  listCoveredPockets,
  pocketKey,
  remapPlacements,
  validateRectShape,
} from "./gridMath";

export type BinderAction =
  | { type: "REPLACE_BINDER"; binder: Binder }
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_POCKET_COLUMNS"; columns: PocketColumns }
  | { type: "ADD_PAGE_AFTER"; pageIndex: number }
  | { type: "DELETE_PAGE"; pageIndex: number }
  | { type: "PLACE_CARD"; pocket: PocketRef; card: CardSummary }
  | { type: "CLEAR_POCKET"; pocket: PocketRef }
  | { type: "PLACE_ART"; placement: ArtPlacement }
  | { type: "REMOVE_ART_PLACEMENT"; placementId: string };

export function createEmptyPage(columns: PocketColumns): BinderPageData {
  return { pockets: Array<CardSummary | null>(pocketsPerPage(columns)).fill(null) };
}

/**
 * A fresh binder opens to the cover spread (cover + page 1) followed by one
 * full two-page spread, so it looks like a real, complete binder.
 */
export function createDefaultBinder(): Binder {
  const columns = DEFAULT_POCKET_COLUMNS;
  return {
    title: DEFAULT_BINDER_TITLE,
    pocketColumns: columns,
    pages: [createEmptyPage(columns), createEmptyPage(columns), createEmptyPage(columns)],
    artPlacements: [],
  };
}

/** Outcome of planning a page insert/delete before applying it. */
export interface PageChangePlan {
  pages: BinderPageData[];
  artPlacements: ArtPlacement[];
  /** Art that no longer lines up with its spread and had to be removed. */
  droppedTitles: string[];
}

/**
 * Plans inserting an empty page after pageIndex. The single owner of the
 * "where does each old page land" rule; the reducer applies the plan and
 * the service layer reads droppedTitles from the same plan, so the warning
 * can never disagree with what actually happens.
 */
export function planPageInsert(binder: Binder, pageIndex: number): PageChangePlan {
  const insertIndex = pageIndex + 1;
  const pages = [
    ...binder.pages.slice(0, insertIndex),
    createEmptyPage(binder.pocketColumns),
    ...binder.pages.slice(insertIndex),
  ];
  const remap = remapPlacements(
    binder.artPlacements,
    (oldIndex) => (oldIndex >= insertIndex ? oldIndex + 1 : oldIndex),
    pages.length,
    binder.pocketColumns
  );
  return { pages, artPlacements: remap.kept, droppedTitles: remap.droppedTitles };
}

/** Plans deleting the page at pageIndex; see planPageInsert. */
export function planPageDelete(binder: Binder, pageIndex: number): PageChangePlan {
  const pages = binder.pages.filter((_, index) => index !== pageIndex);
  const remap = remapPlacements(
    binder.artPlacements,
    (oldIndex) => {
      if (oldIndex === pageIndex) return null;
      return oldIndex > pageIndex ? oldIndex - 1 : oldIndex;
    },
    pages.length,
    binder.pocketColumns
  );
  return { pages, artPlacements: remap.kept, droppedTitles: remap.droppedTitles };
}

/** Outcome of planning a 9-pocket <-> 12-pocket layout switch. */
export interface PocketColumnsChangePlan {
  pages: BinderPageData[];
  artPlacements: ArtPlacement[];
  /** Art that no longer fits (or would overlap after reflowing). */
  droppedTitles: string[];
  /** Cards that sat in a column the narrower layout does not have. */
  droppedCardNames: string[];
}

/**
 * Plans switching the binder between 9-pocket (3 columns) and 12-pocket
 * (4 columns) pages. Cards keep their (row, column) position; cards in a
 * column the new layout lacks are dropped. Art spans keep their anchor and
 * reflow against the new page width; spans that become geometrically
 * illegal, or would now overlap a card or another span (a gutter-crossing
 * span can pull back onto its own page, landing on occupied pockets), are
 * dropped. The plan reports everything it removed.
 */
export function planPocketColumnsChange(
  binder: Binder,
  newColumns: PocketColumns
): PocketColumnsChangePlan {
  const oldColumns = binder.pocketColumns;
  const droppedCardNames: string[] = [];

  const pages = binder.pages.map((page) => {
    const pockets = Array<CardSummary | null>(pocketsPerPage(newColumns)).fill(null);
    page.pockets.forEach((card, index) => {
      if (card === null) {
        return;
      }
      const row = Math.floor(index / oldColumns);
      const column = index % oldColumns;
      if (column >= newColumns) {
        droppedCardNames.push(card.name);
        return;
      }
      pockets[row * newColumns + column] = card;
    });
    return { pockets };
  });

  // Occupancy check against the surviving cards and already-kept spans.
  const occupiedKeys = new Set<string>();
  pages.forEach((page, pageIndex) => {
    page.pockets.forEach((card, index) => {
      if (card !== null) {
        occupiedKeys.add(
          pocketKey({
            pageIndex,
            row: Math.floor(index / newColumns),
            column: index % newColumns,
          })
        );
      }
    });
  });

  const artPlacements: ArtPlacement[] = [];
  const droppedTitles: string[] = [];
  for (const placement of binder.artPlacements) {
    if (validateRectShape(placement.rect, pages.length, newColumns) !== null) {
      droppedTitles.push(placement.art.title);
      continue;
    }
    const covered = listCoveredPockets(placement.rect, newColumns).map(pocketKey);
    if (covered.some((key) => occupiedKeys.has(key))) {
      droppedTitles.push(placement.art.title);
      continue;
    }
    covered.forEach((key) => occupiedKeys.add(key));
    artPlacements.push(placement);
  }

  return { pages, artPlacements, droppedTitles, droppedCardNames };
}

function pocketIndexOf(pocket: PocketRef, columns: PocketColumns): number {
  return pocket.row * columns + pocket.column;
}

function withUpdatedPocket(
  binder: Binder,
  pocket: PocketRef,
  card: CardSummary | null
): Binder {
  const pages = binder.pages.map((page, pageIndex) => {
    if (pageIndex !== pocket.pageIndex) {
      return page;
    }
    const pockets = [...page.pockets];
    pockets[pocketIndexOf(pocket, binder.pocketColumns)] = card;
    return { pockets };
  });
  return { ...binder, pages };
}

export function binderReducer(binder: Binder, action: BinderAction): Binder {
  switch (action.type) {
    case "REPLACE_BINDER": {
      return action.binder;
    }

    case "SET_TITLE": {
      return { ...binder, title: action.title };
    }

    case "SET_POCKET_COLUMNS": {
      if (action.columns === binder.pocketColumns) {
        return binder;
      }
      const plan = planPocketColumnsChange(binder, action.columns);
      return {
        ...binder,
        pocketColumns: action.columns,
        pages: plan.pages,
        artPlacements: plan.artPlacements,
      };
    }

    case "ADD_PAGE_AFTER": {
      const plan = planPageInsert(binder, action.pageIndex);
      return { ...binder, pages: plan.pages, artPlacements: plan.artPlacements };
    }

    case "DELETE_PAGE": {
      if (binder.pages.length <= 1) {
        return binder;
      }
      const plan = planPageDelete(binder, action.pageIndex);
      return { ...binder, pages: plan.pages, artPlacements: plan.artPlacements };
    }

    case "PLACE_CARD": {
      // Never place a card under an art span; the service layer reports this,
      // the reducer just refuses.
      if (
        findPlacementCovering(binder.artPlacements, action.pocket, binder.pocketColumns) !==
        null
      ) {
        return binder;
      }
      return withUpdatedPocket(binder, action.pocket, action.card);
    }

    case "CLEAR_POCKET": {
      const placement = findPlacementCovering(
        binder.artPlacements,
        action.pocket,
        binder.pocketColumns
      );
      if (placement !== null) {
        // Art spans are one unit: clearing any covered pocket removes it all.
        return {
          ...binder,
          artPlacements: binder.artPlacements.filter((p) => p.id !== placement.id),
        };
      }
      return withUpdatedPocket(binder, action.pocket, null);
    }

    case "PLACE_ART": {
      return { ...binder, artPlacements: [...binder.artPlacements, action.placement] };
    }

    case "REMOVE_ART_PLACEMENT": {
      return {
        ...binder,
        artPlacements: binder.artPlacements.filter((p) => p.id !== action.placementId),
      };
    }
  }
}

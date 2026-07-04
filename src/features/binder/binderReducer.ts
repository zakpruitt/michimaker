/**
 * State transitions for the binder, as a pure reducer.
 *
 * Rough Java analogy: a command handler. Each BinderAction is a command
 * object, and the reducer applies it immutably to produce the next state.
 * All validation with user feedback happens one layer up in BinderContext
 * (the "service layer"); the reducer only guards against illegal states.
 */
import {
  DEFAULT_BINDER_TITLE,
  POCKETS_PER_PAGE,
  COLUMNS_PER_PAGE,
  type ArtPlacement,
  type Binder,
  type BinderPageData,
  type PocketRef,
} from "../../types/binder";
import type { CardSummary } from "../../types/card";
import { findPlacementCovering, remapPlacements } from "./gridMath";

export type BinderAction =
  | { type: "REPLACE_BINDER"; binder: Binder }
  | { type: "SET_TITLE"; title: string }
  | { type: "ADD_PAGE_AFTER"; pageIndex: number }
  | { type: "DELETE_PAGE"; pageIndex: number }
  | { type: "PLACE_CARD"; pocket: PocketRef; card: CardSummary }
  | { type: "CLEAR_POCKET"; pocket: PocketRef }
  | { type: "PLACE_ART"; placement: ArtPlacement }
  | { type: "REMOVE_ART_PLACEMENT"; placementId: string };

export function createEmptyPage(): BinderPageData {
  return { pockets: Array<CardSummary | null>(POCKETS_PER_PAGE).fill(null) };
}

/**
 * A fresh binder opens to the cover spread (cover + page 1) followed by one
 * full two-page spread, so it looks like a real, complete binder.
 */
export function createDefaultBinder(): Binder {
  return {
    title: DEFAULT_BINDER_TITLE,
    pages: [createEmptyPage(), createEmptyPage(), createEmptyPage()],
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
    createEmptyPage(),
    ...binder.pages.slice(insertIndex),
  ];
  const remap = remapPlacements(
    binder.artPlacements,
    (oldIndex) => (oldIndex >= insertIndex ? oldIndex + 1 : oldIndex),
    pages.length
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
    pages.length
  );
  return { pages, artPlacements: remap.kept, droppedTitles: remap.droppedTitles };
}

function pocketIndexOf(pocket: PocketRef): number {
  return pocket.row * COLUMNS_PER_PAGE + pocket.column;
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
    pockets[pocketIndexOf(pocket)] = card;
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
      if (findPlacementCovering(binder.artPlacements, action.pocket) !== null) {
        return binder;
      }
      return withUpdatedPocket(binder, action.pocket, action.card);
    }

    case "CLEAR_POCKET": {
      const placement = findPlacementCovering(binder.artPlacements, action.pocket);
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

import {
    type ArtPlacement,
    type Binder,
    type BinderPageData,
    DEFAULT_BINDER_TITLE,
    DEFAULT_POCKET_COLUMNS,
    type GridRect,
    type PocketColumns,
    type PocketRef,
    pocketsPerPage,
} from "../../types/binder";
import type {CardSummary} from "../../types/card";
import {findPlacementCovering, listCoveredPockets, pocketKey, remapPlacements, validateRectShape,} from "./gridMath";

export type BinderAction =
    | { type: "REPLACE_BINDER"; binder: Binder }
    | { type: "SET_TITLE"; title: string }
    | { type: "SET_POCKET_COLUMNS"; columns: PocketColumns }
    | { type: "ADD_PAGE_AFTER"; pageIndex: number }
    | { type: "DELETE_PAGE"; pageIndex: number }
    | { type: "PLACE_CARD"; pocket: PocketRef; card: CardSummary }
    | { type: "MOVE_CARD"; from: PocketRef; to: PocketRef }
    | { type: "CLEAR_POCKET"; pocket: PocketRef }
    | { type: "PLACE_ART"; placement: ArtPlacement }
    | { type: "MOVE_ART"; placementId: string; rect: GridRect }
    | { type: "REMOVE_ART_PLACEMENT"; placementId: string };

export function createEmptyPage(columns: PocketColumns): BinderPageData {
    return {pockets: Array<CardSummary | null>(pocketsPerPage(columns)).fill(null)};
}

/** Cover spread plus one full two-page spread, like a real binder. */
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

/** Reducer and service layer share this plan, so the dropped-art warning always matches reality. */
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
    return {pages, artPlacements: remap.kept, droppedTitles: remap.droppedTitles};
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
    return {pages, artPlacements: remap.kept, droppedTitles: remap.droppedTitles};
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
 * Cards keep their (row, column); cards in a column the new layout lacks are
 * dropped, as are art spans that become illegal or would overlap after
 * reflowing. The plan reports everything it removed.
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
        return {pockets};
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

    return {pages, artPlacements, droppedTitles, droppedCardNames};
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
        return {pockets};
    });
    return {...binder, pages};
}

export function binderReducer(binder: Binder, action: BinderAction): Binder {
    switch (action.type) {
        case "REPLACE_BINDER": {
            return action.binder;
        }

        case "SET_TITLE": {
            return {...binder, title: action.title};
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
            return {...binder, pages: plan.pages, artPlacements: plan.artPlacements};
        }

        case "DELETE_PAGE": {
            if (binder.pages.length <= 1) {
                return binder;
            }
            const plan = planPageDelete(binder, action.pageIndex);
            return {...binder, pages: plan.pages, artPlacements: plan.artPlacements};
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

        case "MOVE_CARD": {
            const {from, to} = action;
            if (findPlacementCovering(binder.artPlacements, to, binder.pocketColumns) !== null) {
                return binder;
            }
            const fromCard =
                binder.pages[from.pageIndex]?.pockets[pocketIndexOf(from, binder.pocketColumns)];
            if (fromCard === null || fromCard === undefined) {
                return binder;
            }
            const toCard =
                binder.pages[to.pageIndex]?.pockets[pocketIndexOf(to, binder.pocketColumns)] ?? null;
            // The vacated pocket takes whatever was at the target, so dropping
            // onto an occupied pocket swaps the two cards.
            return withUpdatedPocket(withUpdatedPocket(binder, to, fromCard), from, toCard);
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
            return {...binder, artPlacements: [...binder.artPlacements, action.placement]};
        }

        case "MOVE_ART": {
            return {
                ...binder,
                artPlacements: binder.artPlacements.map((p) =>
                    p.id === action.placementId ? {...p, rect: action.rect} : p
                ),
            };
        }

        case "REMOVE_ART_PLACEMENT": {
            return {
                ...binder,
                artPlacements: binder.artPlacements.filter((p) => p.id !== action.placementId),
            };
        }
    }
}

import {
    type ArtCrop,
    type ArtPlacement,
    type Binder,
    type BinderPageData,
    DEFAULT_BINDER_TITLE,
    DEFAULT_POCKET_GAP,
    DEFAULT_POCKET_COLUMNS,
    type GridRect,
    type PocketColumns,
    type PocketGap,
    type PocketRef,
    pocketsPerPage,
} from "../../../types/binder";
import type {CardSummary} from "../../../types/card";
import {findPlacementCovering, listCoveredPockets, pocketKey, remapPlacements, validateRectShape,} from "./gridMath";

export type BinderAction =
    | { type: "REPLACE_BINDER"; binder: Binder }
    | { type: "SET_TITLE"; title: string }
    | { type: "SET_POCKET_COLUMNS"; columns: PocketColumns }
    | { type: "SET_POCKET_GAP"; gap: PocketGap }
    | { type: "ADD_PAGE_AFTER"; pageIndex: number }
    | { type: "DELETE_PAGE"; pageIndex: number }
    | { type: "PLACE_CARD"; pocket: PocketRef; card: CardSummary }
    | { type: "MOVE_CARD"; from: PocketRef; to: PocketRef }
    | { type: "CLEAR_POCKET"; pocket: PocketRef }
    | { type: "SET_CARD_OWNED"; pocket: PocketRef; owned: boolean }
    | { type: "PLACE_ART"; placement: ArtPlacement }
    | { type: "MOVE_ART"; placementId: string; rect: GridRect }
    | { type: "SET_ART_CROP"; placementId: string; crop: ArtCrop }
    | { type: "REMOVE_ART_PLACEMENT"; placementId: string }
    | { type: "SET_CARD_IMAGES"; imageUrlsByCardId: ReadonlyMap<string, string> };

function createEmptyPage(columns: PocketColumns): BinderPageData {
    return {pockets: Array<CardSummary | null>(pocketsPerPage(columns)).fill(null)};
}

export function createDefaultBinder(): Binder {
    const columns = DEFAULT_POCKET_COLUMNS;
    return {
        title: DEFAULT_BINDER_TITLE,
        pocketColumns: columns,
        pocketGap: DEFAULT_POCKET_GAP,
        pages: [createEmptyPage(columns), createEmptyPage(columns), createEmptyPage(columns)],
        artPlacements: [],
    };
}

export interface PageChangePlan {
    pages: BinderPageData[];
    artPlacements: ArtPlacement[];
    droppedTitles: string[];
}

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

export interface PocketColumnsChangePlan {
    pages: BinderPageData[];
    artPlacements: ArtPlacement[];
    droppedTitles: string[];
    droppedCardNames: string[];
}

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

    const coveredKeys = new Set<string>();
    const artPlacements: ArtPlacement[] = [];
    const droppedTitles: string[] = [];
    for (const placement of binder.artPlacements) {
        if (validateRectShape(placement.rect, pages.length, newColumns) !== null) {
            droppedTitles.push(placement.art.title);
            continue;
        }
        const covered = listCoveredPockets(placement.rect, newColumns).map(pocketKey);
        if (covered.some((key) => coveredKeys.has(key))) {
            droppedTitles.push(placement.art.title);
            continue;
        }
        covered.forEach((key) => coveredKeys.add(key));
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

        case "SET_POCKET_GAP": {
            const {gap} = action;
            if (gap.xMm === binder.pocketGap.xMm && gap.yMm === binder.pocketGap.yMm) {
                return binder;
            }
            return {...binder, pocketGap: gap};
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
            return withUpdatedPocket(binder, action.pocket, action.card);
        }

        case "MOVE_CARD": {
            const {from, to} = action;
            const fromCard =
                binder.pages[from.pageIndex]?.pockets[pocketIndexOf(from, binder.pocketColumns)];
            if (fromCard === null || fromCard === undefined) {
                return binder;
            }
            const toCard =
                binder.pages[to.pageIndex]?.pockets[pocketIndexOf(to, binder.pocketColumns)] ?? null;
            return withUpdatedPocket(withUpdatedPocket(binder, to, fromCard), from, toCard);
        }

        case "SET_CARD_OWNED": {
            const card = binder.pages[action.pocket.pageIndex]?.pockets[pocketIndexOf(action.pocket, binder.pocketColumns)];
            if (card === null || card === undefined || (card.owned === true) === action.owned) {
                return binder;
            }
            return withUpdatedPocket(binder, action.pocket, {...card, owned: action.owned});
        }

        case "CLEAR_POCKET": {
            const card =
                binder.pages[action.pocket.pageIndex]?.pockets[
                    pocketIndexOf(action.pocket, binder.pocketColumns)
                    ] ?? null;
            if (card !== null) {
                return withUpdatedPocket(binder, action.pocket, null);
            }
            const placement = findPlacementCovering(
                binder.artPlacements,
                action.pocket,
                binder.pocketColumns
            );
            if (placement !== null) {
                return {
                    ...binder,
                    artPlacements: binder.artPlacements.filter((p) => p.id !== placement.id),
                };
            }
            return binder;
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

        case "SET_ART_CROP": {
            return {
                ...binder,
                artPlacements: binder.artPlacements.map((p) =>
                    p.id === action.placementId ? {...p, crop: action.crop} : p
                ),
            };
        }

        case "REMOVE_ART_PLACEMENT": {
            return {
                ...binder,
                artPlacements: binder.artPlacements.filter((p) => p.id !== action.placementId),
            };
        }

        case "SET_CARD_IMAGES": {
            const {imageUrlsByCardId} = action;
            let changed = false;
            const pages = binder.pages.map((page) => ({
                pockets: page.pockets.map((card) => {
                    const imageUrl = card === null ? undefined : imageUrlsByCardId.get(card.id);
                    if (card === null || imageUrl === undefined || imageUrl === card.smallImageUrl) {
                        return card;
                    }
                    changed = true;
                    return {...card, smallImageUrl: imageUrl};
                }),
            }));
            return changed ? {...binder, pages} : binder;
        }
    }
}

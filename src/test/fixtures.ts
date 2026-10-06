import type {ArtPiece} from "../types/art";
import type {Binder, PocketColumns} from "../types/binder";
import type {CardSummary} from "../types/card";
import {binderReducer, createDefaultBinder} from "../features/binder/state/binderReducer";

export function makeCard(name: string, overrides: Partial<CardSummary> = {}): CardSummary {
    return {
        id: `en:${name}`,
        name,
        setName: "Test Set",
        number: "1",
        rarity: null,
        smallImageUrl: `https://example.test/${name}.webp`,
        marketPrice: 1,
        ...overrides,
    };
}

export const TEST_ART: ArtPiece = {
    id: "art-1",
    title: "Sky",
    category: "Uploads",
    imageUrl: "https://example.test/sky.png",
    sourceUrl: null,
};

export function makeBinder(columns: PocketColumns, pageCount: number): Binder {
    let binder = createDefaultBinder();
    if (columns !== binder.pocketColumns) {
        binder = binderReducer(binder, {type: "SET_POCKET_COLUMNS", columns});
    }
    while (binder.pages.length < pageCount) {
        binder = binderReducer(binder, {type: "ADD_PAGE_AFTER", pageIndex: binder.pages.length - 1});
    }
    return binder;
}

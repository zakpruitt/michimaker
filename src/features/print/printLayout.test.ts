import {describe, expect, it} from "vitest";
import {POCKET_HEIGHT_MM, POCKET_WIDTH_MM, type Binder} from "../../types/binder";
import {makeBinder, makeCard, TEST_ART} from "../../test/fixtures";
import {binderReducer} from "../binder/state/binderReducer";
import {buildPocketContentMap} from "../binder/state/gridMath";
import type {PaperSize} from "./paper";
import {
    blockSizeMm,
    buildPrintLayout,
    cellOriginMm,
    countProxyCopies,
    listPrintCells,
    listProxyCandidates,
    type PrintLayout,
    type PrintSettings,
} from "./printLayout";

function layout(binder: Binder, settings: Partial<PrintSettings> & Pick<PrintSettings, "job" | "paper">): PrintLayout {
    return buildPrintLayout(binder, buildPocketContentMap(binder), {
        pageIndexes: "all",
        connectStrips: false,
        proxySelection: "needed",
        proxyCopies: new Map(),
        grayscaleCards: false,
        ...settings,
    });
}

function expectWithinPrintableArea(result: PrintLayout): void {
    const width = result.pageWidthMm - 2 * result.marginMm;
    const height = result.pageHeightMm - 2 * result.marginMm;
    for (const sheet of result.sheets) {
        for (const {piece, xMm, yMm} of sheet.pieces) {
            const labelHeight = piece.label === null ? 0 : result.labelHeightMm;
            const block = blockSizeMm(piece, result.pocketGap);
            expect(xMm).toBeGreaterThanOrEqual(0);
            expect(yMm).toBeGreaterThanOrEqual(0);
            expect(xMm + block.widthMm).toBeLessThanOrEqual(width + 0.01);
            expect(yMm + block.heightMm + labelHeight).toBeLessThanOrEqual(height + 0.01);
        }
    }
}

function withCards(binder: Binder, count: number, ownedIndexes: number[] = []): Binder {
    let result = binder;
    for (let index = 0; index < count; index++) {
        result = binderReducer(result, {
            type: "PLACE_CARD",
            pocket: {pageIndex: Math.floor(index / 9), row: Math.floor((index % 9) / 3), column: index % 3},
            card: makeCard(`card-${index}`, {owned: ownedIndexes.includes(index)}),
        });
    }
    return result;
}

describe.each<PaperSize>(["letter", "a4"])("buildPrintLayout on %s", (paper) => {
    it("fits a whole 9-pocket page on one portrait sheet", () => {
        const result = layout(makeBinder(3, 3), {job: "pages", paper});
        expect(result.orientation).toBe("portrait");
        expect(result.sheets.map((sheet) => sheet.pieces.length)).toEqual([1, 1, 1]);
        expectWithinPrintableArea(result);
    });

    it("splits 12-pocket pages, which are too big for the paper, and labels each part", () => {
        const result = layout(makeBinder(4, 3), {job: "pages", paper});
        expect(result.sheets.length).toBeLessThanOrEqual(4);
        const labels = result.sheets.flatMap((sheet) => sheet.pieces.map(({piece}) => piece.label));
        expect(labels.every((label) => /(rows?|columns?) \d/.test(label ?? ""))).toBe(true);
        expectWithinPrintableArea(result);
    });

    it("prints only the cards still needed, nine to a sheet with no gaps", () => {
        const result = layout(withCards(makeBinder(3, 2), 11, [0]), {job: "proxies", paper});
        expect(listPrintCells(result)).toHaveLength(10);
        expect(result.sheets.map((sheet) => sheet.pieces.length)).toEqual([9, 1]);
        const columns = [...new Set(result.sheets[0].pieces.map(({xMm}) => xMm.toFixed(2)))].map(Number);
        expect(columns).toHaveLength(3);
        expect(columns[1] - columns[0]).toBeCloseTo(POCKET_WIDTH_MM);
        expectWithinPrintableArea(result);
    });

    it("prints every card when asked", () => {
        const result = layout(withCards(makeBinder(3, 2), 11, [0]), {job: "proxies", paper, proxySelection: "all"});
        expect(listPrintCells(result)).toHaveLength(11);
    });
});

describe("art cut-outs", () => {
    function spreadWithHole(gapMm = 7): Binder {
        let binder = makeBinder(3, 3);
        binder = binderReducer(binder, {type: "SET_POCKET_GAP", gap: {xMm: gapMm, yMm: gapMm}});
        binder = binderReducer(binder, {
            type: "PLACE_ART",
            placement: {
                id: "spread",
                art: TEST_ART,
                rect: {pageIndex: 1, row: 0, column: 0, rowCount: 3, columnCount: 6},
                crop: {zoom: 1, panX: 0, panY: 0},
            },
        });
        return binderReducer(binder, {type: "PLACE_CARD", pocket: {pageIndex: 2, row: 1, column: 1}, card: makeCard("hole")});
    }

    it("splits a spread at the gutter and skips pockets hidden behind cards", () => {
        const result = layout(spreadWithHole(0), {job: "art", paper: "letter"});
        expect(listPrintCells(result)).toHaveLength(17);
        const rightPage = result.sheets
            .flatMap((sheet) => sheet.pieces)
            .find(({piece}) => piece.label?.startsWith("Page 3"))!.piece;
        expect(rightPage.cells.map((cell) => (cell === null ? "_" : "#")).join("")).toBe("####_####");
    });

    it.each<PaperSize>(["letter", "a4"])("prints each piece whole, spaced by the pocket seams, on %s", (paper) => {
        const result = layout(spreadWithHole(), {job: "art", paper});
        expect(result.pocketGap).toEqual({xMm: 7, yMm: 7});
        expectWithinPrintableArea(result);
        for (const {piece} of result.sheets.flatMap((sheet) => sheet.pieces)) {
            expect(piece.artFill?.placement.id).toBe("spread");
            const second = cellOriginMm(piece, 1, result.pocketGap);
            if (piece.columns > 1) {
                expect(second.xMm).toBeCloseTo(POCKET_WIDTH_MM + 7);
            }
            expect(blockSizeMm(piece, result.pocketGap).heightMm).toBeCloseTo(
                piece.rows * POCKET_HEIGHT_MM + (piece.rows - 1) * 7
            );
        }
    });

    it("keeps whole-page guides and proxies edge to edge", () => {
        expect(layout(spreadWithHole(), {job: "pages", paper: "letter"}).pocketGap).toEqual({xMm: 0, yMm: 0});
        expect(layout(spreadWithHole(), {job: "proxies", paper: "letter"}).pocketGap).toEqual({xMm: 0, yMm: 0});
    });

    it("always cuts around every pocket when there is a seam between them", () => {
        const cuts = layout(spreadWithHole(), {job: "art", paper: "letter", connectStrips: true})
            .sheets.flatMap((sheet) => sheet.pieces)
            .flatMap(({piece}) => piece.cells)
            .map((cell) => cell?.cut);
        expect(cuts.every((cut) => cut === undefined || (cut.left && cut.right && cut.top && cut.bottom))).toBe(true);
    });

    it("leaves out cut lines between side-by-side pieces only when strips are connected", () => {
        const firstRow = (connectStrips: boolean) =>
            layout(spreadWithHole(0), {job: "art", paper: "letter", connectStrips})
                .sheets.flatMap((sheet) => sheet.pieces)
                .find(({piece}) => piece.label?.startsWith("Page 2"))!
                .piece.cells.slice(0, 3)
                .map((cell) => cell!.cut);

        const connected = firstRow(true);
        expect(connected.map(({left, right}) => [left, right])).toEqual([[true, false], [false, false], [false, true]]);
        expect(connected.every(({top, bottom}) => top && bottom)).toBe(true);
        expect(firstRow(false).every(({left, right}) => left && right)).toBe(true);
    });
});

describe("proxy quantities", () => {
    function binderWithDuplicates(): Binder {
        let binder = makeBinder(3, 1);
        const place = (pocketIndex: number, card: ReturnType<typeof makeCard>) =>
            binderReducer(binder, {
                type: "PLACE_CARD",
                pocket: {pageIndex: 0, row: Math.floor(pocketIndex / 3), column: pocketIndex % 3},
                card,
            });
        binder = place(0, makeCard("pikachu"));
        binder = place(1, makeCard("pikachu", {owned: true}));
        binder = place(2, makeCard("pikachu"));
        binder = place(3, makeCard("charizard", {owned: true}));
        return binder;
    }

    it("groups duplicate printings and defaults to the copies still needed", () => {
        const candidates = listProxyCandidates(binderWithDuplicates(), "all");
        expect(candidates.map(({card, pocketCount, neededCount}) => [card.name, pocketCount, neededCount])).toEqual([
            ["pikachu", 3, 2],
            ["charizard", 1, 0],
        ]);
        const result = layout(binderWithDuplicates(), {job: "proxies", paper: "letter"});
        expect(listPrintCells(result).map((cell) => cell.fileName)).toEqual([
            "page01_r1c1_pikachu",
            "page01_r1c1_pikachu-2",
        ]);
    });

    it("prints every pocket, or the exact amount chosen per card", () => {
        expect(listPrintCells(layout(binderWithDuplicates(), {job: "proxies", paper: "letter", proxySelection: "all"}))).toHaveLength(4);
        const custom = layout(binderWithDuplicates(), {
            job: "proxies",
            paper: "letter",
            proxyCopies: new Map([["en:pikachu", 0], ["en:charizard", 3]]),
        });
        expect(listPrintCells(custom).map((cell) => cell.fileName)).toEqual([
            "page01_r2c1_charizard",
            "page01_r2c1_charizard-2",
            "page01_r2c1_charizard-3",
        ]);
        expect(countProxyCopies(binderWithDuplicates(), {
            pageIndexes: "all",
            proxySelection: "needed",
            proxyCopies: new Map([["en:charizard", 1]]),
        })).toBe(3);
    });

    it("only turns cards black and white outside the art cut-outs", () => {
        expect(layout(binderWithDuplicates(), {job: "proxies", paper: "letter", grayscaleCards: true}).grayscaleCards).toBe(true);
        expect(layout(binderWithDuplicates(), {job: "art", paper: "letter", grayscaleCards: true}).grayscaleCards).toBe(false);
    });
});

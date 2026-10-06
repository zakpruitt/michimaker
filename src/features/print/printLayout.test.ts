import {describe, expect, it} from "vitest";
import {POCKET_HEIGHT_MM, POCKET_WIDTH_MM, type Binder} from "../../types/binder";
import {makeBinder, makeCard, TEST_ART} from "../../test/fixtures";
import {binderReducer} from "../binder/state/binderReducer";
import {buildPocketContentMap} from "../binder/state/gridMath";
import type {PaperSize} from "./paper";
import {buildPrintLayout, listPrintCells, type PrintLayout, type PrintSettings} from "./printLayout";

function layout(binder: Binder, settings: Partial<PrintSettings> & Pick<PrintSettings, "job" | "paper">): PrintLayout {
    return buildPrintLayout(binder, buildPocketContentMap(binder), {
        pageIndexes: "all",
        connectStrips: false,
        proxySelection: "needed",
        ...settings,
    });
}

function expectWithinPrintableArea(result: PrintLayout): void {
    const width = result.pageWidthMm - 2 * result.marginMm;
    const height = result.pageHeightMm - 2 * result.marginMm;
    for (const sheet of result.sheets) {
        for (const {piece, xMm, yMm} of sheet.pieces) {
            const labelHeight = piece.label === null ? 0 : result.labelHeightMm;
            expect(xMm).toBeGreaterThanOrEqual(0);
            expect(yMm).toBeGreaterThanOrEqual(0);
            expect(xMm + piece.columns * POCKET_WIDTH_MM).toBeLessThanOrEqual(width + 0.01);
            expect(yMm + piece.rows * POCKET_HEIGHT_MM + labelHeight).toBeLessThanOrEqual(height + 0.01);
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
    function spreadWithHole(): Binder {
        let binder = makeBinder(3, 3);
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
        const result = layout(spreadWithHole(), {job: "art", paper: "letter"});
        expect(listPrintCells(result)).toHaveLength(17);
        const rightPage = result.sheets
            .flatMap((sheet) => sheet.pieces)
            .find(({piece}) => piece.label?.startsWith("Page 3"))!.piece;
        expect(rightPage.cells.map((cell) => (cell === null ? "_" : "#")).join("")).toBe("####_####");
    });

    it("leaves out cut lines between side-by-side pieces only when strips are connected", () => {
        const firstRow = (connectStrips: boolean) =>
            layout(spreadWithHole(), {job: "art", paper: "letter", connectStrips})
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

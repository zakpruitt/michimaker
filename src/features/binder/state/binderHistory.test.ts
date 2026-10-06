import {describe, expect, it} from "vitest";
import {makeBinder, makeCard} from "../../../test/fixtures";
import {binderHistoryReducer, createBinderHistory} from "./binderHistory";
import {createDefaultBinder} from "./binderReducer";

const pocket = {pageIndex: 0, row: 0, column: 0};

describe("binderHistoryReducer", () => {
    it("undoes and redoes edits", () => {
        let history = createBinderHistory(makeBinder(3, 2));
        history = binderHistoryReducer(history, {type: "PLACE_CARD", pocket, card: makeCard("pika")});
        history = binderHistoryReducer(history, {type: "UNDO"});
        expect(history.present.pages[0].pockets[0]).toBeNull();
        history = binderHistoryReducer(history, {type: "REDO"});
        expect(history.present.pages[0].pockets[0]?.name).toBe("pika");
    });

    it("treats a run of title edits as one undo step", () => {
        let history = createBinderHistory(makeBinder(3, 1));
        for (const title of ["M", "My", "My Binder"]) {
            history = binderHistoryReducer(history, {type: "SET_TITLE", title});
        }
        expect(history.past).toHaveLength(1);
        expect(binderHistoryReducer(history, {type: "UNDO"}).present.title).toBe(makeBinder(3, 1).title);
    });

    it("ignores undo with nothing to undo and drops redo after a new edit", () => {
        const start = createBinderHistory(makeBinder(3, 1));
        expect(binderHistoryReducer(start, {type: "UNDO"})).toBe(start);

        let history = binderHistoryReducer(start, {type: "PLACE_CARD", pocket, card: makeCard("a")});
        history = binderHistoryReducer(history, {type: "UNDO"});
        history = binderHistoryReducer(history, {type: "SET_TITLE", title: "New"});
        expect(history.future).toHaveLength(0);
    });

    it("lets a fresh binder be undone", () => {
        let history = createBinderHistory(makeBinder(3, 1));
        history = binderHistoryReducer(history, {type: "PLACE_CARD", pocket, card: makeCard("keep")});
        history = binderHistoryReducer(history, {type: "REPLACE_BINDER", binder: createDefaultBinder()});
        history = binderHistoryReducer(history, {type: "UNDO"});
        expect(history.present.pages[0].pockets[0]?.name).toBe("keep");
    });

    it("migrates inlined card images without adding an undo step", () => {
        let history = createBinderHistory(makeBinder(3, 1));
        history = binderHistoryReducer(history, {
            type: "PLACE_CARD",
            pocket,
            card: makeCard("old", {smallImageUrl: "data:image/webp;base64,AAAA"}),
        });
        const pastLength = history.past.length;
        history = binderHistoryReducer(history, {
            type: "SET_CARD_IMAGES",
            imageUrlsByCardId: new Map([["en:old", "https://assets.example/old/high.webp"]]),
        });
        expect(history.past).toHaveLength(pastLength);
        expect(history.present.pages[0].pockets[0]?.smallImageUrl).toBe("https://assets.example/old/high.webp");
    });

    it("toggles whether a card is owned", () => {
        let history = createBinderHistory(makeBinder(3, 1));
        history = binderHistoryReducer(history, {type: "PLACE_CARD", pocket, card: makeCard("a")});
        history = binderHistoryReducer(history, {type: "SET_CARD_OWNED", pocket, owned: true});
        expect(history.present.pages[0].pockets[0]?.owned).toBe(true);
        history = binderHistoryReducer(history, {type: "UNDO"});
        expect(history.present.pages[0].pockets[0]?.owned).toBeUndefined();
    });
});

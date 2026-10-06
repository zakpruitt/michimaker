import {describe, expect, it} from "vitest";
import {DEFAULT_POCKET_GAP} from "../../types/binder";
import {makeBinder, makeCard} from "../../test/fixtures";
import {
    BinderDecodeError,
    decodeBinderFromParam,
    encodeBinderToParam,
    envelopeToJson,
    parseBinderJson,
} from "./binderCodec";

function binderWithPockets(pockets: unknown[]) {
    const binder = makeBinder(3, 1);
    return {...binder, pages: [{pockets: [...pockets, ...Array.from({length: 9 - pockets.length}, () => null)]}]};
}

describe("binderCodec", () => {
    it("round-trips a binder through a share link", () => {
        const binder = {...makeBinder(3, 2), title: "Round trip"};
        binder.pages[0].pockets[4] = makeCard("pika", {owned: true});
        expect(decodeBinderFromParam(encodeBinderToParam(binder))).toEqual(binder);
    });

    it("drops malformed cards and fills in missing optional fields", () => {
        const json = JSON.stringify({
            version: 1,
            binder: binderWithPockets([{name: "no id"}, "junk", {id: "en:x", smallImageUrl: "https://x"}]),
        });
        const pockets = parseBinderJson(json).pages[0].pockets;
        expect(pockets[0]).toBeNull();
        expect(pockets[1]).toBeNull();
        expect(pockets[2]).toEqual({
            id: "en:x",
            name: "Unknown card",
            setName: "",
            number: "",
            rarity: null,
            smallImageUrl: "https://x",
            marketPrice: null,
        });
    });

    it("gives older binders the default pocket gap", () => {
        const legacy: Record<string, unknown> = {...makeBinder(3, 1)};
        delete legacy.pocketGap;
        expect(parseBinderJson(JSON.stringify({version: 1, binder: legacy})).pocketGap).toEqual(DEFAULT_POCKET_GAP);
    });

    it("rejects data that is not a binder", () => {
        expect(() => parseBinderJson("not json")).toThrow(BinderDecodeError);
        expect(() => parseBinderJson(envelopeToJson({...makeBinder(3, 1), pages: []}, false))).toThrow(
            BinderDecodeError
        );
        expect(() => decodeBinderFromParam("%%%")).toThrow(BinderDecodeError);
    });
});

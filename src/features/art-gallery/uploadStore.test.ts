import "fake-indexeddb/auto";
import {describe, expect, it} from "vitest";
import type {ArtPiece} from "../../types/art";
import {deleteUpload, loadUploads, saveUploads, UPLOADS_CATEGORY} from "./uploadStore";

function upload(id: string): ArtPiece {
    return {id, title: `${id}.png`, category: UPLOADS_CATEGORY, imageUrl: `data:image/webp;base64,${id}`, sourceUrl: null};
}

describe("uploadStore", () => {
    it("keeps uploads, newest first, and forgets removed ones", async () => {
        expect(await loadUploads()).toEqual([]);

        await saveUploads([upload("first")]);
        await saveUploads([upload("second"), upload("third")]);
        expect((await loadUploads()).map((piece) => piece.id)).toEqual(["second", "third", "first"]);

        await deleteUpload("third");
        expect(await loadUploads()).toEqual([upload("second"), upload("first")]);
    });

    it("overwrites an upload saved again with the same id", async () => {
        await saveUploads([{...upload("first"), title: "renamed.png"}]);
        const first = (await loadUploads()).find((piece) => piece.id === "first");
        expect(first?.title).toBe("renamed.png");
    });
});

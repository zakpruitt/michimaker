import {deflate, inflate} from "pako";
import {
    type ArtPlacement,
    type Binder,
    type BinderPageData,
    DEFAULT_POCKET_COLUMNS,
    normalizeArtCrop,
    normalizePocketGap,
    pocketsPerPage,
} from "../../types/binder";
import type {CardSummary} from "../../types/card";
import {validateRectShape} from "../binder/state/gridMath";

const BINDER_FORMAT_VERSION = 1;

export interface BinderEnvelope {
    version: number;
    binder: Binder;
}

export class BinderDecodeError extends Error {
}

export function encodeBinderToParam(binder: Binder): string {
    return toBase64Url(deflate(envelopeToJson(binder, false)));
}

export function decodeBinderFromParam(encoded: string): Binder {
    let json: string;
    try {
        json = inflate(fromBase64Url(encoded), {to: "string"});
    } catch {
        throw new BinderDecodeError(
            "The share link is corrupted or truncated and could not be decompressed."
        );
    }
    return parseBinderJson(json);
}

export function parseBinderJson(json: string): Binder {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new BinderDecodeError("The binder data is not valid JSON.");
    }
    return validateEnvelope(parsed);
}

export function envelopeToJson(binder: Binder, pretty: boolean): string {
    const envelope: BinderEnvelope = {version: BINDER_FORMAT_VERSION, binder};
    return pretty ? JSON.stringify(envelope, null, 2) : JSON.stringify(envelope);
}

function validateEnvelope(value: unknown): Binder {
    if (typeof value !== "object" || value === null) {
        throw new BinderDecodeError("The binder data has an unexpected shape.");
    }
    const envelope = value as Partial<BinderEnvelope>;
    if (envelope.version !== BINDER_FORMAT_VERSION) {
        throw new BinderDecodeError(
            `Unsupported binder format version: ${String(envelope.version)}.`
        );
    }
    return validateBinder(envelope.binder);
}

function validateBinder(value: unknown): Binder {
    if (typeof value !== "object" || value === null) {
        throw new BinderDecodeError("The binder data has an unexpected shape.");
    }
    const binder = value as Partial<Binder>;
    if (typeof binder.title !== "string") {
        throw new BinderDecodeError("The binder data has no title.");
    }
    const pocketColumns =
        binder.pocketColumns === 3 || binder.pocketColumns === 4
            ? binder.pocketColumns
            : DEFAULT_POCKET_COLUMNS;
    if (!Array.isArray(binder.pages) || binder.pages.length === 0) {
        throw new BinderDecodeError("The binder data contains no pages.");
    }
    if (!Array.isArray(binder.artPlacements)) {
        throw new BinderDecodeError("The binder data has no art placement list.");
    }
    binder.pages.forEach((page) => validatePage(page, pocketsPerPage(pocketColumns)));
    binder.artPlacements.forEach(validatePlacement);
    const pages = binder.pages.map((page) => ({pockets: page.pockets.map(normalizeCard)}));
    const artPlacements = binder.artPlacements
        .filter((placement) => validateRectShape(placement.rect, pages.length, pocketColumns) === null)
        .map((placement) => ({...placement, crop: normalizeArtCrop(placement.crop)}));
    return {title: binder.title, pocketColumns, pocketGap: normalizePocketGap(binder.pocketGap), pages, artPlacements};
}

function validatePage(
    value: unknown,
    expectedPocketCount: number
): asserts value is BinderPageData {
    const page = value as Partial<BinderPageData> | null;
    if (
        typeof page !== "object" ||
        page === null ||
        !Array.isArray(page.pockets) ||
        page.pockets.length !== expectedPocketCount
    ) {
        throw new BinderDecodeError("A page in the binder data is malformed.");
    }
}

function normalizeCard(value: unknown): CardSummary | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const card = value as Partial<CardSummary>;
    if (typeof card.id !== "string" || typeof card.smallImageUrl !== "string") {
        return null;
    }
    return {
        id: card.id,
        name: typeof card.name === "string" ? card.name : "Unknown card",
        setName: typeof card.setName === "string" ? card.setName : "",
        number: typeof card.number === "string" ? card.number : "",
        rarity: typeof card.rarity === "string" ? card.rarity : null,
        smallImageUrl: card.smallImageUrl,
        marketPrice: typeof card.marketPrice === "number" && Number.isFinite(card.marketPrice) ? card.marketPrice : null,
        ...(card.owned === true ? {owned: true} : {}),
    };
}

function validatePlacement(value: unknown): asserts value is ArtPlacement {
    const placement = value as Partial<ArtPlacement> | null;
    const rect = placement?.rect;
    const art = placement?.art;
    const isValid =
        typeof placement === "object" &&
        placement !== null &&
        typeof placement.id === "string" &&
        typeof art === "object" &&
        art !== null &&
        typeof art.imageUrl === "string" &&
        typeof art.title === "string" &&
        typeof rect === "object" &&
        rect !== null &&
        [rect.pageIndex, rect.row, rect.column, rect.rowCount, rect.columnCount].every(
            (n) => typeof n === "number" && Number.isInteger(n)
        );
    if (!isValid) {
        throw new BinderDecodeError("An art placement in the binder data is malformed.");
    }
}

function toBase64Url(bytes: Uint8Array): string {
    const chunkSize = 0x8000;
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): Uint8Array {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    let binary: string;
    try {
        binary = atob(base64);
    } catch {
        throw new BinderDecodeError("The share link contains invalid characters.");
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

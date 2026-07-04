/**
 * Serialization of a Binder to and from a compact, URL-safe string:
 *
 *   Binder → JSON → deflate (pako) → base64url
 *
 * and the reverse. Also owns shape validation of decoded data, since share
 * links and imported files arrive from outside the app and can be corrupted.
 *
 * Rough Java analogy: a Jackson ObjectMapper plus a bean validator, wrapped
 * in one codec class.
 */
import { deflate, inflate } from "pako";
import {
  pocketsPerPage,
  type ArtPlacement,
  type Binder,
  type BinderPageData,
} from "../../types/binder";
import { validateRectShape } from "../binder/gridMath";

/** Bumped if the persisted shape ever changes incompatibly. */
export const BINDER_FORMAT_VERSION = 1;

/** Envelope written to share links, localStorage, and exported files. */
export interface BinderEnvelope {
  version: number;
  binder: Binder;
}

/** Thrown when incoming data cannot be decoded into a valid Binder. */
export class BinderDecodeError extends Error {}

export function encodeBinderToParam(binder: Binder): string {
  return toBase64Url(deflate(envelopeToJson(binder, false)));
}

export function decodeBinderFromParam(encoded: string): Binder {
  let json: string;
  try {
    json = inflate(fromBase64Url(encoded), { to: "string" });
  } catch {
    throw new BinderDecodeError(
      "The share link is corrupted or truncated and could not be decompressed."
    );
  }
  return parseBinderJson(json);
}

/** Parses and validates envelope JSON (share links, files, localStorage). */
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
  const envelope: BinderEnvelope = { version: BINDER_FORMAT_VERSION, binder };
  return pretty ? JSON.stringify(envelope, null, 2) : JSON.stringify(envelope);
}

// ---------------------------------------------------------------------------
// Validation of untrusted decoded data
// ---------------------------------------------------------------------------

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
  const pocketColumns = binder.pocketColumns;
  if (pocketColumns !== 3 && pocketColumns !== 4) {
    throw new BinderDecodeError("The binder data has no pocket layout.");
  }
  if (!Array.isArray(binder.pages) || binder.pages.length === 0) {
    throw new BinderDecodeError("The binder data contains no pages.");
  }
  if (!Array.isArray(binder.artPlacements)) {
    throw new BinderDecodeError("The binder data has no art placement list.");
  }
  binder.pages.forEach((page) => validatePage(page, pocketsPerPage(pocketColumns)));
  binder.artPlacements.forEach(validatePlacement);
  const pages = binder.pages;
  // Field checks above guarantee well-formed placements; this reuses the
  // app's single definition of a geometrically legal span, silently dropping
  // spans a hand-edited or corrupted file puts where they could never go.
  const artPlacements = binder.artPlacements.filter(
    (placement) => validateRectShape(placement.rect, pages.length, pocketColumns) === null
  );
  return { title: binder.title, pocketColumns, pages, artPlacements };
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

// ---------------------------------------------------------------------------
// base64url helpers (the standard base64 alphabet uses "+" and "/", which are
// not safe inside a URL query parameter)
// ---------------------------------------------------------------------------

function toBase64Url(bytes: Uint8Array): string {
  // Convert in chunks: String.fromCharCode(...allBytes) overflows the argument
  // limit for large binders.
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

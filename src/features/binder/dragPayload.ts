/**
 * Helpers for the HTML5 drag-and-drop payloads used when dragging a search
 * result card or a gallery art piece onto a binder pocket. The payload is
 * JSON under a custom dataTransfer type, so pockets can tell the two apart
 * (and ignore unrelated drops like files or text).
 */
import type { ArtPiece } from "../../types/art";
import type { CardSummary } from "../../types/card";

const CARD_MIME_TYPE = "application/x-binder-card";
const ART_MIME_TYPE = "application/x-binder-art";

export function setCardDragPayload(event: React.DragEvent, card: CardSummary): void {
  event.dataTransfer.setData(CARD_MIME_TYPE, JSON.stringify(card));
  event.dataTransfer.effectAllowed = "copy";
}

export function setArtDragPayload(event: React.DragEvent, art: ArtPiece): void {
  event.dataTransfer.setData(ART_MIME_TYPE, JSON.stringify(art));
  event.dataTransfer.effectAllowed = "copy";
}

export function dragPayloadHasCard(event: React.DragEvent): boolean {
  return event.dataTransfer.types.includes(CARD_MIME_TYPE);
}

export function dragPayloadHasArt(event: React.DragEvent): boolean {
  return event.dataTransfer.types.includes(ART_MIME_TYPE);
}

export function readCardDragPayload(event: React.DragEvent): CardSummary | null {
  return parsePayload<CardSummary>(event.dataTransfer.getData(CARD_MIME_TYPE));
}

export function readArtDragPayload(event: React.DragEvent): ArtPiece | null {
  return parsePayload<ArtPiece>(event.dataTransfer.getData(ART_MIME_TYPE));
}

function parsePayload<T>(raw: string): T | null {
  if (raw === "") {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

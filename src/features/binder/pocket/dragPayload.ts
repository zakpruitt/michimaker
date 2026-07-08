import type {ArtPiece} from "../../../types/art";
import type {PocketRef} from "../../../types/binder";
import type {CardSummary} from "../../../types/card";

const CARD_MIME_TYPE = "application/x-binder-card";
const ART_MIME_TYPE = "application/x-binder-art";
const CARD_MOVE_MIME_TYPE = "application/x-binder-card-move";
const ART_MOVE_MIME_TYPE = "application/x-binder-art-move";

/** Which cell of the span was grabbed, so the drop keeps the grab point under the cursor. */
export interface ArtMovePayload {
    placementId: string;
    rowOffset: number;
    columnOffset: number;
}

export function setCardDragPayload(event: React.DragEvent, card: CardSummary): void {
    event.dataTransfer.setData(CARD_MIME_TYPE, JSON.stringify(card));
    event.dataTransfer.effectAllowed = "copy";
}

export function setArtDragPayload(event: React.DragEvent, art: ArtPiece): void {
    event.dataTransfer.setData(ART_MIME_TYPE, JSON.stringify(art));
    event.dataTransfer.effectAllowed = "copy";
}

export function setCardMovePayload(event: React.DragEvent, from: PocketRef): void {
    event.dataTransfer.setData(CARD_MOVE_MIME_TYPE, JSON.stringify(from));
    event.dataTransfer.effectAllowed = "move";
}

export function setArtMovePayload(event: React.DragEvent, move: ArtMovePayload): void {
    event.dataTransfer.setData(ART_MOVE_MIME_TYPE, JSON.stringify(move));
    event.dataTransfer.effectAllowed = "move";
}

export function dragPayloadHasCard(event: React.DragEvent): boolean {
    return event.dataTransfer.types.includes(CARD_MIME_TYPE);
}

export function dragPayloadHasArt(event: React.DragEvent): boolean {
    return event.dataTransfer.types.includes(ART_MIME_TYPE);
}

export function dragPayloadHasMove(event: React.DragEvent): boolean {
    return (
        event.dataTransfer.types.includes(CARD_MOVE_MIME_TYPE) ||
        event.dataTransfer.types.includes(ART_MOVE_MIME_TYPE)
    );
}

export function readCardDragPayload(event: React.DragEvent): CardSummary | null {
    return parsePayload<CardSummary>(event.dataTransfer.getData(CARD_MIME_TYPE));
}

export function readArtDragPayload(event: React.DragEvent): ArtPiece | null {
    return parsePayload<ArtPiece>(event.dataTransfer.getData(ART_MIME_TYPE));
}

export function readCardMovePayload(event: React.DragEvent): PocketRef | null {
    return parsePayload<PocketRef>(event.dataTransfer.getData(CARD_MOVE_MIME_TYPE));
}

export function readArtMovePayload(event: React.DragEvent): ArtMovePayload | null {
    return parsePayload<ArtMovePayload>(event.dataTransfer.getData(ART_MOVE_MIME_TYPE));
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

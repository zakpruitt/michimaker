import type {ArtPiece} from "./types/art";

const objectUrlByArtId = new Map<string, string>();

function dataUrlToBlob(dataUrl: string): Blob | null {
    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex === -1) {
        return null;
    }
    const header = dataUrl.slice(5, commaIndex);
    if (!header.endsWith(";base64")) {
        return null;
    }
    const mimeType = header.slice(0, -";base64".length);
    let binary: string;
    try {
        binary = atob(dataUrl.slice(commaIndex + 1));
    } catch {
        return null;
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], {type: mimeType});
}

export function resolveArtImageUrl(art: ArtPiece): string {
    if (!art.imageUrl.startsWith("data:")) {
        return art.imageUrl;
    }
    const cached = objectUrlByArtId.get(art.id);
    if (cached !== undefined) {
        return cached;
    }
    const blob = dataUrlToBlob(art.imageUrl);
    if (blob === null) {
        return art.imageUrl;
    }
    const objectUrl = URL.createObjectURL(blob);
    objectUrlByArtId.set(art.id, objectUrl);
    return objectUrl;
}

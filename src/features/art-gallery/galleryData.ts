import type {ArtPiece} from "../../types/art";
import galleryJson from "../../data/art-gallery.json";

export function listGalleryArt(): ArtPiece[] {
    // resolveJsonModule gives us the parsed array; normalize nulls defensively
    // so a hand-edited entry with a missing field doesn't break the UI.
    return (galleryJson as Partial<ArtPiece>[]).flatMap((entry) => {
        if (
            typeof entry.id !== "string" ||
            typeof entry.title !== "string" ||
            typeof entry.imageUrl !== "string"
        ) {
            return [];
        }
        return [
            {
                id: entry.id,
                title: entry.title,
                category: typeof entry.category === "string" ? entry.category : "Uncategorized",
                imageUrl: entry.imageUrl,
                sourceUrl: typeof entry.sourceUrl === "string" ? entry.sourceUrl : null,
            },
        ];
    });
}

/** Distinct categories in gallery order. */
export function listCategories(artPieces: ArtPiece[]): string[] {
    const categories: string[] = [];
    for (const artPiece of artPieces) {
        if (!categories.includes(artPiece.category)) {
            categories.push(artPiece.category);
        }
    }
    return categories;
}

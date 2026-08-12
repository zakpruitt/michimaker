import type {ArtPiece} from "../../types/art";
import galleryJson from "../../data/art-gallery.json";

export const GALLERY_ART: ArtPiece[] = (galleryJson as Partial<ArtPiece>[]).flatMap((entry) => {
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

export function listCategories(artPieces: ArtPiece[]): string[] {
    const categories: string[] = [];
    for (const artPiece of artPieces) {
        if (!categories.includes(artPiece.category)) {
            categories.push(artPiece.category);
        }
    }
    return categories;
}

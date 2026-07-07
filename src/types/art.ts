export interface ArtPiece {
    id: string;
    title: string;
    /** Gallery grouping, e.g. "Pokémon" or "Characters". Uploads use "Uploads". */
    category: string;
    /** http(s) URL for gallery art, or a data: URL for uploaded images. */
    imageUrl: string;
    /** Attribution link back to where the art came from, if known. */
    sourceUrl: string | null;
}

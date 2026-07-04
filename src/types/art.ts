/**
 * Domain model for a piece of "Michi method" art: an image the user intends
 * to print, cut into pocket-sized rectangles, and slot across one or more
 * binder pockets.
 *
 * Art comes from either the curated gallery (src/data/art-gallery.json) or a
 * local file upload (in which case imageUrl is a data: URL that never leaves
 * the browser).
 */
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

/**
 * Domain model for a Pokémon card as stored in the binder.
 *
 * This is a slimmed-down snapshot of the Pokémon TCG API response (think: the
 * DTO we map the API entity into). Storing only these fields keeps saved
 * binders and share links small, and insulates saved data from API changes.
 */
export interface CardSummary {
  /** Pokémon TCG API card id, e.g. "sv3pt5-25". */
  id: string;
  name: string;
  setName: string;
  /** Collector number within the set (a string in the API, e.g. "25a"). */
  number: string;
  rarity: string | null;
  smallImageUrl: string;
  largeImageUrl: string | null;
  /** Market price in USD from TCGplayer, if the API provided one. */
  marketPrice: number | null;
}

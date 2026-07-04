/**
 * Domain model for a Pokémon card as stored in the binder.
 *
 * This is a slimmed-down snapshot of the PokeWallet API response (think: the
 * DTO we map the API entity into), and insulates saved data from API changes.
 */
export interface CardSummary {
  /** PokeWallet card id, e.g. "pk_72046…". */
  id: string;
  name: string;
  setName: string;
  /** Collector number within the set (a string in the API, e.g. "148/165"). */
  number: string;
  rarity: string | null;
  /**
   * data: URL of the card image, baked in at placement time because the
   * PokeWallet image endpoint needs an API key the binder viewer may lack.
   */
  smallImageUrl: string;
  largeImageUrl: string | null;
  /** Market price in USD from TCGplayer, if the API provided one. */
  marketPrice: number | null;
}

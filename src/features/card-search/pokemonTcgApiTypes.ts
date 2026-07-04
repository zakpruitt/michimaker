/**
 * Raw response shapes from the Pokémon TCG API (https://docs.pokemontcg.io/),
 * limited to the fields this app reads. These are the wire-format DTOs; the
 * app immediately maps them to the domain CardSummary and never stores them.
 */

export interface PokemonTcgCardListResponse {
  data?: PokemonTcgCard[];
}

export interface PokemonTcgCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  set?: {
    id: string;
    name: string;
  };
  images?: {
    small?: string;
    large?: string;
  };
  tcgplayer?: {
    prices?: Record<string, PokemonTcgPriceVariant | undefined>;
  };
}

/** Prices per printing variant ("normal", "holofoil", "reverseHolofoil", ...). */
export interface PokemonTcgPriceVariant {
  market?: number;
}

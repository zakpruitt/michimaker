/**
 * Client for the Pokémon TCG API card search, the app's only network call.
 *
 * The API key is optional: it comes from the VITE_POKEMON_TCG_API_KEY env
 * var (see .env.example). Without a key the API still works, just at lower
 * unauthenticated rate limits, so the header is simply omitted.
 *
 * Rough Java analogy: a small @Service HTTP client that maps wire DTOs
 * (pokemonTcgApiTypes.ts) into the domain model (CardSummary).
 */
import type { CardSummary } from "../../types/card";
import type {
  PokemonTcgCard,
  PokemonTcgCardListResponse,
} from "./pokemonTcgApiTypes";

const API_BASE_URL = "https://api.pokemontcg.io/v2";
const PAGE_SIZE = 60;

export interface CardSearchCriteria {
  /** Card name, matched as a phrase; empty string = any. */
  name: string;
  /** Exact rarity label; empty string = any. */
  rarity: string;
  /** Set id like "sv3pt5"; empty string = any. */
  setId: string;
  /** API sort expression, e.g. "set.id,number". */
  orderBy: string;
}

export function hasApiKey(): boolean {
  return readApiKey() !== null;
}

export async function searchCards(criteria: CardSearchCriteria): Promise<CardSummary[]> {
  const params = new URLSearchParams();
  const query = buildQueryString(criteria);
  if (query !== "") {
    params.set("q", query);
  }
  params.set("orderBy", criteria.orderBy);
  params.set("pageSize", String(PAGE_SIZE));

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/cards?${params.toString()}`, {
      headers: buildHeaders(),
    });
  } catch {
    throw new Error("Could not reach the Pokémon TCG API. Check your connection and try again.");
  }

  if (response.status === 429) {
    throw new Error(
      "The Pokémon TCG API rate limit was hit. Wait a moment, or add an API key (see .env.example)."
    );
  }
  if (!response.ok) {
    throw new Error(`The Pokémon TCG API returned an error (HTTP ${response.status}).`);
  }

  const body = (await response.json()) as PokemonTcgCardListResponse;
  return (body.data ?? []).map(toCardSummary);
}

function readApiKey(): string | null {
  const key = import.meta.env.VITE_POKEMON_TCG_API_KEY;
  if (typeof key === "string" && key.trim() !== "") {
    return key.trim();
  }
  return null;
}

function buildHeaders(): HeadersInit {
  const apiKey = readApiKey();
  return apiKey !== null ? { "X-Api-Key": apiKey } : {};
}

/** Builds the API's Lucene-like query, e.g. `name:"pikachu" AND set.id:sv1`. */
function buildQueryString(criteria: CardSearchCriteria): string {
  const clauses: string[] = [];
  if (criteria.name.trim() !== "") {
    clauses.push(`name:"${criteria.name.trim()}"`);
  }
  if (criteria.rarity.trim() !== "") {
    clauses.push(`rarity:"${criteria.rarity.trim()}"`);
  }
  if (criteria.setId.trim() !== "") {
    clauses.push(`set.id:${criteria.setId.trim()}`);
  }
  return clauses.join(" AND ");
}

function toCardSummary(card: PokemonTcgCard): CardSummary {
  return {
    id: card.id,
    name: card.name,
    setName: card.set?.name ?? "Unknown set",
    number: card.number,
    rarity: card.rarity ?? null,
    smallImageUrl: card.images?.small ?? "",
    largeImageUrl: card.images?.large ?? null,
    marketPrice: extractMarketPrice(card),
  };
}

/** First market price across printing variants (holofoil, normal, ...). */
function extractMarketPrice(card: PokemonTcgCard): number | null {
  const prices = card.tcgplayer?.prices;
  if (prices === undefined) {
    return null;
  }
  for (const variant of Object.values(prices)) {
    if (variant !== undefined && typeof variant.market === "number") {
      return variant.market;
    }
  }
  return null;
}

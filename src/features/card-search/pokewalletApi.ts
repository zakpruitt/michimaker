import {blobToDataUrl} from "../../blobToDataUrl";
import type {PokewalletCard, PokewalletSearchResponse, PokewalletSetsResponse,} from "./pokewalletApiTypes";

/** A search hit, slimmed to what the panel filters and renders. */
export interface PokewalletSearchCard {
    /** PokeWallet card id; also the /images/:id key. */
    id: string;
    name: string;
    setName: string;
    number: string;
    rarity: string | null;
    cardType: string | null;
    /** Language code from the set ("eng", "jap", ...), when known. */
    language: string | null;
    /** TCGplayer market price in USD, if available. */
    marketPrice: number | null;
}

/** API maximum; fetched in one go so client-side filters have substance. */
const SEARCH_LIMIT = 100;

const LANGUAGE_LABELS: Record<string, string> = {
    eng: "English",
    jap: "Japanese",
    chn: "Chinese",
    ger: "German",
    fre: "French",
    ita: "Italian",
    spa: "Spanish",
    kor: "Korean",
};

/** Human-readable label for a PokeWallet language code. */
export function languageLabel(code: string): string {
    return LANGUAGE_LABELS[code] ?? code.toUpperCase();
}

export async function searchCards(query: string): Promise<PokewalletSearchCard[]> {
    const params = new URLSearchParams({q: query, limit: String(SEARCH_LIMIT)});
    const [response, languageBySetId] = await Promise.all([
        request(`/search?${params.toString()}`),
        loadSetLanguages(),
    ]);
    const body = (await response.json()) as PokewalletSearchResponse;
    return (body.results ?? []).map((card) => toSearchCard(card, languageBySetId));
}

/** Downloads a card image with the API key and returns it as a data: URL. */
export async function fetchCardImageDataUrl(cardId: string): Promise<string> {
    const response = await request(`/images/${encodeURIComponent(cardId)}?size=low`);
    const blob = await response.blob();
    return blobToDataUrl(blob);
}

function baseUrl(): string {
    const url = import.meta.env.VITE_POKEWALLET_BASE_URL;
    if (typeof url === "string" && url.trim() !== "") {
        return url.trim().replace(/\/+$/, "");
    }
    return "https://api.pokewallet.io";
}

function readApiKey(): string | null {
    const key = import.meta.env.VITE_POKEWALLET_API_KEY;
    if (typeof key === "string" && key.trim() !== "") {
        return key.trim();
    }
    return null;
}

async function request(path: string): Promise<Response> {
    const apiKey = readApiKey();
    if (apiKey === null) {
        throw new Error(
            "Card search needs a PokeWallet API key. Copy .env.example to .env.local, fill it in, and restart the dev server."
        );
    }

    let response: Response;
    try {
        response = await fetch(`${baseUrl()}${path}`, {
            headers: {"X-API-Key": apiKey},
        });
    } catch {
        throw new Error("Could not reach the PokeWallet API. Check your connection and try again.");
    }

    if (response.status === 401) {
        throw new Error("The PokeWallet API rejected the key in .env.local.");
    }
    if (response.status === 429) {
        throw new Error(
            "The PokeWallet rate limit was hit (free keys: 100 requests/hour). Wait a bit and try again."
        );
    }
    if (!response.ok) {
        throw new Error(`The PokeWallet API returned an error (HTTP ${response.status}).`);
    }
    return response;
}

/** One /sets fetch per session; failures degrade to "language unknown". */
let setLanguagesPromise: Promise<Map<string, string>> | null = null;

function loadSetLanguages(): Promise<Map<string, string>> {
    if (setLanguagesPromise === null) {
        setLanguagesPromise = fetchSetLanguages().catch(() => {
            // Allow a retry on the next search instead of caching the failure.
            setLanguagesPromise = null;
            return new Map<string, string>();
        });
    }
    return setLanguagesPromise;
}

async function fetchSetLanguages(): Promise<Map<string, string>> {
    const response = await request("/sets");
    const body = (await response.json()) as PokewalletSetsResponse;
    const languageBySetId = new Map<string, string>();
    for (const set of body.data ?? []) {
        if (typeof set.set_id === "string" && typeof set.language === "string") {
            languageBySetId.set(set.set_id, set.language);
        }
    }
    return languageBySetId;
}

function toSearchCard(
    card: PokewalletCard,
    languageBySetId: Map<string, string>
): PokewalletSearchCard {
    const info = card.card_info ?? {};
    const setId = info.set_id ?? null;
    return {
        id: card.id,
        name: info.clean_name?.trim() || info.name || "Unknown card",
        setName: info.set_name ?? "Unknown set",
        number: info.card_number ?? "",
        rarity: info.rarity ?? null,
        cardType: info.card_type ?? null,
        language: setId !== null ? languageBySetId.get(setId) ?? null : null,
        marketPrice: extractMarketPrice(card),
    };
}

/** First TCGplayer price only; CardMarket prices are EUR and would lie next to $ labels. */
function extractMarketPrice(card: PokewalletCard): number | null {
    for (const price of card.tcgplayer?.prices ?? []) {
        if (typeof price.market_price === "number") {
            return price.market_price;
        }
    }
    return null;
}

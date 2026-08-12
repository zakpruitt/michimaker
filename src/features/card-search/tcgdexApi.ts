const API_BASE = "https://api.tcgdex.net/v2";
const ASSET_QUALITY = {thumbnail: "low", print: "high"} as const;

export const CARD_LANGUAGES = ["en", "ja"] as const;
export type CardLanguage = (typeof CARD_LANGUAGES)[number];

const RESULT_LIMIT = 36;

const DETAIL_CONCURRENCY = 8;

export interface SearchCard {
    id: string;
    language: CardLanguage;
    name: string;
    setName: string;
    setId: string | null;
    releaseDate: string | null;
    number: string;
    rarity: string | null;
    category: string | null;
    marketPrice: number | null;
    imageBase: string;
}

const LANGUAGE_LABELS: Record<CardLanguage, string> = {en: "English", ja: "Japanese"};

export function languageLabel(language: CardLanguage): string {
    return LANGUAGE_LABELS[language];
}

export function cardImageUrl(card: SearchCard, use: keyof typeof ASSET_QUALITY): string {
    return `${card.imageBase}/${ASSET_QUALITY[use]}.webp`;
}

export async function searchCards(query: string): Promise<SearchCard[]> {
    const term = encodeURIComponent(query.trim());

    const byName = await listBothLanguages(`name=like:${term}`);
    if (byName.some((list) => list.length > 0)) {
        return collectCards(byName, true);
    }
    return collectCards(await listBothLanguages(`id=like:${term}`), false);
}

async function collectCards(
    [english, japanese]: [BriefCard[], BriefCard[]],
    bridgeOnDexId: boolean
): Promise<SearchCard[]> {
    const englishCards = await loadDetails("en", english);

    if (bridgeOnDexId && japanese.length === 0) {
        const dexId = englishCards.map((card) => card.dexId?.[0]).find((id) => id !== undefined);
        if (dexId !== undefined) {
            japanese = await listCards("ja", `dexId=eq:${dexId}`);
        }
    }
    const japaneseCards = await loadDetails("ja", japanese);

    return withReleaseDates([
        ...toSearchCards(englishCards, "en"),
        ...toSearchCards(japaneseCards, "ja"),
    ]);
}

function withReleaseDates(cards: SearchCard[]): Promise<SearchCard[]> {
    return mapWithLimit(cards, DETAIL_CONCURRENCY, async (card) =>
        card.setId === null
            ? card
            : {...card, releaseDate: await loadReleaseDate(card.language, card.setId)}
    );
}

const releaseDates = new Map<string, Promise<string | null>>();

function loadReleaseDate(language: CardLanguage, setId: string): Promise<string | null> {
    const path = `/${language}/sets/${encodeURIComponent(setId)}`;
    let pending = releaseDates.get(path);
    if (pending === undefined) {
        pending = getJson<{ releaseDate?: string | null }>(path)
            .then((set) => set.releaseDate ?? null)
            .catch(() => {
                releaseDates.delete(path);
                return null;
            });
        releaseDates.set(path, pending);
    }
    return pending;
}

function listBothLanguages(filter: string): Promise<[BriefCard[], BriefCard[]]> {
    return Promise.all([listCards("en", filter), listCards("ja", filter)]);
}

function listCards(language: CardLanguage, filter: string): Promise<BriefCard[]> {
    return getJson<BriefCard[]>(
        `/${language}/cards?${filter}&pagination:page=1&pagination:itemsPerPage=${RESULT_LIMIT}`
    );
}

async function loadDetails(language: CardLanguage, brief: BriefCard[]): Promise<FullCard[]> {
    const loaded = await mapWithLimit(brief, DETAIL_CONCURRENCY, (card) =>
        getJson<FullCard>(`/${language}/cards/${encodeURIComponent(card.id)}`).catch(() => null)
    );
    return loaded.filter((card): card is FullCard => card !== null);
}

async function mapWithLimit<T, R>(
    items: T[],
    limit: number,
    run: (item: T) => Promise<R>
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let nextIndex = 0;

    async function worker(): Promise<void> {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await run(items[index]);
        }
    }

    await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
    return results;
}

async function getJson<T>(path: string): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`${API_BASE}${path}`);
    } catch {
        throw new Error("Could not reach the card database. Check your connection and try again.");
    }
    if (!response.ok) {
        throw new Error(`The card database returned an error (HTTP ${response.status}).`);
    }
    return (await response.json()) as T;
}

function toSearchCards(cards: FullCard[], language: CardLanguage): SearchCard[] {
    return cards.flatMap((card) =>
        typeof card.image === "string" ? [toSearchCard(card, card.image, language)] : []
    );
}

function toSearchCard(card: FullCard, imageBase: string, language: CardLanguage): SearchCard {
    const printed = card.set?.cardCount?.official ?? 0;
    const localId = card.localId ?? "";
    return {
        id: `${language}:${card.id}`,
        language,
        name: card.name?.trim() || "Unknown card",
        setName: card.set?.name ?? "Unknown set",
        setId: card.set?.id ?? null,
        releaseDate: null,
        number: localId !== "" && printed > 0 ? `${localId}/${printed}` : localId,
        rarity: card.rarity ?? null,
        category: card.category ?? null,
        marketPrice: findMarketPrice(card),
        imageBase,
    };
}

function findMarketPrice(card: FullCard): number | null {
    for (const variant of card.variants_detailed ?? []) {
        for (const finish of Object.values(variant.pricing?.tcgplayer ?? {})) {
            if (typeof finish === "object" && finish !== null && "marketPrice" in finish) {
                const price = (finish as {marketPrice: unknown}).marketPrice;
                if (typeof price === "number") {
                    return price;
                }
            }
        }
    }
    return null;
}

interface BriefCard {
    id: string;
}

interface FullCard extends BriefCard {
    name?: string | null;
    localId?: string | null;
    image?: string | null;
    rarity?: string | null;
    category?: string | null;
    dexId?: number[] | null;
    set?: {
        id?: string | null;
        name?: string | null;
        cardCount?: { official?: number | null } | null;
    } | null;
    variants_detailed?: {
        pricing?: { tcgplayer?: Record<string, unknown> | null } | null;
    }[] | null;
}

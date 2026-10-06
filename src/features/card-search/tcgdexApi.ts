const API_BASE = "https://api.tcgdex.net/v2";
const ASSET_QUALITY = {thumbnail: "low", print: "high"} as const;

const CARD_LANGUAGES = ["en", "ja"] as const;
export type CardLanguage = (typeof CARD_LANGUAGES)[number];

const DETAIL_CONCURRENCY = 8;

const DIGITAL_ONLY_SERIES_PATH = "/tcgp/";

const RELEASE_DATE_STORAGE_KEY = "michimaker.tcgdex.release-dates.v1";

const PREFERRED_FINISHES = [
    "normal",
    "holofoil",
    "reverse-holofoil",
    "1st-edition",
    "1st-edition-holofoil",
    "unlimited",
    "unlimited-holofoil",
];

export interface CardMatch {
    id: string;
    language: CardLanguage;
    name: string;
    imageBase: string;
}

export interface SearchCard {
    id: string;
    language: CardLanguage;
    name: string;
    setName: string;
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

export function cardImageUrl(card: {imageBase: string}, use: keyof typeof ASSET_QUALITY): string {
    return `${card.imageBase}/${ASSET_QUALITY[use]}.webp`;
}

export function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
}

export async function findCardMatches(query: string, signal?: AbortSignal): Promise<CardMatch[]> {
    const term = query.trim();
    const filterValue = encodeURIComponent(term);

    const byName = await listBothLanguages(`name=like:${filterValue}`, signal);
    if (byName.en.length > 0 || byName.ja.length > 0) {
        const ranked = rankByName(byName, term);
        return interleaveByRank(await withBridgedLanguage(ranked, signal));
    }

    const byId = await listBothLanguages(`id=like:${filterValue}`, signal);
    return interleaveByRank({
        en: byId.en.map((match) => ({match, rank: 0})),
        ja: byId.ja.map((match) => ({match, rank: 0})),
    });
}

export async function loadSearchCards(matches: CardMatch[], signal?: AbortSignal): Promise<SearchCard[]> {
    const loaded = await mapWithLimit(matches, DETAIL_CONCURRENCY, async (match) => {
        const card = await loadCardDetail(match.language, match.id, signal);
        if (card === null) {
            return null;
        }
        const setId = card.set?.id ?? null;
        const releaseDate = setId === null ? null : await loadReleaseDate(match.language, setId);
        return toSearchCard(card, match, releaseDate);
    });
    persistReleaseDates();
    return loaded.filter((card): card is SearchCard => card !== null);
}

export async function findCardImageUrls(cardIds: string[]): Promise<Map<string, string>> {
    const resolved = await mapWithLimit(cardIds, DETAIL_CONCURRENCY, async (cardId) => {
        const [language, id] = splitCardId(cardId);
        if (language === null) {
            return null;
        }
        const card = await loadCardDetail(language, id);
        return typeof card?.image === "string" ? ([cardId, cardImageUrl({imageBase: card.image}, "print")] as const) : null;
    });
    return new Map(resolved.filter((entry) => entry !== null));
}

function splitCardId(cardId: string): [CardLanguage | null, string] {
    const separator = cardId.indexOf(":");
    const language = cardId.slice(0, separator);
    const isKnown = (CARD_LANGUAGES as readonly string[]).includes(language);
    return [isKnown ? (language as CardLanguage) : null, cardId.slice(separator + 1)];
}

type ByLanguage<T> = Record<CardLanguage, T[]>;

interface RankedMatch {
    match: CardMatch;
    rank: number;
}

async function listBothLanguages(filter: string, signal?: AbortSignal): Promise<ByLanguage<CardMatch>> {
    const [en, ja] = await Promise.all(CARD_LANGUAGES.map((language) => listCards(language, filter, signal)));
    return {en, ja};
}

async function listCards(language: CardLanguage, filter: string, signal?: AbortSignal): Promise<CardMatch[]> {
    const brief = await getJson<BriefCard[]>(`/${language}/cards?${filter}`, signal);
    return brief.flatMap((card) =>
        typeof card.image === "string" && card.image !== "" && !card.image.includes(DIGITAL_ONLY_SERIES_PATH)
            ? [{id: card.id, language, name: card.name?.trim() || "Unknown card", imageBase: card.image}]
            : []
    );
}

function rankByName(matches: ByLanguage<CardMatch>, term: string): ByLanguage<RankedMatch> {
    const needle = term.toLocaleLowerCase();
    const rank = (match: CardMatch) => ({match, rank: nameRank(match.name.toLocaleLowerCase(), needle)});
    return {en: matches.en.map(rank), ja: matches.ja.map(rank)};
}

function nameRank(name: string, needle: string): number {
    if (name === needle) return 0;
    if (name.startsWith(needle)) return 1;
    if (name.split(/[\s\-'’&]+/).some((word) => word.startsWith(needle))) return 2;
    return 3;
}

async function withBridgedLanguage(
    ranked: ByLanguage<RankedMatch>,
    signal?: AbortSignal
): Promise<ByLanguage<RankedMatch>> {
    const missing = CARD_LANGUAGES.find((language) => ranked[language].length === 0);
    const present = CARD_LANGUAGES.find((language) => ranked[language].length > 0);
    if (missing === undefined || present === undefined) {
        return ranked;
    }

    const best = ranked[present].reduce((a, b) => (b.rank < a.rank ? b : a));
    const detail = await loadCardDetail(present, best.match.id, signal);
    const dexId = detail?.dexId?.[0];
    if (dexId === undefined) {
        return ranked;
    }
    const bridged = await listCards(missing, `dexId=eq:${dexId}`, signal);
    return {...ranked, [missing]: bridged.map((match) => ({match, rank: best.rank}))};
}

function interleaveByRank(ranked: ByLanguage<RankedMatch>): CardMatch[] {
    const ordered = CARD_LANGUAGES.flatMap((language, languageIndex) => {
        const seenPerRank = new Map<number, number>();
        return ranked[language].map(({match, rank}) => {
            const position = seenPerRank.get(rank) ?? 0;
            seenPerRank.set(rank, position + 1);
            return {match, rank, position, languageIndex};
        });
    });
    ordered.sort((a, b) => a.rank - b.rank || a.position - b.position || a.languageIndex - b.languageIndex);
    return ordered.map(({match}) => match);
}

const cardDetails = new Map<string, FullCard>();

async function loadCardDetail(
    language: CardLanguage,
    id: string,
    signal?: AbortSignal
): Promise<FullCard | null> {
    const key = `${language}/${id}`;
    const cached = cardDetails.get(key);
    if (cached !== undefined) {
        return cached;
    }
    try {
        const card = await getJson<FullCard>(`/${language}/cards/${encodeURIComponent(id)}`, signal);
        cardDetails.set(key, card);
        return card;
    } catch (error) {
        if (isAbortError(error)) {
            throw error;
        }
        return null;
    }
}

const releaseDates = new Map<string, Promise<string | null>>();
const settledReleaseDates: Record<string, string | null> = readStoredReleaseDates();
let releaseDatesDirty = false;

function loadReleaseDate(language: CardLanguage, setId: string): Promise<string | null> {
    const key = `${language}/${setId}`;
    if (key in settledReleaseDates) {
        return Promise.resolve(settledReleaseDates[key]);
    }
    let pending = releaseDates.get(key);
    if (pending === undefined) {
        pending = getJson<{releaseDate?: string | null}>(`/${language}/sets/${encodeURIComponent(setId)}`)
            .then((set) => {
                const date = set.releaseDate ?? null;
                settledReleaseDates[key] = date;
                releaseDatesDirty = true;
                return date;
            })
            .catch(() => {
                releaseDates.delete(key);
                return null;
            });
        releaseDates.set(key, pending);
    }
    return pending;
}

function readStoredReleaseDates(): Record<string, string | null> {
    try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(RELEASE_DATE_STORAGE_KEY) ?? "{}");
        return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, string | null>) : {};
    } catch {
        return {};
    }
}

function persistReleaseDates(): void {
    if (!releaseDatesDirty) {
        return;
    }
    releaseDatesDirty = false;
    try {
        window.localStorage.setItem(RELEASE_DATE_STORAGE_KEY, JSON.stringify(settledReleaseDates));
    } catch {
        releaseDatesDirty = true;
    }
}

async function mapWithLimit<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
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

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`${API_BASE}${path}`, {signal});
    } catch (error) {
        if (isAbortError(error)) {
            throw error;
        }
        throw new Error("Could not reach the card database. Check your connection and try again.");
    }
    if (!response.ok) {
        throw new Error(`The card database returned an error (HTTP ${response.status}).`);
    }
    return (await response.json()) as T;
}

function toSearchCard(card: FullCard, match: CardMatch, releaseDate: string | null): SearchCard {
    const printed = card.set?.cardCount?.official ?? 0;
    const localId = card.localId ?? "";
    return {
        id: `${match.language}:${card.id}`,
        language: match.language,
        name: card.name?.trim() || match.name,
        setName: card.set?.name ?? "Unknown set",
        releaseDate,
        number: localId !== "" && printed > 0 ? `${localId}/${printed}` : localId,
        rarity: card.rarity && card.rarity !== "None" ? card.rarity : null,
        category: card.category ?? null,
        marketPrice: findMarketPrice(card),
        imageBase: card.image ?? match.imageBase,
    };
}

function findMarketPrice(card: FullCard): number | null {
    const sources = [card.pricing?.tcgplayer, ...(card.variants_detailed ?? []).map((v) => v.pricing?.tcgplayer)];
    for (const tcgplayer of sources) {
        if (tcgplayer === null || tcgplayer === undefined) {
            continue;
        }
        const finishes = [
            ...PREFERRED_FINISHES.filter((finish) => finish in tcgplayer),
            ...Object.keys(tcgplayer).filter((finish) => !PREFERRED_FINISHES.includes(finish)),
        ];
        for (const finish of finishes) {
            const price = marketPriceOf(tcgplayer[finish]);
            if (price !== null) {
                return price;
            }
        }
    }
    return null;
}

function marketPriceOf(finish: unknown): number | null {
    if (typeof finish !== "object" || finish === null || !("marketPrice" in finish)) {
        return null;
    }
    const price = finish.marketPrice;
    return typeof price === "number" && price > 0 ? price : null;
}

interface BriefCard {
    id: string;
    name?: string | null;
    image?: string | null;
}

type TcgplayerPricing = Record<string, unknown> | null;

interface FullCard extends BriefCard {
    localId?: string | null;
    rarity?: string | null;
    category?: string | null;
    dexId?: number[] | null;
    set?: {
        id?: string | null;
        name?: string | null;
        cardCount?: {official?: number | null} | null;
    } | null;
    pricing?: {tcgplayer?: TcgplayerPricing} | null;
    variants_detailed?: {
        pricing?: {tcgplayer?: TcgplayerPricing} | null;
    }[] | null;
}

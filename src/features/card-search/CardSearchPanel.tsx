import {type ChangeEvent, type DragEvent, type FormEvent, useMemo, useState} from "react";
import {type CardSummary, formatUsd} from "../../types/card";
import {Pager} from "../../components/Pager";
import {useBinderActions} from "../binder/state/BinderContext";
import {setCardDragPayload} from "../binder/pocket/dragPayload";
import {
    type CardLanguage,
    cardImageUrl,
    languageLabel,
    type SearchCard,
    searchCards,
} from "./tcgdexApi";
import styles from "./CardSearchPanel.module.css";

type SearchResults = SearchCard[] | null;

const RESULTS_PER_PAGE = 6;

const ANY = "";

type SortOrder = "oldest" | "newest" | "price-desc" | "price-asc";

const DEFAULT_SORT: SortOrder = "oldest";

export function CardSearchPanel() {
    const {placeCardFromSearch} = useBinderActions();

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResults>(null);
    const [language, setLanguage] = useState(ANY);
    const [rarity, setRarity] = useState(ANY);
    const [category, setCategory] = useState(ANY);
    const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT);
    const [resultsPage, setResultsPage] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    async function handleSearchSubmit(event: FormEvent) {
        event.preventDefault();
        const trimmedQuery = query.trim();
        if (trimmedQuery === "") {
            setErrorMessage("Type a card name, set code, or card number first.");
            return;
        }
        setIsLoading(true);
        setErrorMessage(null);
        setResultsPage(0);
        setLanguage(ANY);
        setRarity(ANY);
        setCategory(ANY);
        setSortOrder(DEFAULT_SORT);
        try {
            setResults(await searchCards(trimmedQuery));
        } catch (error) {
            setResults(null);
            setErrorMessage(error instanceof Error ? error.message : "The search failed.");
        } finally {
            setIsLoading(false);
        }
    }

    const facets = useMemo(() => buildFacets(results), [results]);

    const filteredResults = useMemo(() => {
        if (results === null) {
            return [];
        }
        const cards = results.filter(
            (card) =>
                (language === ANY || card.language === language) &&
                (rarity === ANY || card.rarity === rarity) &&
                (category === ANY || card.category === category)
        );
        cards.sort((a, b) => compareCards(a, b, sortOrder));
        return cards;
    }, [results, language, rarity, category, sortOrder]);

    const pageCount = Math.ceil(filteredResults.length / RESULTS_PER_PAGE);
    const currentPage = Math.min(resultsPage, Math.max(0, pageCount - 1));
    const visibleResults = useMemo(
        () =>
            filteredResults.slice(
                currentPage * RESULTS_PER_PAGE,
                (currentPage + 1) * RESULTS_PER_PAGE
            ),
        [filteredResults, currentPage]
    );

    function updateFilter(setter: (value: string) => void) {
        return (event: ChangeEvent<HTMLSelectElement>) => {
            setter(event.target.value);
            setResultsPage(0);
        };
    }

    return (
        <div className={styles.panel}>
            <form onSubmit={handleSearchSubmit} className={styles.form}>
                <div className={styles.field}>
                    <label htmlFor="card-search-input">Search cards</label>
                    <div className={styles.searchRow}>
                        <input
                            id="card-search-input"
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Card name, set code, or number"
                        />
                        <button type="submit" className={styles.searchButton} disabled={isLoading}>
                            {isLoading ? "…" : "Search"}
                        </button>
                    </div>
                </div>
            </form>

            {results !== null && results.length > 0 && (
                <div className={styles.filters}>
                    <select value={language} onChange={updateFilter(setLanguage)} aria-label="Language">
                        <option value={ANY}>Any language</option>
                        {facets.languages.map((code) => (
                            <option key={code} value={code}>
                                {languageLabel(code)}
                            </option>
                        ))}
                    </select>
                    <select value={rarity} onChange={updateFilter(setRarity)} aria-label="Rarity">
                        <option value={ANY}>Any rarity</option>
                        {facets.rarities.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                    <select value={category} onChange={updateFilter(setCategory)} aria-label="Card type">
                        <option value={ANY}>Any type</option>
                        {facets.categories.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                    <select
                        value={sortOrder}
                        onChange={updateFilter((value) => setSortOrder(value as SortOrder))}
                        aria-label="Sort order"
                    >
                        <option value="oldest">Release: oldest first</option>
                        <option value="newest">Release: newest first</option>
                        <option value="price-desc">Price: high to low</option>
                        <option value="price-asc">Price: low to high</option>
                    </select>
                    <p className={styles.resultCount}>
                        {filteredResults.length === results.length
                            ? `${results.length} result${results.length === 1 ? "" : "s"}`
                            : `${filteredResults.length} of ${results.length} results`}
                    </p>
                </div>
            )}

            {errorMessage !== null && <p className={styles.error}>{errorMessage}</p>}

            {isLoading && (
                <div className={styles.loading}>
                    <div className={styles.spinner}/>
                </div>
            )}

            {!isLoading && results !== null && results.length === 0 && (
                <p className={styles.emptyHint}>No cards matched that search.</p>
            )}

            {!isLoading && results !== null && results.length > 0 && filteredResults.length === 0 && (
                <p className={styles.emptyHint}>No results match these filters.</p>
            )}

            {!isLoading && results === null && errorMessage === null && (
                <p className={styles.emptyHint}>
                    Search by card name, set code, or card number, then click a result
                    to place it in the selected pocket, or drag it straight onto a
                    pocket.
                </p>
            )}

            {!isLoading && visibleResults.length > 0 && (
                <div className={styles.results}>
                    {visibleResults.map((card) => (
                            <div
                                key={card.id}
                                className={styles.resultItem}
                                draggable
                                onDragStart={(event: DragEvent) =>
                                    setCardDragPayload(event, toCardSummary(card))
                                }
                                onClick={() => placeCardFromSearch(toCardSummary(card))}
                                title={`${card.name}: click to place in the selected pocket`}
                            >
                                <img src={cardImageUrl(card, "thumbnail")} alt={card.name} loading="lazy"/>
                                <div className={styles.resultDetails}>
                                    <strong>{card.name}</strong>
                                    <p>
                                        {card.number !== "" ? `#${card.number}` : ""}
                                        {card.rarity !== null ? ` · ${card.rarity}` : ""}
                                    </p>
                                    <p className={styles.resultSet}>
                                        {card.setName} · {languageLabel(card.language)}
                                    </p>
                                    {card.marketPrice !== null && (
                                        <p className={styles.resultPrice}>{formatUsd(card.marketPrice)}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    <Pager page={currentPage} pageCount={pageCount} onPageChange={setResultsPage}/>
                </div>
            )}
        </div>
    );
}

function compareCards(a: SearchCard, b: SearchCard, order: SortOrder): number {
    if (order === "price-asc" || order === "price-desc") {
        if (a.marketPrice === null) return b.marketPrice === null ? 0 : 1;
        if (b.marketPrice === null) return -1;
        return (a.marketPrice - b.marketPrice) * (order === "price-asc" ? 1 : -1);
    }
    if (a.releaseDate === null) return b.releaseDate === null ? 0 : 1;
    if (b.releaseDate === null) return -1;
    if (a.releaseDate !== b.releaseDate) {
        const older = a.releaseDate < b.releaseDate ? -1 : 1;
        return order === "oldest" ? older : -older;
    }
    return printedNumber(a) - printedNumber(b);
}

function printedNumber(card: SearchCard): number {
    return Number.parseInt(card.number, 10) || 0;
}

function toCardSummary(card: SearchCard): CardSummary {
    return {
        id: card.id,
        name: card.name,
        setName: card.setName,
        number: card.number,
        rarity: card.rarity,
        smallImageUrl: cardImageUrl(card, "print"),
        marketPrice: card.marketPrice,
    };
}

interface Facets {
    languages: CardLanguage[];
    rarities: string[];
    categories: string[];
}

function buildFacets(results: SearchResults): Facets {
    const languages = new Set<CardLanguage>();
    const rarities = new Set<string>();
    const categories = new Set<string>();
    for (const card of results ?? []) {
        languages.add(card.language);
        if (card.rarity !== null) rarities.add(card.rarity);
        if (card.category !== null) categories.add(card.category);
    }
    return {
        languages: [...languages].sort(),
        rarities: [...rarities].sort(),
        categories: [...categories].sort(),
    };
}

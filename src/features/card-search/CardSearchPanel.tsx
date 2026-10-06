import {type ChangeEvent, type FormEvent, useMemo, useState} from "react";
import {type CardSummary, formatUsd} from "../../types/card";
import {Pager} from "../../components/Pager";
import {activateOnEnterOrSpace} from "../../keyboard";
import {useBinderActions} from "../binder/state/BinderContext";
import {setCardDragPayload} from "../binder/pocket/dragPayload";
import {type CardLanguage, cardImageUrl, languageLabel, type SearchCard} from "./tcgdexApi";
import {type CardSearchState, useCardSearch} from "./useCardSearch";
import styles from "./CardSearchPanel.module.css";

const RESULTS_PER_PAGE = 6;

const ANY = "";

type SortOrder = "relevance" | "oldest" | "newest" | "price-desc" | "price-asc";

const DEFAULT_SORT: SortOrder = "relevance";

export function CardSearchPanel() {
    const {placeCardFromSearch} = useBinderActions();
    const {state, search, loadMore} = useCardSearch();

    const [query, setQuery] = useState("");
    const [validationMessage, setValidationMessage] = useState<string | null>(null);
    const [language, setLanguage] = useState(ANY);
    const [rarity, setRarity] = useState(ANY);
    const [category, setCategory] = useState(ANY);
    const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT);
    const [resultsPage, setResultsPage] = useState(0);

    const results = state.status === "ready" ? state.cards : null;

    function handleSearchSubmit(event: FormEvent) {
        event.preventDefault();
        const trimmedQuery = query.trim();
        if (trimmedQuery === "") {
            setValidationMessage("Type a card name, set code, or card number first.");
            return;
        }
        setValidationMessage(null);
        setResultsPage(0);
        setLanguage(ANY);
        setRarity(ANY);
        setCategory(ANY);
        setSortOrder(DEFAULT_SORT);
        void search(trimmedQuery);
    }

    const facets = useMemo(() => buildFacets(results ?? []), [results]);

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
        return sortOrder === "relevance" ? cards : cards.sort((a, b) => compareCards(a, b, sortOrder));
    }, [results, language, rarity, category, sortOrder]);

    const pageCount = Math.ceil(filteredResults.length / RESULTS_PER_PAGE);
    const currentPage = Math.min(resultsPage, Math.max(0, pageCount - 1));
    const visibleResults = filteredResults.slice(
        currentPage * RESULTS_PER_PAGE,
        (currentPage + 1) * RESULTS_PER_PAGE
    );

    function updateFilter(setter: (value: string) => void) {
        return (event: ChangeEvent<HTMLSelectElement>) => {
            setter(event.target.value);
            setResultsPage(0);
        };
    }

    const isSearching = state.status === "searching";
    const errorMessage = validationMessage ?? (state.status === "error" ? state.message : null);
    const remainingMatches = state.status === "ready" ? state.matches.length - state.loadedCount : 0;

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
                        <button type="submit" className={styles.searchButton} disabled={isSearching}>
                            {isSearching ? "…" : "Search"}
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
                        <option value="relevance">Best match</option>
                        <option value="oldest">Release: oldest first</option>
                        <option value="newest">Release: newest first</option>
                        <option value="price-desc">Price: high to low</option>
                        <option value="price-asc">Price: low to high</option>
                    </select>
                    <p className={styles.resultCount}>
                        {describeResultCount(filteredResults.length, results.length, state)}
                    </p>
                </div>
            )}

            {errorMessage !== null && <p className={styles.error}>{errorMessage}</p>}

            {isSearching && (
                <div className={styles.loading}>
                    <div className={styles.spinner}/>
                </div>
            )}

            {results !== null && results.length === 0 && (
                <p className={styles.emptyHint}>No cards matched that search.</p>
            )}

            {results !== null && results.length > 0 && filteredResults.length === 0 && (
                <p className={styles.emptyHint}>No loaded results match these filters.</p>
            )}

            {state.status === "idle" && errorMessage === null && (
                <p className={styles.emptyHint}>
                    Search by card name, set code, or card number, then click a result
                    to place it in the selected pocket, or drag it straight onto a
                    pocket.
                </p>
            )}

            {visibleResults.length > 0 && (
                <div className={styles.results}>
                    {visibleResults.map((card) => (
                        <div
                            key={card.id}
                            className={styles.resultItem}
                            role="button"
                            tabIndex={0}
                            draggable
                            onDragStart={(event) => setCardDragPayload(event, toCardSummary(card))}
                            onClick={() => placeCardFromSearch(toCardSummary(card))}
                            onKeyDown={activateOnEnterOrSpace(() => placeCardFromSearch(toCardSummary(card)))}
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
                                    {card.setName}
                                    {card.releaseDate !== null ? ` (${card.releaseDate.slice(0, 4)})` : ""}
                                    {" · "}
                                    {languageLabel(card.language)}
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

            {state.status === "ready" && state.loadMoreError !== null && (
                <p className={styles.error}>{state.loadMoreError}</p>
            )}

            {remainingMatches > 0 && (
                <button
                    type="button"
                    className={styles.loadMoreButton}
                    onClick={() => void loadMore()}
                    disabled={state.status === "ready" && state.isLoadingMore}
                >
                    {state.status === "ready" && state.isLoadingMore
                        ? "Loading…"
                        : `Load more (${remainingMatches} more match${remainingMatches === 1 ? "" : "es"})`}
                </button>
            )}
        </div>
    );
}

function describeResultCount(
    filteredCount: number,
    loadedCount: number,
    state: CardSearchState
): string {
    const shown =
        filteredCount === loadedCount
            ? `${loadedCount} result${loadedCount === 1 ? "" : "s"}`
            : `${filteredCount} of ${loadedCount} results`;
    if (state.status !== "ready" || state.loadedCount >= state.matches.length) {
        return shown;
    }
    return `${shown} · ${state.matches.length} matches in total`;
}

function compareCards(a: SearchCard, b: SearchCard, order: Exclude<SortOrder, "relevance">): number {
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

function buildFacets(results: SearchCard[]): Facets {
    const languages = new Set<CardLanguage>();
    const rarities = new Set<string>();
    const categories = new Set<string>();
    for (const card of results) {
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

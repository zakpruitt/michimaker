import {type ChangeEvent, type DragEvent, type FormEvent, useEffect, useMemo, useRef, useState,} from "react";
import {type CardSummary, formatUsd} from "../../types/card";
import {Pager} from "../../components/Pager";
import {useBinderActions} from "../binder/state/BinderContext";
import {setCardDragPayload} from "../binder/pocket/dragPayload";
import {useNotices} from "../../components/notices/NoticeContext";
import {fetchCardImageDataUrl, languageLabel, type PokewalletSearchCard, searchCards,} from "./pokewalletApi";
import styles from "./CardSearchPanel.module.css";

/** null = no search yet; distinguishes the initial hint from "0 results". */
type SearchResults = PokewalletSearchCard[] | null;

/** Results per pager page: fills the panel without endless scrolling. */
const RESULTS_PER_PAGE = 6;

const ANY = "";

type SortOrder = "relevance" | "price-desc" | "price-asc";

export function CardSearchPanel() {
    const {placeCardFromSearch} = useBinderActions();
    const {showNotice} = useNotices();

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResults>(null);
    const [language, setLanguage] = useState(ANY);
    const [rarity, setRarity] = useState(ANY);
    const [cardType, setCardType] = useState(ANY);
    const [sortOrder, setSortOrder] = useState<SortOrder>("relevance");
    const [resultsPage, setResultsPage] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Fetched card images by id. Kept across searches; ids are stable.
    const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
    const pendingImageIds = useRef(new Set<string>());

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
        setCardType(ANY);
        setSortOrder("relevance");
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
        let cards = results;
        if (language !== ANY) {
            cards = cards.filter((card) => card.language === language);
        }
        if (rarity !== ANY) {
            cards = cards.filter((card) => card.rarity === rarity);
        }
        if (cardType !== ANY) {
            cards = cards.filter((card) => card.cardType === cardType);
        }
        if (sortOrder !== "relevance") {
            const direction = sortOrder === "price-desc" ? -1 : 1;
            cards = [...cards].sort((a, b) => {
                // Priceless cards sink to the end either way.
                if (a.marketPrice === null) return b.marketPrice === null ? 0 : 1;
                if (b.marketPrice === null) return -1;
                return (a.marketPrice - b.marketPrice) * direction;
            });
        }
        return cards;
    }, [results, language, rarity, cardType, sortOrder]);

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

    // Fetch images for the visible page only; guards keep this idempotent.
    useEffect(() => {
        for (const card of visibleResults) {
            if (imageUrls.has(card.id) || pendingImageIds.current.has(card.id)) {
                continue;
            }
            pendingImageIds.current.add(card.id);
            fetchCardImageDataUrl(card)
                .then((dataUrl) => {
                    setImageUrls((previous) => new Map(previous).set(card.id, dataUrl));
                })
                .catch(() => {
                    // Leave the id in pending so a broken image is not refetched in a loop.
                });
        }
    }, [visibleResults, imageUrls]);

    async function handleResultClick(card: PokewalletSearchCard) {
        let imageUrl = imageUrls.get(card.id);
        if (imageUrl === undefined) {
            try {
                const dataUrl = await fetchCardImageDataUrl(card);
                setImageUrls((previous) => new Map(previous).set(card.id, dataUrl));
                imageUrl = dataUrl;
            } catch {
                showNotice("The card image is still loading. Try again in a moment.", "error");
                return;
            }
        }
        placeCardFromSearch(toCardSummary(card, imageUrl));
    }

    function handleResultDragStart(event: DragEvent, card: PokewalletSearchCard) {
        const imageUrl = imageUrls.get(card.id);
        if (imageUrl === undefined) {
            return;
        }
        setCardDragPayload(event, toCardSummary(card, imageUrl));
    }

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
                    <select value={cardType} onChange={updateFilter(setCardType)} aria-label="Card type">
                        <option value={ANY}>Any type</option>
                        {facets.cardTypes.map((option) => (
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
                    {visibleResults.map((card) => {
                        const imageUrl = imageUrls.get(card.id);
                        return (
                            <div
                                key={card.id}
                                className={styles.resultItem}
                                draggable={imageUrl !== undefined}
                                onDragStart={(event) => handleResultDragStart(event, card)}
                                onClick={() => handleResultClick(card)}
                                title={`${card.name}: click to place in the selected pocket`}
                            >
                                {imageUrl !== undefined ? (
                                    <img src={imageUrl} alt={card.name}/>
                                ) : (
                                    <div className={styles.imagePlaceholder} aria-hidden="true"/>
                                )}
                                <div className={styles.resultDetails}>
                                    <strong>{card.name}</strong>
                                    <p>
                                        {card.number !== "" ? `#${card.number}` : ""}
                                        {card.rarity !== null ? ` · ${card.rarity}` : ""}
                                    </p>
                                    <p className={styles.resultSet}>
                                        {card.setName}
                                        {card.language !== null ? ` · ${languageLabel(card.language)}` : ""}
                                    </p>
                                    {card.marketPrice !== null && (
                                        <p className={styles.resultPrice}>{formatUsd(card.marketPrice)}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    <Pager page={currentPage} pageCount={pageCount} onPageChange={setResultsPage}/>
                </div>
            )}
        </div>
    );
}

function toCardSummary(card: PokewalletSearchCard, imageDataUrl: string): CardSummary {
    return {
        id: card.id,
        name: card.name,
        setName: card.setName,
        number: card.number,
        rarity: card.rarity,
        smallImageUrl: imageDataUrl,
        marketPrice: card.marketPrice,
    };
}

interface Facets {
    languages: string[];
    rarities: string[];
    cardTypes: string[];
}

/** Distinct filter options present in the current results, sorted. */
function buildFacets(results: SearchResults): Facets {
    const languages = new Set<string>();
    const rarities = new Set<string>();
    const cardTypes = new Set<string>();
    for (const card of results ?? []) {
        if (card.language !== null) languages.add(card.language);
        if (card.rarity !== null) rarities.add(card.rarity);
        if (card.cardType !== null) cardTypes.add(card.cardType);
    }
    return {
        languages: [...languages].sort(),
        rarities: [...rarities].sort(),
        cardTypes: [...cardTypes].sort(),
    };
}

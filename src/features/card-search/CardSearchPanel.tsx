/**
 * Card search side panel: search the Pokémon TCG API by name / rarity / set,
 * then click a result to place it in the selected pocket, or drag a result
 * straight onto any pocket. Errors and empty results render inline.
 */
import { useState, type DragEvent, type FormEvent } from "react";
import type { CardSummary } from "../../types/card";
import { Pager } from "../../components/Pager";
import { useBinderActions } from "../binder/BinderContext";
import { setCardDragPayload } from "../binder/dragPayload";
import { searchCards } from "./pokemonTcgApi";
import {
  AVAILABLE_RARITIES,
  AVAILABLE_SETS,
  ORDER_BY_OPTIONS,
  type SetOption,
} from "./searchOptions";
import styles from "./CardSearchPanel.module.css";

/** null = no search yet; distinguishes the initial hint from "0 results". */
type SearchResults = CardSummary[] | null;

/** Results per pager page: fills the panel without endless scrolling. */
const RESULTS_PER_PAGE = 6;

export function CardSearchPanel() {
  const { placeCardFromSearch } = useBinderActions();

  const [cardName, setCardName] = useState("");
  const [rarity, setRarity] = useState("");
  const [setSearchText, setSetSearchText] = useState("");
  const [selectedSetId, setSelectedSetId] = useState("");
  const [showSetSuggestions, setShowSetSuggestions] = useState(false);
  const [orderBy, setOrderBy] = useState(ORDER_BY_OPTIONS[0].value);

  const [results, setResults] = useState<SearchResults>(null);
  const [resultsPage, setResultsPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filteredSets = filterSets(setSearchText);

  async function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setResultsPage(0);
    try {
      const cards = await searchCards({
        name: cardName,
        rarity,
        setId: selectedSetId,
        orderBy,
      });
      setResults(cards);
    } catch (error) {
      setResults(null);
      setErrorMessage(error instanceof Error ? error.message : "The search failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSetSearchChange(text: string) {
    setSetSearchText(text);
    setShowSetSuggestions(true);
    setSelectedSetId("");
  }

  function handleSetSuggestionClick(setOption: SetOption) {
    setSelectedSetId(setOption.id);
    setSetSearchText(setOption.name);
    setShowSetSuggestions(false);
  }

  function handleResultDragStart(event: DragEvent, card: CardSummary) {
    setCardDragPayload(event, card);
  }

  const pageCount =
    results === null ? 0 : Math.ceil(results.length / RESULTS_PER_PAGE);
  const currentPage = Math.min(resultsPage, Math.max(0, pageCount - 1));
  const visibleResults =
    results === null
      ? []
      : results.slice(
          currentPage * RESULTS_PER_PAGE,
          (currentPage + 1) * RESULTS_PER_PAGE
        );

  return (
    <div className={styles.panel}>
      <form onSubmit={handleSearchSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="card-name-input">Card name</label>
          <input
            id="card-name-input"
            type="text"
            value={cardName}
            onChange={(event) => setCardName(event.target.value)}
            placeholder="e.g. Pikachu"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="rarity-select">Rarity</label>
          <select
            id="rarity-select"
            value={rarity}
            onChange={(event) => setRarity(event.target.value)}
          >
            {AVAILABLE_RARITIES.map((rarityOption) => (
              <option key={rarityOption} value={rarityOption}>
                {rarityOption === "" ? "Any rarity" : rarityOption}
              </option>
            ))}
          </select>
        </div>

        <div className={`${styles.field} ${styles.setField}`}>
          <label htmlFor="set-input">Set</label>
          <input
            id="set-input"
            type="text"
            value={setSearchText}
            onChange={(event) => handleSetSearchChange(event.target.value)}
            onBlur={() => setShowSetSuggestions(false)}
            placeholder="Type a set name or id"
            autoComplete="off"
          />
          {showSetSuggestions && filteredSets.length > 0 && (
            <div className={styles.suggestions}>
              {filteredSets.map((setOption) => (
                <button
                  type="button"
                  key={setOption.id}
                  className={styles.suggestion}
                  // Runs before the input's blur hides the list.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSetSuggestionClick(setOption);
                  }}
                >
                  <strong>{setOption.id}</strong> · {setOption.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="order-select">Order by</label>
          <select
            id="order-select"
            value={orderBy}
            onChange={(event) => setOrderBy(event.target.value)}
          >
            {ORDER_BY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className={styles.searchButton} disabled={isLoading}>
          {isLoading ? "Searching…" : "Search"}
        </button>
      </form>

      {errorMessage !== null && <p className={styles.error}>{errorMessage}</p>}

      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
        </div>
      )}

      {!isLoading && results !== null && results.length === 0 && (
        <p className={styles.hint}>No cards matched that search.</p>
      )}

      {!isLoading && results === null && errorMessage === null && (
        <p className={styles.emptyHint}>
          Search for cards, then click a result to place it in the selected
          pocket, or drag it straight onto a pocket.
        </p>
      )}

      {!isLoading && results !== null && results.length > 0 && (
        <div className={styles.results}>
          {visibleResults.map((card) => (
            <div
              key={card.id}
              className={styles.resultItem}
              draggable
              onDragStart={(event) => handleResultDragStart(event, card)}
              onClick={() => placeCardFromSearch(card)}
              title={`${card.name}: click to place in the selected pocket`}
            >
              <img src={card.smallImageUrl} alt={card.name} loading="lazy" />
              <div className={styles.resultDetails}>
                <strong>{card.name}</strong>
                <p>
                  #{card.number}
                  {card.rarity !== null ? ` · ${card.rarity}` : ""}
                </p>
                <p className={styles.resultSet}>{card.setName}</p>
                {card.marketPrice !== null && (
                  <p className={styles.resultPrice}>${card.marketPrice.toFixed(2)}</p>
                )}
              </div>
            </div>
          ))}
          <Pager
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setResultsPage}
          />
        </div>
      )}
    </div>
  );
}

function filterSets(searchText: string): SetOption[] {
  const needle = searchText.trim().toLowerCase();
  if (needle === "") {
    return [];
  }
  return AVAILABLE_SETS.filter(
    (setOption) =>
      setOption.id.toLowerCase().includes(needle) ||
      setOption.name.toLowerCase().includes(needle)
  );
}

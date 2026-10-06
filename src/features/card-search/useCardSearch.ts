import {useCallback, useEffect, useRef, useState} from "react";
import {type CardMatch, findCardMatches, isAbortError, loadSearchCards, type SearchCard} from "./tcgdexApi";

const DETAIL_BATCH_SIZE = 24;

export type CardSearchState =
    | {status: "idle"}
    | {status: "searching"}
    | {status: "error"; message: string}
    | {
    status: "ready";
    matches: CardMatch[];
    cards: SearchCard[];
    loadedCount: number;
    isLoadingMore: boolean;
    loadMoreError: string | null;
};

type ReadyState = Extract<CardSearchState, {status: "ready"}>;

export function useCardSearch() {
    const [state, setState] = useState<CardSearchState>({status: "idle"});
    const controllerRef = useRef<AbortController | null>(null);

    useEffect(() => () => controllerRef.current?.abort(), []);

    const startRequest = useCallback((): AbortSignal => {
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;
        return controller.signal;
    }, []);

    const search = useCallback(
        async (query: string) => {
            const signal = startRequest();
            setState({status: "searching"});
            try {
                const matches = await findCardMatches(query, signal);
                const batch = matches.slice(0, DETAIL_BATCH_SIZE);
                const cards = await loadSearchCards(batch, signal);
                setState({
                    status: "ready",
                    matches,
                    cards,
                    loadedCount: batch.length,
                    isLoadingMore: false,
                    loadMoreError: null,
                });
            } catch (error) {
                if (!isAbortError(error)) {
                    setState({status: "error", message: errorMessage(error)});
                }
            }
        },
        [startRequest]
    );

    const loadMore = useCallback(async () => {
        if (state.status !== "ready" || state.isLoadingMore || state.loadedCount >= state.matches.length) {
            return;
        }
        const {matches, loadedCount} = state;
        const signal = startRequest();
        const update = (change: (current: ReadyState) => ReadyState) =>
            setState((current) => (current.status === "ready" && current.matches === matches ? change(current) : current));

        update((current) => ({...current, isLoadingMore: true, loadMoreError: null}));
        const batch = matches.slice(loadedCount, loadedCount + DETAIL_BATCH_SIZE);
        try {
            const cards = await loadSearchCards(batch, signal);
            update((current) => ({
                ...current,
                cards: [...current.cards, ...cards],
                loadedCount: loadedCount + batch.length,
                isLoadingMore: false,
            }));
        } catch (error) {
            if (!isAbortError(error)) {
                update((current) => ({...current, isLoadingMore: false, loadMoreError: errorMessage(error)}));
            }
        }
    }, [state, startRequest]);

    return {state, search, loadMore};
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "The search failed.";
}

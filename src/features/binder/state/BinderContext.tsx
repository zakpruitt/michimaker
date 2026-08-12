import {createContext, type ReactNode, use, useEffect, useMemo, useReducer, useRef, useState,} from "react";
import type {ArtPiece} from "../../../types/art";
import type {Binder, GridRect, PocketColumns, PocketContent, PocketRef,} from "../../../types/binder";
import type {CardSummary} from "../../../types/card";
import {useNotices} from "../../../components/notices/NoticeContext";
import {urlToDataUrl} from "../../../blobToDataUrl";
import {applyPocketColumnsCssVariables} from "../../../domainCssVariables";
import {loadBinderFromLocalStorage, saveBinderToLocalStorage} from "../../sharing/storage";
import {readBinderFromCurrentUrl, removeShareParamFromUrl} from "../../sharing/shareLink";
import {
    binderReducer,
    createDefaultBinder,
    planPageDelete,
    planPageInsert,
    planPocketColumnsChange,
} from "./binderReducer";
import {
    buildPocketContentMap,
    listCoveredPockets,
    moveRectToPocket,
    pocketKey,
    rectArea,
    rectFromPockets,
    validateRectShape,
} from "./gridMath";
import type {ArtMovePayload} from "../pocket/dragPayload";

export interface BinderStateValue {
    binder: Binder;
    pocketContents: Map<string, PocketContent>;
}

export interface SelectionValue {
    selection: GridRect | null;
    selectedPocketKeys: Set<string>;
    selectionIsPlaceable: boolean;
}

export interface BinderActions {
    addPageAfter(pageIndex: number): void;

    deletePage(pageIndex: number): void;

    placeCardFromSearch(card: CardSummary): void;

    placeCardAt(pocket: PocketRef, card: CardSummary): void;

    moveCard(from: PocketRef, to: PocketRef): void;

    placeArtInSelection(art: ArtPiece): void;

    dropArtOnPocket(pocket: PocketRef, art: ArtPiece): void;

    moveArt(move: ArtMovePayload, to: PocketRef): void;

    removeSelectionContent(): void;

    handlePocketMouseDown(pocket: PocketRef): void;

    handlePocketMouseEnter(pocket: PocketRef): void;

    clearSelection(): void;

    setBinderTitle(title: string): void;

    setPocketColumns(columns: PocketColumns): void;

    replaceBinder(binder: Binder): void;

    resetBinder(): void;
}

const BinderStateContext = createContext<BinderStateValue | null>(null);
const SelectionContext = createContext<SelectionValue | null>(null);
const BinderActionsContext = createContext<BinderActions | null>(null);

const AUTO_SAVE_DELAY_MS = 400;

interface InitialLoad {
    binder: Binder;
    source: "share-link" | "local-storage" | "default";
    shareLinkError: string | null;
}

function resolveInitialBinder(): InitialLoad {
    const fromUrl = readBinderFromCurrentUrl();
    if (fromUrl.status === "ok") {
        return {binder: fromUrl.binder, source: "share-link", shareLinkError: null};
    }
    const shareLinkError = fromUrl.status === "error" ? fromUrl.message : null;
    const stored = loadBinderFromLocalStorage();
    if (stored !== null) {
        return {binder: stored, source: "local-storage", shareLinkError};
    }
    return {binder: createDefaultBinder(), source: "default", shareLinkError};
}

function describeDropped(names: string[]): string {
    const shown = names.slice(0, 4).join(", ");
    const extra = names.length - 4;
    const list = extra > 0 ? `${shown}, and ${extra} more` : shown;
    return `${names.length} card${names.length === 1 ? "" : "s"} (${list})`;
}

function singlePocketRect(pocket: PocketRef): GridRect {
    return {
        pageIndex: pocket.pageIndex,
        row: pocket.row,
        column: pocket.column,
        rowCount: 1,
        columnCount: 1,
    };
}

export function BinderProvider({children}: { children: ReactNode }) {
    const {showNotice} = useNotices();

    const [initialLoad] = useState<InitialLoad>(resolveInitialBinder);
    const [binder, dispatch] = useReducer(binderReducer, initialLoad.binder);
    const [selection, setSelection] = useState<GridRect | null>(null);

    const dragAnchorRef = useRef<PocketRef | null>(null);

    const pocketContents = useMemo(() => buildPocketContentMap(binder), [binder]);

    const selectedPocketKeys = useMemo(() => {
        if (selection === null) {
            return new Set<string>();
        }
        return new Set(listCoveredPockets(selection, binder.pocketColumns).map(pocketKey));
    }, [selection, binder.pocketColumns]);

    const selectionIsPlaceable = useMemo(() => {
        if (selection === null) {
            return false;
        }
        if (validateRectShape(selection, binder.pages.length, binder.pocketColumns) !== null) {
            return false;
        }
        return listCoveredPockets(selection, binder.pocketColumns).every(
            (pocket) => !pocketContents.has(pocketKey(pocket))
        );
    }, [selection, binder.pages.length, binder.pocketColumns, pocketContents]);

    const snapshotRef = useRef({binder, pocketContents, selection, selectedPocketKeys, selectionIsPlaceable});
    snapshotRef.current = {binder, pocketContents, selection, selectedPocketKeys, selectionIsPlaceable};

    const startupReportedRef = useRef(false);
    useEffect(() => {
        if (startupReportedRef.current) {
            return;
        }
        startupReportedRef.current = true;
        if (initialLoad.source === "share-link") {
            removeShareParamFromUrl();
            showNotice("Binder loaded from the share link.", "success");
        }
        if (initialLoad.shareLinkError !== null) {
            showNotice(
                `${initialLoad.shareLinkError} Your last auto-saved binder was loaded instead.`,
                "error"
            );
        }
    }, [initialLoad, showNotice]);

    useEffect(() => {
        applyPocketColumnsCssVariables(binder.pocketColumns);
    }, [binder.pocketColumns]);

    useEffect(() => {
        const timeoutId = window.setTimeout(
            () => saveBinderToLocalStorage(binder),
            AUTO_SAVE_DELAY_MS
        );
        return () => window.clearTimeout(timeoutId);
    }, [binder]);

    useEffect(() => {
        function flushAutoSave() {
            saveBinderToLocalStorage(snapshotRef.current.binder);
        }

        window.addEventListener("pagehide", flushAutoSave);
        return () => window.removeEventListener("pagehide", flushAutoSave);
    }, []);

    useEffect(() => {
        function handleMouseUp() {
            dragAnchorRef.current = null;
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                dragAnchorRef.current = null;
                setSelection(null);
            }
        }

        window.addEventListener("mouseup", handleMouseUp);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("mouseup", handleMouseUp);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    const actions = useMemo<BinderActions>(() => {
        function warnAboutDroppedArt(droppedTitles: string[]): void {
            if (droppedTitles.length > 0) {
                showNotice(
                    `Removed art that no longer lines up with its spread: ${droppedTitles.join(", ")}.`,
                    "info"
                );
            }
        }

        function tryPlaceArt(rect: GridRect, art: ArtPiece): void {
            const {binder: currentBinder, pocketContents: contents} = snapshotRef.current;
            const shapeError = validateRectShape(
                rect,
                currentBinder.pages.length,
                currentBinder.pocketColumns
            );
            if (shapeError !== null) {
                showNotice(shapeError, "error");
                return;
            }
            const isBlocked = listCoveredPockets(rect, currentBinder.pocketColumns).some(
                (pocket) => contents.has(pocketKey(pocket))
            );
            if (isBlocked) {
                showNotice(
                    "Art needs empty pockets. The selected region overlaps existing cards or art.",
                    "error"
                );
                return;
            }
            dispatch({
                type: "PLACE_ART",
                placement: {id: crypto.randomUUID(), art, rect},
            });
            setSelection(null);
        }

        async function placeCardAt(pocket: PocketRef, card: CardSummary): Promise<void> {
            const content = snapshotRef.current.pocketContents.get(pocketKey(pocket));
            if (content !== undefined && content.kind === "art") {
                showNotice("That pocket is covered by an art span. Remove the art first.", "error");
                return;
            }
            let placed = card;
            if (!card.smallImageUrl.startsWith("data:")) {
                try {
                    placed = {...card, smallImageUrl: await urlToDataUrl(card.smallImageUrl)};
                } catch {
                    showNotice(`The image for ${card.name} could not be downloaded.`, "error");
                    return;
                }
            }
            dispatch({type: "PLACE_CARD", pocket, card: placed});
        }

        return {
            addPageAfter(pageIndex: number): void {
                warnAboutDroppedArt(planPageInsert(snapshotRef.current.binder, pageIndex).droppedTitles);
                setSelection(null);
                dispatch({type: "ADD_PAGE_AFTER", pageIndex});
            },

            deletePage(pageIndex: number): void {
                if (snapshotRef.current.binder.pages.length <= 1) {
                    showNotice("A binder needs at least one page.", "error");
                    return;
                }
                warnAboutDroppedArt(planPageDelete(snapshotRef.current.binder, pageIndex).droppedTitles);
                setSelection(null);
                dispatch({type: "DELETE_PAGE", pageIndex});
            },

            placeCardAt,

            moveCard(from: PocketRef, to: PocketRef): void {
                if (pocketKey(from) === pocketKey(to)) {
                    return;
                }
                const target = snapshotRef.current.pocketContents.get(pocketKey(to));
                if (target !== undefined && target.kind === "art") {
                    showNotice("That pocket is covered by an art span. Remove the art first.", "error");
                    return;
                }
                dispatch({type: "MOVE_CARD", from, to});
                setSelection(null);
            },

            moveArt(move: ArtMovePayload, to: PocketRef): void {
                const {binder: currentBinder, pocketContents: contents} = snapshotRef.current;
                const placement = currentBinder.artPlacements.find((p) => p.id === move.placementId);
                if (placement === undefined) {
                    return;
                }
                const columns = currentBinder.pocketColumns;
                const rect = moveRectToPocket(placement.rect, move.rowOffset, move.columnOffset, to, columns);
                if (rect === null) {
                    showNotice("The art does not fit there.", "error");
                    return;
                }
                const shapeError = validateRectShape(rect, currentBinder.pages.length, columns);
                if (shapeError !== null) {
                    showNotice(shapeError, "error");
                    return;
                }
                const ownKeys = new Set(listCoveredPockets(placement.rect, columns).map(pocketKey));
                const isBlocked = listCoveredPockets(rect, columns).some((pocket) => {
                    const key = pocketKey(pocket);
                    return !ownKeys.has(key) && contents.has(key);
                });
                if (isBlocked) {
                    showNotice("The art would land on existing cards or art.", "error");
                    return;
                }
                dispatch({type: "MOVE_ART", placementId: placement.id, rect});
                setSelection(rect);
            },

            placeCardFromSearch(card: CardSummary): void {
                const {selection: currentSelection} = snapshotRef.current;
                if (currentSelection === null) {
                    showNotice("Click a binder pocket first, then pick a card.", "info");
                    return;
                }
                if (rectArea(currentSelection) > 1) {
                    showNotice(
                        "A card fills a single pocket. Select one pocket (multi-pocket regions are for art).",
                        "info"
                    );
                    return;
                }
                placeCardAt(
                    listCoveredPockets(currentSelection, snapshotRef.current.binder.pocketColumns)[0],
                    card
                );
                setSelection(null);
            },

            placeArtInSelection(art: ArtPiece): void {
                const {selection: currentSelection} = snapshotRef.current;
                if (currentSelection === null) {
                    showNotice(
                        "Select where the art goes first: click a pocket, or drag across several empty pockets for a spanning piece.",
                        "info"
                    );
                    return;
                }
                tryPlaceArt(currentSelection, art);
            },

            dropArtOnPocket(pocket: PocketRef, art: ArtPiece): void {
                const current = snapshotRef.current;
                if (current.selectionIsPlaceable && current.selectedPocketKeys.has(pocketKey(pocket))) {
                    tryPlaceArt(current.selection as GridRect, art);
                } else {
                    tryPlaceArt(singlePocketRect(pocket), art);
                }
            },

            removeSelectionContent(): void {
                const {
                    selection: currentSelection,
                    pocketContents: contents,
                    binder: currentBinder,
                } = snapshotRef.current;
                if (currentSelection === null) {
                    return;
                }
                const anchor = listCoveredPockets(currentSelection, currentBinder.pocketColumns)[0];
                const content = contents.get(pocketKey(anchor));
                if (content === undefined || content.kind === "empty") {
                    return;
                }
                if (content.kind === "art") {
                    dispatch({type: "REMOVE_ART_PLACEMENT", placementId: content.placement.id});
                } else {
                    dispatch({type: "CLEAR_POCKET", pocket: anchor});
                }
                setSelection(null);
            },

            handlePocketMouseDown(pocket: PocketRef): void {
                const content = snapshotRef.current.pocketContents.get(pocketKey(pocket));
                if (content !== undefined && content.kind === "art") {
                    setSelection(content.placement.rect);
                    return;
                }
                setSelection(singlePocketRect(pocket));
                if (content === undefined) {
                    dragAnchorRef.current = pocket;
                }
            },

            handlePocketMouseEnter(pocket: PocketRef): void {
                const anchor = dragAnchorRef.current;
                if (anchor === null) {
                    return;
                }
                const rect = rectFromPockets(anchor, pocket, snapshotRef.current.binder.pocketColumns);
                if (rect !== null) {
                    setSelection(rect);
                }
            },

            clearSelection(): void {
                setSelection(null);
            },

            setBinderTitle(title: string): void {
                dispatch({type: "SET_TITLE", title});
            },

            setPocketColumns(columns: PocketColumns): void {
                const currentBinder = snapshotRef.current.binder;
                if (columns === currentBinder.pocketColumns) {
                    return;
                }
                const plan = planPocketColumnsChange(currentBinder, columns);
                if (plan.droppedCardNames.length > 0) {
                    showNotice(
                        `Removed ${describeDropped(plan.droppedCardNames)} that sat in the fourth column.`,
                        "info"
                    );
                }
                warnAboutDroppedArt(plan.droppedTitles);
                setSelection(null);
                dispatch({type: "SET_POCKET_COLUMNS", columns});
            },

            replaceBinder(newBinder: Binder): void {
                setSelection(null);
                dispatch({type: "REPLACE_BINDER", binder: newBinder});
            },

            resetBinder(): void {
                setSelection(null);
                dispatch({type: "REPLACE_BINDER", binder: createDefaultBinder()});
            },
        };
    }, [showNotice]);

    const stateValue = useMemo<BinderStateValue>(
        () => ({binder, pocketContents}),
        [binder, pocketContents]
    );
    const selectionValue = useMemo<SelectionValue>(
        () => ({selection, selectedPocketKeys, selectionIsPlaceable}),
        [selection, selectedPocketKeys, selectionIsPlaceable]
    );

    return (
        <BinderStateContext value={stateValue}>
            <SelectionContext value={selectionValue}>
                <BinderActionsContext value={actions}>
                    {children}
                </BinderActionsContext>
            </SelectionContext>
        </BinderStateContext>
    );
}

function useRequiredContext<T>(context: React.Context<T | null>, hookName: string): T {
    const value = use(context);
    if (value === null) {
        throw new Error(`${hookName} must be used inside a BinderProvider`);
    }
    return value;
}

export function useBinderState(): BinderStateValue {
    return useRequiredContext(BinderStateContext, "useBinderState");
}

export function useSelection(): SelectionValue {
    return useRequiredContext(SelectionContext, "useSelection");
}

export function useBinderActions(): BinderActions {
    return useRequiredContext(BinderActionsContext, "useBinderActions");
}

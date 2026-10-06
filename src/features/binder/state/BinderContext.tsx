import {
    createContext,
    type ReactNode,
    use,
    useEffect,
    useLayoutEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";
import type {ArtPiece} from "../../../types/art";
import {
    type ArtCrop,
    type Binder,
    DEFAULT_ART_CROP,
    type GridRect,
    type PocketColumns,
    type PocketContent,
    type PocketGap,
    type PocketRef,
} from "../../../types/binder";
import type {CardSummary} from "../../../types/card";
import {useNotices} from "../../../components/notices/NoticeContext";
import {removeShareParamFromUrl} from "../../sharing/shareLink";
import {findCardImageUrls} from "../../card-search/tcgdexApi";
import type {ArtMovePayload} from "../pocket/dragPayload";
import {binderHistoryReducer, createBinderHistory} from "./binderHistory";
import {createDefaultBinder, planPageDelete, planPageInsert, planPocketColumnsChange} from "./binderReducer";
import {
    buildPocketContentMap,
    findPlacementCovering,
    findPlacementMatchingRect,
    listCoveredPockets,
    moveRectToPocket,
    pocketKey,
    rectArea,
    rectFromPockets,
    rectOrigin,
    singlePocketRect,
    validateRectShape,
} from "./gridMath";
import {type InitialLoad, listInlinedCardImageIds, resolveInitialBinder} from "./initialBinder";
import {useAutoSave} from "./useAutoSave";
import {useBinderShortcuts} from "./useBinderShortcuts";

export interface BinderStateValue {
    binder: Binder;
    pocketContents: Map<string, PocketContent>;
    canUndo: boolean;
    canRedo: boolean;
}

export interface SelectionValue {
    selection: GridRect | null;
    selectedPocketKeys: Set<string>;
    selectionIsPlaceable: boolean;
}

export interface BinderActions {
    addPageAfter: (pageIndex: number) => void;
    deletePage: (pageIndex: number) => void;
    placeCardFromSearch: (card: CardSummary) => void;
    placeCardAt: (pocket: PocketRef, card: CardSummary) => void;
    moveCard: (from: PocketRef, to: PocketRef) => void;
    toggleSelectedCardOwned: () => void;
    placeArtInSelection: (art: ArtPiece) => void;
    dropArtOnPocket: (pocket: PocketRef, art: ArtPiece) => void;
    moveArt: (move: ArtMovePayload, to: PocketRef) => void;
    setArtCrop: (placementId: string, crop: ArtCrop) => void;
    removeSelectionContent: () => void;
    handlePocketMouseDown: (pocket: PocketRef) => void;
    handlePocketMouseEnter: (pocket: PocketRef) => void;
    clearSelection: () => void;
    setBinderTitle: (title: string) => void;
    setPocketColumns: (columns: PocketColumns) => void;
    setPocketGap: (gap: PocketGap) => void;
    replaceBinder: (binder: Binder) => void;
    resetBinder: () => void;
    undo: () => void;
    redo: () => void;
}

const BinderStateContext = createContext<BinderStateValue | null>(null);
const SelectionContext = createContext<SelectionValue | null>(null);
const BinderActionsContext = createContext<BinderActions | null>(null);

function describeDropped(names: string[]): string {
    const shown = names.slice(0, 4).join(", ");
    const extra = names.length - 4;
    const list = extra > 0 ? `${shown}, and ${extra} more` : shown;
    return `${names.length} card${names.length === 1 ? "" : "s"} (${list})`;
}

function artPlacementError(
    rect: GridRect,
    binder: Binder,
    contents: Map<string, PocketContent>,
    ownPlacementId: string | null
): string | null {
    const columns = binder.pocketColumns;
    const shapeError = validateRectShape(rect, binder.pages.length, columns);
    if (shapeError !== null) {
        return shapeError;
    }
    const pockets = listCoveredPockets(rect, columns);
    const hitsOtherArt = pockets.some((pocket) => {
        const placement = findPlacementCovering(binder.artPlacements, pocket, columns);
        return placement !== null && placement.id !== ownPlacementId;
    });
    if (hitsOtherArt) {
        return "Another art piece already covers part of that region.";
    }
    if (pockets.every((pocket) => contents.get(pocketKey(pocket))?.kind === "card")) {
        return "Every pocket there holds a card, so the art would be hidden completely.";
    }
    return null;
}

export function BinderProvider({children}: { children: ReactNode }) {
    const {showNotice} = useNotices();

    const [initialLoad] = useState<InitialLoad>(resolveInitialBinder);
    const [history, dispatch] = useReducer(binderHistoryReducer, initialLoad, (load) =>
        createBinderHistory(load.binder, load.replacedBinder === null ? [] : [load.replacedBinder])
    );
    const binder = history.present;
    const [selection, setSelection] = useState<GridRect | null>(null);
    const dragAnchorRef = useRef<PocketRef | null>(null);

    const pocketContents = useMemo(() => buildPocketContentMap(binder), [binder]);

    const selectedPocketKeys = useMemo(
        () => new Set(selection === null ? [] : listCoveredPockets(selection, binder.pocketColumns).map(pocketKey)),
        [selection, binder.pocketColumns]
    );

    const selectionIsPlaceable = useMemo(
        () => selection !== null && artPlacementError(selection, binder, pocketContents, null) === null,
        [selection, binder, pocketContents]
    );

    const snapshotRef = useRef({binder, pocketContents, selection, selectedPocketKeys, selectionIsPlaceable});
    useLayoutEffect(() => {
        snapshotRef.current = {binder, pocketContents, selection, selectedPocketKeys, selectionIsPlaceable};
    });

    useAutoSave(binder);

    const startupReportedRef = useRef(false);
    useEffect(() => {
        if (startupReportedRef.current) {
            return;
        }
        startupReportedRef.current = true;
        if (initialLoad.source === "share-link") {
            removeShareParamFromUrl();
            if (initialLoad.replacedBinder === null) {
                showNotice("Binder loaded from the share link.", "success");
            } else {
                showNotice("Binder loaded from the share link. Your own binder is one undo away.", "success", {
                    label: "Back to mine",
                    onAction: () => dispatch({type: "UNDO"}),
                });
            }
        }
        if (initialLoad.shareLinkError !== null) {
            showNotice(`${initialLoad.shareLinkError} Your last auto-saved binder was loaded instead.`, "error");
        }
    }, [initialLoad, showNotice]);

    useEffect(() => {
        const inlinedIds = listInlinedCardImageIds(initialLoad.binder);
        if (inlinedIds.length === 0) {
            return;
        }
        let cancelled = false;
        findCardImageUrls(inlinedIds).then(
            (imageUrlsByCardId) => {
                if (!cancelled && imageUrlsByCardId.size > 0) {
                    dispatch({type: "SET_CARD_IMAGES", imageUrlsByCardId});
                }
            },
            () => undefined
        );
        return () => {
            cancelled = true;
        };
    }, [initialLoad]);

    useEffect(() => {
        function handleMouseUp() {
            dragAnchorRef.current = null;
        }

        window.addEventListener("mouseup", handleMouseUp);
        return () => window.removeEventListener("mouseup", handleMouseUp);
    }, []);

    const actions = useMemo<BinderActions>(() => {
        function warnAboutDroppedArt(droppedTitles: string[]): void {
            if (droppedTitles.length > 0) {
                showNotice(`Removed art that no longer lines up with its spread: ${droppedTitles.join(", ")}.`, "info");
            }
        }

        function tryPlaceArt(rect: GridRect, art: ArtPiece): void {
            const {binder: currentBinder, pocketContents: contents} = snapshotRef.current;
            const error = artPlacementError(rect, currentBinder, contents, null);
            if (error !== null) {
                showNotice(error, "error");
                return;
            }
            dispatch({type: "PLACE_ART", placement: {id: crypto.randomUUID(), art, rect, crop: DEFAULT_ART_CROP}});
            setSelection(null);
        }

        function placeCardAt(pocket: PocketRef, card: CardSummary): void {
            dispatch({type: "PLACE_CARD", pocket, card});
        }

        function clearSelection(): void {
            dragAnchorRef.current = null;
            setSelection(null);
        }

        return {
            addPageAfter(pageIndex: number): void {
                warnAboutDroppedArt(planPageInsert(snapshotRef.current.binder, pageIndex).droppedTitles);
                clearSelection();
                dispatch({type: "ADD_PAGE_AFTER", pageIndex});
            },

            deletePage(pageIndex: number): void {
                if (snapshotRef.current.binder.pages.length <= 1) {
                    showNotice("A binder needs at least one page.", "error");
                    return;
                }
                warnAboutDroppedArt(planPageDelete(snapshotRef.current.binder, pageIndex).droppedTitles);
                clearSelection();
                dispatch({type: "DELETE_PAGE", pageIndex});
            },

            placeCardAt,

            moveCard(from: PocketRef, to: PocketRef): void {
                if (pocketKey(from) !== pocketKey(to)) {
                    dispatch({type: "MOVE_CARD", from, to});
                    clearSelection();
                }
            },

            moveArt(move: ArtMovePayload, to: PocketRef): void {
                const {binder: currentBinder, pocketContents: contents} = snapshotRef.current;
                const placement = currentBinder.artPlacements.find((p) => p.id === move.placementId);
                if (placement === undefined) {
                    return;
                }
                const rect = moveRectToPocket(
                    placement.rect,
                    move.rowOffset,
                    move.columnOffset,
                    to,
                    currentBinder.pocketColumns
                );
                if (rect === null) {
                    showNotice("The art does not fit there.", "error");
                    return;
                }
                const error = artPlacementError(rect, currentBinder, contents, placement.id);
                if (error !== null) {
                    showNotice(error, "error");
                    return;
                }
                dispatch({type: "MOVE_ART", placementId: placement.id, rect});
                setSelection(rect);
            },

            toggleSelectedCardOwned(): void {
                const {selection: currentSelection, pocketContents: contents} = snapshotRef.current;
                if (currentSelection === null || rectArea(currentSelection) !== 1) {
                    return;
                }
                const pocket = rectOrigin(currentSelection);
                const content = contents.get(pocketKey(pocket));
                if (content?.kind === "card") {
                    dispatch({type: "SET_CARD_OWNED", pocket, owned: content.card.owned !== true});
                }
            },

            setArtCrop(placementId: string, crop: ArtCrop): void {
                dispatch({type: "SET_ART_CROP", placementId, crop});
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
                placeCardAt(rectOrigin(currentSelection), card);
                clearSelection();
            },

            placeArtInSelection(art: ArtPiece): void {
                const {selection: currentSelection} = snapshotRef.current;
                if (currentSelection === null) {
                    showNotice(
                        "Select where the art goes first: click a pocket, or drag across several pockets for a spanning piece.",
                        "info"
                    );
                    return;
                }
                tryPlaceArt(currentSelection, art);
            },

            dropArtOnPocket(pocket: PocketRef, art: ArtPiece): void {
                const {selection: currentSelection, selectionIsPlaceable: isPlaceable, selectedPocketKeys: keys} =
                    snapshotRef.current;
                const dropsIntoSelection = currentSelection !== null && isPlaceable && keys.has(pocketKey(pocket));
                tryPlaceArt(dropsIntoSelection ? currentSelection : singlePocketRect(pocket), art);
            },

            removeSelectionContent(): void {
                const {selection: currentSelection, pocketContents: contents, binder: currentBinder} =
                    snapshotRef.current;
                if (currentSelection === null) {
                    return;
                }
                const anchor = rectOrigin(currentSelection);
                const selectedArt = findPlacementMatchingRect(currentBinder.artPlacements, currentSelection);
                if (rectArea(currentSelection) === 1 && contents.get(pocketKey(anchor))?.kind === "card") {
                    dispatch({type: "CLEAR_POCKET", pocket: anchor});
                } else if (selectedArt !== null) {
                    dispatch({type: "REMOVE_ART_PLACEMENT", placementId: selectedArt.id});
                } else {
                    return;
                }
                clearSelection();
            },

            handlePocketMouseDown(pocket: PocketRef): void {
                const content = snapshotRef.current.pocketContents.get(pocketKey(pocket));
                if (content?.kind === "art") {
                    setSelection(content.placement.rect);
                    return;
                }
                setSelection(singlePocketRect(pocket));
                dragAnchorRef.current = pocket;
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

            clearSelection,

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
                    showNotice(`Removed ${describeDropped(plan.droppedCardNames)} that sat in the fourth column.`, "info");
                }
                warnAboutDroppedArt(plan.droppedTitles);
                clearSelection();
                dispatch({type: "SET_POCKET_COLUMNS", columns});
            },

            setPocketGap(gap: PocketGap): void {
                dispatch({type: "SET_POCKET_GAP", gap});
            },

            replaceBinder(newBinder: Binder): void {
                clearSelection();
                dispatch({type: "REPLACE_BINDER", binder: newBinder});
            },

            resetBinder(): void {
                clearSelection();
                dispatch({type: "REPLACE_BINDER", binder: createDefaultBinder()});
            },

            undo(): void {
                clearSelection();
                dispatch({type: "UNDO"});
            },

            redo(): void {
                clearSelection();
                dispatch({type: "REDO"});
            },
        };
    }, [showNotice]);

    useBinderShortcuts(actions);

    const canUndo = history.past.length > 0;
    const canRedo = history.future.length > 0;
    const stateValue = useMemo<BinderStateValue>(
        () => ({binder, pocketContents, canUndo, canRedo}),
        [binder, pocketContents, canUndo, canRedo]
    );
    const selectionValue = useMemo<SelectionValue>(
        () => ({selection, selectedPocketKeys, selectionIsPlaceable}),
        [selection, selectedPocketKeys, selectionIsPlaceable]
    );

    return (
        <BinderStateContext value={stateValue}>
            <SelectionContext value={selectionValue}>
                <BinderActionsContext value={actions}>{children}</BinderActionsContext>
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

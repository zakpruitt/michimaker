/**
 * The binder "service layer": one provider component exposing binder state
 * and every operation the UI performs on it, split across three contexts so
 * components only re-render for the data they actually read:
 *
 *  - useBinderState()   → the binder and the pocket → content lookup
 *                         (changes when the binder is edited)
 *  - useSelection()     → the current pocket selection
 *                         (changes on every drag step; only the binder grid
 *                          and side-panel hints subscribe to this)
 *  - useBinderActions() → the operations; the object is stable for the whole
 *                         app lifetime, so subscribing costs nothing
 *
 * Rough Java analogy: a session-scoped @Service (the actions) plus two
 * read-only views of its state. Actions validate, surface inline notices on
 * failure, and dispatch commands to binderReducer. The provider also owns:
 *
 *  - initial load precedence: share-link URL > localStorage auto-save > empty
 *  - debounced auto-save to localStorage (flushed when the tab closes)
 *  - spreadsheet-style drag selection of rectangular regions for art spans
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ArtPiece } from "../../types/art";
import type { Binder, GridRect, PocketContent, PocketRef } from "../../types/binder";
import type { CardSummary } from "../../types/card";
import { useNotices } from "../../components/notices/NoticeContext";
import { loadBinderFromLocalStorage, saveBinderToLocalStorage } from "../sharing/storage";
import { readBinderFromCurrentUrl, removeShareParamFromUrl } from "../sharing/shareLink";
import {
  binderReducer,
  createDefaultBinder,
  planPageDelete,
  planPageInsert,
} from "./binderReducer";
import {
  buildPocketContentMap,
  listCoveredPockets,
  pocketKey,
  rectArea,
  rectFromPockets,
  validateRectShape,
} from "./gridMath";

export interface BinderStateValue {
  binder: Binder;
  /** Resolved content per pocket; pockets absent from the map are empty. */
  pocketContents: Map<string, PocketContent>;
}

export interface SelectionValue {
  selection: GridRect | null;
  /** Pocket keys inside the current selection (for highlight rendering). */
  selectedPocketKeys: Set<string>;
  /** True when the selection covers only empty pockets (art can go there). */
  selectionIsPlaceable: boolean;
}

export interface BinderActions {
  // --- page operations ---
  addPageAfter(pageIndex: number): void;
  deletePage(pageIndex: number): void;

  // --- placement operations ---
  placeCardFromSearch(card: CardSummary): void;
  placeCardAt(pocket: PocketRef, card: CardSummary): void;
  placeArtInSelection(art: ArtPiece): void;
  dropArtOnPocket(pocket: PocketRef, art: ArtPiece): void;
  removeSelectionContent(): void;

  // --- selection interaction (wired to pocket mouse events) ---
  handlePocketMouseDown(pocket: PocketRef): void;
  handlePocketMouseEnter(pocket: PocketRef): void;
  clearSelection(): void;

  // --- whole-binder operations ---
  setBinderTitle(title: string): void;
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

/** Share link (if present) wins over auto-save; otherwise a fresh binder. */
function resolveInitialBinder(): InitialLoad {
  const fromUrl = readBinderFromCurrentUrl();
  if (fromUrl.status === "ok") {
    return { binder: fromUrl.binder, source: "share-link", shareLinkError: null };
  }
  const shareLinkError = fromUrl.status === "error" ? fromUrl.message : null;
  const stored = loadBinderFromLocalStorage();
  if (stored !== null) {
    return { binder: stored, source: "local-storage", shareLinkError };
  }
  return { binder: createDefaultBinder(), source: "default", shareLinkError };
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

export function BinderProvider({ children }: { children: ReactNode }) {
  const { showNotice } = useNotices();

  const [initialLoad] = useState<InitialLoad>(resolveInitialBinder);
  const [binder, dispatch] = useReducer(binderReducer, initialLoad.binder);
  const [selection, setSelection] = useState<GridRect | null>(null);

  // Where the current drag-selection started. A ref, not state: it changes
  // during mouse interaction but nothing renders from it.
  const dragAnchorRef = useRef<PocketRef | null>(null);

  const pocketContents = useMemo(() => buildPocketContentMap(binder), [binder]);

  const selectedPocketKeys = useMemo(() => {
    if (selection === null) {
      return new Set<string>();
    }
    return new Set(listCoveredPockets(selection).map(pocketKey));
  }, [selection]);

  const selectionIsPlaceable = useMemo(() => {
    if (selection === null) {
      return false;
    }
    if (validateRectShape(selection, binder.pages.length) !== null) {
      return false;
    }
    return listCoveredPockets(selection).every(
      (pocket) => !pocketContents.has(pocketKey(pocket))
    );
  }, [selection, binder.pages.length, pocketContents]);

  // Latest-state snapshot so the action callbacks below can stay stable
  // (identical object for the app's lifetime) while always reading current
  // values. Updated every render; actions only run from event handlers,
  // which always fire after the render that produced their state.
  const snapshotRef = useRef({ binder, pocketContents, selection, selectedPocketKeys, selectionIsPlaceable });
  snapshotRef.current = { binder, pocketContents, selection, selectedPocketKeys, selectionIsPlaceable };

  // ---------------------------------------------------------------------
  // Startup: report how the binder was loaded, then drop the share param so
  // refreshing keeps the user's edits (auto-save) instead of the snapshot.
  // ---------------------------------------------------------------------
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

  // Auto-save, debounced so bursts of edits (and binders with large uploaded
  // images) serialize once, not once per change; flushed when the tab hides
  // or closes so the trailing edit is never lost.
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

  // Drag selection ends on mouse-up anywhere; Escape clears the selection.
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

  // ---------------------------------------------------------------------
  // Actions: one stable object; every callback reads live state through
  // snapshotRef instead of closing over render-time values.
  // ---------------------------------------------------------------------
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
      const { binder: currentBinder, pocketContents: contents } = snapshotRef.current;
      const shapeError = validateRectShape(rect, currentBinder.pages.length);
      if (shapeError !== null) {
        showNotice(shapeError, "error");
        return;
      }
      const isBlocked = listCoveredPockets(rect).some((pocket) =>
        contents.has(pocketKey(pocket))
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
        placement: { id: crypto.randomUUID(), art, rect },
      });
      setSelection(null);
    }

    function placeCardAt(pocket: PocketRef, card: CardSummary): void {
      const content = snapshotRef.current.pocketContents.get(pocketKey(pocket));
      if (content !== undefined && content.kind === "art") {
        showNotice("That pocket is covered by an art span. Remove the art first.", "error");
        return;
      }
      dispatch({ type: "PLACE_CARD", pocket, card });
    }

    return {
      addPageAfter(pageIndex: number): void {
        warnAboutDroppedArt(planPageInsert(snapshotRef.current.binder, pageIndex).droppedTitles);
        setSelection(null);
        dispatch({ type: "ADD_PAGE_AFTER", pageIndex });
      },

      deletePage(pageIndex: number): void {
        if (snapshotRef.current.binder.pages.length <= 1) {
          showNotice("A binder needs at least one page.", "error");
          return;
        }
        warnAboutDroppedArt(planPageDelete(snapshotRef.current.binder, pageIndex).droppedTitles);
        setSelection(null);
        dispatch({ type: "DELETE_PAGE", pageIndex });
      },

      placeCardAt,

      placeCardFromSearch(card: CardSummary): void {
        const { selection: currentSelection } = snapshotRef.current;
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
        placeCardAt(listCoveredPockets(currentSelection)[0], card);
        setSelection(null);
      },

      placeArtInSelection(art: ArtPiece): void {
        const { selection: currentSelection } = snapshotRef.current;
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
        // Dropping inside a selected empty region fills the whole region;
        // dropping anywhere else fills just that one pocket.
        const current = snapshotRef.current;
        if (current.selectionIsPlaceable && current.selectedPocketKeys.has(pocketKey(pocket))) {
          tryPlaceArt(current.selection as GridRect, art);
        } else {
          tryPlaceArt(singlePocketRect(pocket), art);
        }
      },

      removeSelectionContent(): void {
        const { selection: currentSelection, pocketContents: contents } = snapshotRef.current;
        if (currentSelection === null) {
          return;
        }
        const anchor = listCoveredPockets(currentSelection)[0];
        const content = contents.get(pocketKey(anchor));
        if (content === undefined || content.kind === "empty") {
          return;
        }
        if (content.kind === "art") {
          dispatch({ type: "REMOVE_ART_PLACEMENT", placementId: content.placement.id });
        } else {
          dispatch({ type: "CLEAR_POCKET", pocket: anchor });
        }
        setSelection(null);
      },

      handlePocketMouseDown(pocket: PocketRef): void {
        const content = snapshotRef.current.pocketContents.get(pocketKey(pocket));
        if (content !== undefined && content.kind === "art") {
          // Clicking any cell of an art span selects the whole span.
          setSelection(content.placement.rect);
          return;
        }
        setSelection(singlePocketRect(pocket));
        if (content === undefined) {
          // Only drags starting on an empty pocket can grow into a region.
          dragAnchorRef.current = pocket;
        }
      },

      handlePocketMouseEnter(pocket: PocketRef): void {
        const anchor = dragAnchorRef.current;
        if (anchor === null) {
          return;
        }
        // Returns null when the mouse wanders onto another spread; the
        // selection keeps its last valid rectangle in that case.
        const rect = rectFromPockets(anchor, pocket);
        if (rect !== null) {
          setSelection(rect);
        }
      },

      clearSelection(): void {
        setSelection(null);
      },

      setBinderTitle(title: string): void {
        dispatch({ type: "SET_TITLE", title });
      },

      replaceBinder(newBinder: Binder): void {
        setSelection(null);
        dispatch({ type: "REPLACE_BINDER", binder: newBinder });
      },

      resetBinder(): void {
        setSelection(null);
        dispatch({ type: "REPLACE_BINDER", binder: createDefaultBinder() });
      },
    };
  }, [showNotice]);

  const stateValue = useMemo<BinderStateValue>(
    () => ({ binder, pocketContents }),
    [binder, pocketContents]
  );
  const selectionValue = useMemo<SelectionValue>(
    () => ({ selection, selectedPocketKeys, selectionIsPlaceable }),
    [selection, selectedPocketKeys, selectionIsPlaceable]
  );

  return (
    <BinderStateContext.Provider value={stateValue}>
      <SelectionContext.Provider value={selectionValue}>
        <BinderActionsContext.Provider value={actions}>
          {children}
        </BinderActionsContext.Provider>
      </SelectionContext.Provider>
    </BinderStateContext.Provider>
  );
}

function useRequiredContext<T>(context: React.Context<T | null>, hookName: string): T {
  const value = useContext(context);
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

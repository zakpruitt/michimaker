import {useState} from "react";
import type {ArtPlacement} from "../../../types/binder";
import {useBinderActions, useBinderState, useSelection} from "../state/BinderContext";
import {findPlacementMatchingRect, listCoveredPockets, pocketKey, rectArea} from "../state/gridMath";
import {ArtCropDialog} from "../crop/ArtCropDialog";
import styles from "./SelectionBanner.module.css";

export function SelectionBanner() {
    const {selection, selectionIsPlaceable} = useSelection();
    const {binder, pocketContents} = useBinderState();
    const {removeSelectionContent, clearSelection} = useBinderActions();
    const [isCropOpen, setIsCropOpen] = useState(false);

    let description: string;
    let canRemove = false;
    let artToFrame: ArtPlacement | null = null;

    if (selection === null) {
        description = "Click a pocket, or drag across pockets for art.";
    } else {
        const anchor = listCoveredPockets(selection, binder.pocketColumns)[0];
        const anchorContent = pocketContents.get(pocketKey(anchor));
        const sizeLabel = `${selection.rowCount}×${selection.columnCount}`;

        const isSinglePocket = rectArea(selection) === 1;
        const selectedArt = findPlacementMatchingRect(binder.artPlacements, selection);

        if (isSinglePocket && anchorContent?.kind === "card") {
            description = `Card: ${anchorContent.card.name}`;
            canRemove = true;
        } else if (selectedArt !== null) {
            const rect = selectedArt.rect;
            description = `Art: ${selectedArt.art.title} (${rect.rowCount}×${rect.columnCount})`;
            canRemove = true;
            artToFrame = selectedArt;
        } else if (isSinglePocket) {
            description = "Empty pocket selected. Pick a card or art piece.";
        } else if (selectionIsPlaceable) {
            description = `${sizeLabel} region selected. Pick a piece in the Art tab; cards inside it stay on top of it.`;
        } else {
            description = `${sizeLabel} region overlaps existing art.`;
        }
    }

    return (
        <div className={styles.banner} data-print="hide">
      <span
          className={selection === null ? styles.hint : styles.description}
          title={description}
      >
        {description}
      </span>
            <div className={styles.actions}>
                <button
                    type="button"
                    className={styles.frameButton}
                    onClick={() => setIsCropOpen(true)}
                    disabled={artToFrame === null}
                >
                    Adjust framing
                </button>
                <button
                    type="button"
                    className={styles.removeButton}
                    onClick={removeSelectionContent}
                    disabled={!canRemove}
                >
                    Remove
                </button>
                <button
                    type="button"
                    className={styles.clearButton}
                    onClick={clearSelection}
                    disabled={selection === null}
                >
                    Clear selection
                </button>
            </div>
            {isCropOpen && artToFrame !== null && (
                <ArtCropDialog placement={artToFrame} onClose={() => setIsCropOpen(false)}/>
            )}
        </div>
    );
}

/**
 * The status strip above the binder: a short label for the current selection
 * (a pocket, an empty region ready for art, a card, or a whole art span) and
 * the matching actions: remove content, clear the selection.
 *
 * Deliberately terse. The labels are short enough to never truncate; the
 * full walkthrough lives on the "How to use" page (#/how-to). The strip
 * keeps one fixed height and both buttons are always rendered (disabled when
 * inapplicable), so changing the selection never shifts the layout below.
 */
import { useBinderActions, useBinderState, useSelection } from "./BinderContext";
import { listCoveredPockets, pocketKey, rectArea } from "./gridMath";
import styles from "./SelectionBanner.module.css";

export function SelectionBanner() {
  const { selection, selectionIsPlaceable } = useSelection();
  const { binder, pocketContents } = useBinderState();
  const { removeSelectionContent, clearSelection } = useBinderActions();

  let description: string;
  let canRemove = false;

  if (selection === null) {
    description = "Click a pocket, or drag across empty pockets for art.";
  } else {
    const anchor = listCoveredPockets(selection, binder.pocketColumns)[0];
    const anchorContent = pocketContents.get(pocketKey(anchor));
    const sizeLabel = `${selection.rowCount}×${selection.columnCount}`;

    if (anchorContent === undefined || anchorContent.kind === "empty") {
      if (rectArea(selection) === 1) {
        description = "Empty pocket selected. Pick a card or art piece.";
      } else if (selectionIsPlaceable) {
        description = `${sizeLabel} region selected. Pick a piece in the Art tab.`;
      } else {
        description = `${sizeLabel} region overlaps existing content.`;
      }
    } else if (anchorContent.kind === "card") {
      description = `Card: ${anchorContent.card.name}`;
      canRemove = true;
    } else {
      // anchorContent.kind === "art"
      const rect = anchorContent.placement.rect;
      description = `Art: ${anchorContent.placement.art.title} (${rect.rowCount}×${rect.columnCount})`;
      canRemove = true;
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
    </div>
  );
}

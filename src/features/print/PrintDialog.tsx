/**
 * Options dialog shown before printing: which pages, which mode (full page
 * cut guide vs. ink-saving packed art sheets), and whether side-by-side art
 * on the same page stays connected as one strip.
 */
import { useState } from "react";
import { useBinderState } from "../binder/BinderContext";
import type { PrintOptions } from "./PrintContext";
import { splitPlacementsIntoPieces } from "./packArtSheets";
import styles from "./PrintDialog.module.css";

interface PrintDialogProps {
  onConfirm: (options: PrintOptions) => void;
  onCancel: () => void;
}

export function PrintDialog({ onConfirm, onCancel }: PrintDialogProps) {
  const { binder } = useBinderState();

  const [mode, setMode] = useState<PrintOptions["mode"]>("pages");
  const [allPages, setAllPages] = useState(true);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [connectStrips, setConnectStrips] = useState(true);

  const pageIndexes: number[] | "all" = allPages
    ? "all"
    : [...selectedPages].sort((a, b) => a - b);

  // Cheap enough to recompute every render: a handful of placements at most.
  const artPieceCount = splitPlacementsIntoPieces(
    binder.artPlacements,
    pageIndexes,
    binder.pocketColumns
  ).length;

  const nothingSelected = !allPages && selectedPages.size === 0;
  const canPrint =
    !nothingSelected && (mode === "pages" || artPieceCount > 0);

  function togglePage(pageIndex: number) {
    setSelectedPages((current) => {
      const next = new Set(current);
      if (next.has(pageIndex)) {
        next.delete(pageIndex);
      } else {
        next.add(pageIndex);
      }
      return next;
    });
  }

  return (
    <div className={styles.overlay} data-print="hide" onClick={onCancel}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Print options"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className={styles.title}>Print cut guide</h2>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>What to print</legend>
          <label className={styles.option}>
            <input
              type="radio"
              name="print-mode"
              checked={mode === "pages"}
              onChange={() => setMode("pages")}
            />
            <span>
              <strong>Binder pages</strong>
              <small>Each selected page as a full 9-pocket guide.</small>
            </span>
          </label>
          <label className={styles.option}>
            <input
              type="radio"
              name="print-mode"
              checked={mode === "art-only"}
              onChange={() => setMode("art-only")}
            />
            <span>
              <strong>Art only (saves ink)</strong>
              <small>
                Just the art pieces, packed onto as few sheets as possible.
                {mode === "art-only" && (
                  <>
                    {" "}
                    {artPieceCount === 0
                      ? "No art on the selected pages."
                      : `${artPieceCount} piece${artPieceCount === 1 ? "" : "s"} to print.`}
                  </>
                )}
              </small>
            </span>
          </label>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Pages</legend>
          <label className={styles.option}>
            <input
              type="checkbox"
              checked={allPages}
              onChange={(event) => setAllPages(event.target.checked)}
            />
            <span>All pages</span>
          </label>
          {!allPages && (
            <div className={styles.pageGrid}>
              {binder.pages.map((_, pageIndex) => (
                <label key={pageIndex} className={styles.pageCheckbox}>
                  <input
                    type="checkbox"
                    checked={selectedPages.has(pageIndex)}
                    onChange={() => togglePage(pageIndex)}
                  />
                  <span>{pageIndex + 1}</span>
                </label>
              ))}
            </div>
          )}
          {nothingSelected && (
            <p className={styles.warning}>Pick at least one page.</p>
          )}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Cut lines</legend>
          <label className={styles.option}>
            <input
              type="checkbox"
              checked={connectStrips}
              onChange={(event) => setConnectStrips(event.target.checked)}
            />
            <span>
              <strong>Keep side-by-side art connected</strong>
              <small>
                Art crossing pockets on the same page prints as one strip with
                no cut between them. Rows are always cut apart, and so is art
                crossing the middle of a spread.
              </small>
            </span>
          </label>
        </fieldset>

        <div className={styles.buttons}>
          <button type="button" className={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.printButton}
            disabled={!canPrint}
            onClick={() => onConfirm({ mode, pageIndexes, connectStrips })}
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
}

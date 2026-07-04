/**
 * One binder page: a header (page number, total card value, page management
 * buttons) above the pocket grid. In the printed cut guide the header
 * buttons disappear and the grid renders at true physical size.
 */
import {
  POCKET_HEIGHT_MM,
  POCKET_WIDTH_MM,
  ROWS_PER_PAGE,
  type PocketContent,
  type PocketRef,
} from "../../types/binder";
import { useBinderActions, useBinderState } from "./BinderContext";
import { useActivePrintOptions } from "../print/PrintContext";
import { pocketKey } from "./gridMath";
import { PocketView } from "./PocketView";
import styles from "./BinderSpread.module.css";

interface BinderPageViewProps {
  pageIndex: number;
}

const EMPTY_CONTENT: PocketContent = { kind: "empty" };

export function BinderPageView({ pageIndex }: BinderPageViewProps) {
  const { binder, pocketContents } = useBinderState();
  const { addPageAfter, deletePage } = useBinderActions();
  const activePrintOptions = useActivePrintOptions();

  // While a print job with a page selection runs, pages left out of the
  // selection are dropped from the printout (data-print-hidden, print.css).
  const isPrintHidden =
    activePrintOptions !== null &&
    activePrintOptions.pageIndexes !== "all" &&
    !activePrintOptions.pageIndexes.includes(pageIndex);

  const page = binder.pages[pageIndex];
  const pageValue = page.pockets.reduce(
    (total, card) => total + (card?.marketPrice ?? 0),
    0
  );

  const columns = binder.pocketColumns;
  const pockets: PocketRef[] = [];
  for (let row = 0; row < ROWS_PER_PAGE; row++) {
    for (let column = 0; column < columns; column++) {
      pockets.push({ pageIndex, row, column });
    }
  }

  return (
    <section
      className={styles.page}
      data-print="page"
      data-print-hidden={isPrintHidden ? "" : undefined}
    >
      <header className={styles.pageHeader} data-print="hide">
        <h2 className={styles.pageTitle}>Page {pageIndex + 1}</h2>
        <span className={styles.pageValue} title="Total market value of cards on this page">
          ${pageValue.toFixed(2)}
        </span>
        <div className={styles.pageButtons} data-print="hide">
          <button
            type="button"
            onClick={() => deletePage(pageIndex)}
            title="Delete this page"
            aria-label={`Delete page ${pageIndex + 1}`}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => addPageAfter(pageIndex)}
            title="Add a page after this one"
            aria-label={`Add a page after page ${pageIndex + 1}`}
          >
            +
          </button>
        </div>
      </header>
      <p className="print-only">
        Page {pageIndex + 1} cut guide: each pocket is {POCKET_WIDTH_MM} mm
        × {POCKET_HEIGHT_MM} mm
      </p>
      <div
        className={styles.pocketGrid}
        data-print="pocket-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {pockets.map((pocket) => (
          <PocketView
            key={pocketKey(pocket)}
            pocket={pocket}
            content={pocketContents.get(pocketKey(pocket)) ?? EMPTY_CONTENT}
            columns={columns}
          />
        ))}
      </div>
    </section>
  );
}

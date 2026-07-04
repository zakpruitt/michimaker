/**
 * Renders the binder as a vertical list of spreads, paired the way a real
 * binder opens: the first spread is the inside of the front cover (with the
 * editable binder title) facing page 1, then pages (2,3), (4,5), ... face
 * each other. Michi art crossing the center gutter only makes sense when
 * both facing pages are on screen together.
 *
 * When the last spread has a left page but no right one, an "add facing
 * page" placeholder fills the gap.
 */
import { useBinderActions, useBinderState } from "./BinderContext";
import { BinderCover } from "./BinderCover";
import { BinderPageView } from "./BinderPageView";
import styles from "./BinderSpread.module.css";

export function BinderSpreadList() {
  const { binder } = useBinderState();
  const { addPageAfter } = useBinderActions();

  // Left pages of the spreads after the cover spread: 1, 3, 5, ...
  const leftPageIndexes: number[] = [];
  for (let pageIndex = 1; pageIndex < binder.pages.length; pageIndex += 2) {
    leftPageIndexes.push(pageIndex);
  }

  return (
    <div className={styles.spreadList} data-print="binder-root">
      <div className={styles.spread} data-print="spread">
        <BinderCover />
        <div className={styles.gutter} data-print="hide" aria-hidden="true" />
        <BinderPageView pageIndex={0} />
      </div>

      {leftPageIndexes.map((leftPageIndex) => {
        const rightPageIndex = leftPageIndex + 1;
        const hasRightPage = rightPageIndex < binder.pages.length;

        return (
          <div key={leftPageIndex} className={styles.spread} data-print="spread">
            <BinderPageView pageIndex={leftPageIndex} />
            <div className={styles.gutter} data-print="hide" aria-hidden="true" />
            {hasRightPage ? (
              <BinderPageView pageIndex={rightPageIndex} />
            ) : (
              <div className={styles.missingPage} data-print="hide">
                <button
                  type="button"
                  className={styles.addMissingPage}
                  onClick={() => addPageAfter(leftPageIndex)}
                >
                  + Add facing page
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

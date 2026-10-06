import {useBinderActions, useBinderState} from "../state/BinderContext";
import {BinderCover} from "./BinderCover";
import {BinderPageView} from "./BinderPageView";
import styles from "./BinderSpread.module.css";

export function BinderSpreadList() {
    const {binder} = useBinderState();
    const {addPageAfter} = useBinderActions();

    const leftPageIndexes: number[] = [];
    for (let pageIndex = 1; pageIndex < binder.pages.length; pageIndex += 2) {
        leftPageIndexes.push(pageIndex);
    }

    return (
        <div className={styles.spreadList} data-pocket-columns={binder.pocketColumns}>
            <div className={styles.spread}>
                <BinderCover/>
                <div className={styles.gutter} aria-hidden="true"/>
                <BinderPageView pageIndex={0}/>
            </div>

            {leftPageIndexes.map((leftPageIndex) => {
                const rightPageIndex = leftPageIndex + 1;
                const hasRightPage = rightPageIndex < binder.pages.length;

                return (
                    <div key={leftPageIndex} className={styles.spread}>
                        <BinderPageView pageIndex={leftPageIndex}/>
                        <div className={styles.gutter} aria-hidden="true"/>
                        {hasRightPage ? (
                            <BinderPageView pageIndex={rightPageIndex}/>
                        ) : (
                            <div className={styles.missingPage}>
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

import type {CSSProperties} from "react";
import {POCKET_WIDTH_MM, type PocketContent, type PocketRef, ROWS_PER_PAGE} from "../../../types/binder";
import {formatUsd} from "../../../types/card";
import {useBinderActions, useBinderState} from "../state/BinderContext";
import {pocketKey} from "../state/gridMath";
import {PocketView} from "../pocket/PocketView";
import styles from "./BinderSpread.module.css";

interface BinderPageViewProps {
    pageIndex: number;
}

const EMPTY_CONTENT: PocketContent = {kind: "empty"};

export function BinderPageView({pageIndex}: BinderPageViewProps) {
    const {binder, pocketContents} = useBinderState();
    const {addPageAfter, deletePage} = useBinderActions();
    const page = binder.pages[pageIndex];
    let pageValue = 0;
    let neededValue = 0;
    let neededCount = 0;
    for (const card of page.pockets) {
        if (card === null) {
            continue;
        }
        pageValue += card.marketPrice ?? 0;
        if (card.owned !== true) {
            neededCount++;
            neededValue += card.marketPrice ?? 0;
        }
    }

    const columns = binder.pocketColumns;
    const pockets: PocketRef[] = [];
    for (let row = 0; row < ROWS_PER_PAGE; row++) {
        for (let column = 0; column < columns; column++) {
            pockets.push({pageIndex, row, column});
        }
    }

    return (
        <section className={styles.page}>
            <header className={styles.pageHeader}>
                <h2 className={styles.pageTitle}>Page {pageIndex + 1}</h2>
                <span
                    className={styles.pageValue}
                    title={
                        neededCount === 0
                            ? "Total market value of cards on this page"
                            : `Total market value; ${neededCount} card${neededCount === 1 ? "" : "s"} still needed (${formatUsd(neededValue)})`
                    }
                >
                    {formatUsd(pageValue)}
                    {neededCount > 0 && ` · ${neededCount} needed`}
                </span>
                <div className={styles.pageButtons}>
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
            <div
                className={styles.pocketGrid}
                style={{
                    "--pocket-columns": columns,
                    "--gap-x-ratio": binder.pocketGap.xMm / POCKET_WIDTH_MM,
                    "--gap-y-ratio": binder.pocketGap.yMm / POCKET_WIDTH_MM,
                } as CSSProperties}
            >
                {pockets.map((pocket) => (
                    <PocketView
                        key={pocketKey(pocket)}
                        pocket={pocket}
                        content={pocketContents.get(pocketKey(pocket)) ?? EMPTY_CONTENT}
                        pocketGap={binder.pocketGap}
                    />
                ))}
            </div>
        </section>
    );
}

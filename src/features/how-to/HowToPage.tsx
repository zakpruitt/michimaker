import {GITHUB_REPO_URL} from "../../appLinks";
import {POCKET_HEIGHT_MM, POCKET_WIDTH_MM} from "../../types/binder";
import styles from "./HowToPage.module.css";

export function HowToPage() {
    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <a className={styles.backLink} href="#">
                    ← Back to the planner
                </a>
                <h1 className={styles.title}>How to use MichiMaker</h1>
                <p className={styles.intro}>
                    MichiMaker plans a real 9- or 12-pocket binder: cards from the
                    Pokémon TCG library, plus "Michi method" fan-art spreads where one
                    image is printed, cut into pocket-sized pieces, and slid across
                    several pockets. Five steps from empty binder to printed art.
                </p>
            </header>

            <section className={styles.step}>
                <h2 className={styles.stepTitle}>
                    <span className={styles.stepNumber}>1</span> Build your binder
                </h2>
                <p>
                    Opening the cover shows page 1 on the right, facing the inside of
                    the front cover, where you can click the title to name your binder.
                    Every flip after that shows two facing pages. Use the
                    <strong> +</strong> and <strong>−</strong> buttons in each page
                    header to add a page after it or delete it. The header also shows
                    the total market value of the cards on that page. The
                    <strong> 9 / 12</strong> toggle in the toolbar switches between
                    9-pocket and 12-pocket pages; anything that no longer fits (a
                    fourth-column card when narrowing, for example) is removed with a
                    notice.
                </p>
            </section>

            <section className={styles.step}>
                <h2 className={styles.stepTitle}>
                    <span className={styles.stepNumber}>2</span> Add cards
                </h2>
                <p>
                    Open the <strong>Cards</strong> tab and search by card name, set
                    code, or card number, then narrow the results by language, rarity,
                    or type. Click a pocket in the binder, then click a result to place
                    it there, or simply drag a result onto any pocket. Hover a placed
                    card to see its market price.
                </p>
            </section>

            <section className={styles.step}>
                <h2 className={styles.stepTitle}>
                    <span className={styles.stepNumber}>3</span> Plan an art span
                </h2>
                <p>
                    Drag across empty pockets, spreadsheet-style, to select a
                    rectangular region. It can cross the middle of a spread, which is
                    how classic Michi art flows over both facing pages. Then open the
                    <strong> Art</strong> tab and click a piece (or upload your own,
                    which never leaves your browser) to fill the region. Click any part
                    of placed art to select the whole span; <strong>Remove</strong>
                    {" "}deletes it.
                </p>
                <figure className={styles.figure} aria-hidden="true">
                    <div className={styles.mockSpread}>
                        {/* left page */}
                        <div className={styles.mockGrid}>
                            {Array.from({length: 9}, (_, i) => (
                                <div
                                    key={i}
                                    className={
                                        i % 3 === 2 ? styles.mockPocketSelected : styles.mockPocket
                                    }
                                />
                            ))}
                        </div>
                        <div className={styles.mockGutter}/>
                        {/* right page */}
                        <div className={styles.mockGrid}>
                            {Array.from({length: 9}, (_, i) => (
                                <div
                                    key={i}
                                    className={
                                        i % 3 === 0 ? styles.mockPocketSelected : styles.mockPocket
                                    }
                                />
                            ))}
                        </div>
                    </div>
                    <figcaption className={styles.caption}>
                        A 3×2 selection crossing the spread gutter, ready for one image.
                    </figcaption>
                </figure>
            </section>

            <section className={styles.step}>
                <h2 className={styles.stepTitle}>
                    <span className={styles.stepNumber}>4</span> Save and share
                </h2>
                <p>
                    Everything auto-saves in your browser, including the binder title
                    on the inside of the front cover (click it to rename your binder).
                    <strong> Share</strong> packs the whole binder into a URL anyone
                    can open; <strong>Export</strong> and <strong>Import</strong> move
                    it as a .json file (the safer option for binders with big uploaded
                    images).
                </p>
            </section>

            <section className={styles.step}>
                <h2 className={styles.stepTitle}>
                    <span className={styles.stepNumber}>5</span> Print the cut guide
                </h2>
                <p>
                    <strong>Print</strong> opens the print options: pick which
                    pages to print, or switch to <strong>art only</strong> to pack just
                    the art pieces onto as few sheets as possible and save ink. By
                    default, side-by-side art on the same page prints as one connected
                    strip; rows and gutter crossings always get cut lines.
                </p>
                <p>
                    Every pocket prints at exactly {POCKET_WIDTH_MM} mm ×{" "}
                    {POCKET_HEIGHT_MM} mm, so print at <strong>100% scale</strong> (turn
                    off "fit to page"), cut along the dashed lines, and the pieces slide
                    straight into real pockets.
                </p>
                <figure className={styles.figure} aria-hidden="true">
                    <div className={styles.mockStrip}>
                        <div className={styles.mockStripCell}/>
                        <div className={styles.mockStripCell}/>
                        <div className={styles.mockStripCell}/>
                    </div>
                    <figcaption className={styles.caption}>
                        A connected 1×3 strip: one outer cut line, nothing between the
                        pockets.
                    </figcaption>
                </figure>
            </section>

            <footer className={styles.footer}>
                <a href="#">← Back to the planner</a>
                <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
                    GitHub
                </a>
            </footer>
        </div>
    );
}

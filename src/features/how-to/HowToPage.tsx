import {GITHUB_REPO_URL} from "../../appLinks";
import {DEFAULT_POCKET_GAP, POCKET_HEIGHT_MM, POCKET_WIDTH_MM} from "../../types/binder";
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
                    several pockets. Five steps from empty binder to printed art and proxies.
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
                    Drag across pockets, spreadsheet-style, to select a
                    rectangular region. It can cross the middle of a spread, which is
                    how classic Michi art flows over both facing pages. Then open the
                    <strong> Art</strong> tab and click a piece (or upload your own,
                    which never leaves your browser) to fill the region. Click any part
                    of placed art to select the whole span; <strong>Remove</strong>
                    {" "}deletes it.
                </p>
                <p>
                    A placed piece starts centered and cropped to fill its span. Hit
                    {" "}<strong>Adjust framing</strong> to open a preview with the pocket
                    cuts drawn on top, then drag the picture to reposition it and zoom in
                    or out until the part you want lands where you want it. The framing
                    is saved with the placement, so the binder preview, share links, and
                    printed sheets all match.
                </p>
                <p>
                    Cards and art share the same pockets. Drop a card into any pocket
                    inside a span and it sits on top: the picture keeps its full
                    rectangle, so it stays centered and lined up, and the card simply
                    punches a hole out of it. That is how you get a shape like the top
                    row plus two pockets of the middle row, with a card filling the
                    rest. Pull the card back out and the art underneath reappears.
                    Printing skips the hidden slices, so no ink goes on paper you will
                    never see.
                </p>
                <figure className={styles.figure} aria-hidden="true">
                    <div className={styles.mockSpread}>
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
                    <span className={styles.stepNumber}>5</span> Print, cut, and slot it in
                </h2>
                <p>
                    <strong>Print &amp; export</strong> (or Ctrl+P) makes three kinds of sheets
                    on US Letter or A4, with a live preview:
                </p>
                <ul>
                    <li>
                        <strong>Michi art cut-outs</strong>: just the art, packed onto as few
                        sheets as possible. Pockets in a real binder have a welded seam
                        between them (about {DEFAULT_POCKET_GAP.xMm} mm), so the art is laid
                        out across the seams and each piece is cropped from where its
                        pocket sits. The picture stays continuous in the binder. Set the gap
                        to match your pages, or 0 to slice edge to edge.
                    </li>
                    <li>
                        <strong>Proxy cards</strong>: card-sized placeholders, 9 to a sheet,
                        for the cards you still need. Select a card and press{" "}
                        <strong>O</strong> (or "Mark as owned") once you have the real one,
                        and it gets a green ✓ and is skipped.
                    </li>
                    <li>
                        <strong>Whole binder pages</strong>: each page as a full layout guide.
                    </li>
                </ul>
                <p>
                    <strong>Print / Save PDF</strong> prints at exact size. Every pocket is{" "}
                    {POCKET_WIDTH_MM} mm × {POCKET_HEIGHT_MM} mm, so print at{" "}
                    <strong>100% scale</strong> (turn off "fit to page"). Matte photo paper
                    or ~300 gsm cardstock feels closest to a real card. Cut on the dashed
                    lines; a paper trimmer and a corner rounder give the cleanest result.
                </p>
                <p>
                    <strong>Download images</strong> gives a .zip of 300 DPI PNGs: the
                    printable sheets, every piece on its own (order them as 2.5" × 3.5"
                    wallet prints), and the full art with your framing applied, sized in
                    millimetres for a Canva custom-size design.
                </p>
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

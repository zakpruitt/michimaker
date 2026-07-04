/**
 * What phones and tablets see instead of the planner: a small showcase of
 * what the app does, with a pure-CSS mock of a Michi-method spread (no image
 * downloads), and a note that planning itself needs a desktop browser.
 */
import { GITHUB_REPO_URL } from "../../appLinks";
import { POCKET_HEIGHT_MM, POCKET_WIDTH_MM } from "../../types/binder";
import styles from "./MobileLandingPage.module.css";

/** Mock spread: 3 rows × 7 grid columns (3 pockets, gutter, 3 pockets). */
const POCKET_CELLS: Array<{ row: number; gridColumn: number; hasCard: boolean }> = [];
for (let row = 1; row <= 3; row++) {
  for (const gridColumn of [1, 2, 3, 5, 6, 7]) {
    // Columns 3 and 5 of the middle rows sit under the mock art span.
    const isUnderArt = gridColumn === 3 || gridColumn === 5;
    POCKET_CELLS.push({ row, gridColumn, hasCard: !isUnderArt && (row + gridColumn) % 2 === 0 });
  }
}

export function MobileLandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>MichiMaker</h1>
        <p className={styles.tagline}>
          Lay out 9- and 12-pocket binder pages, cards and “Michi method”
          fan-art spreads alike, before you print, cut, or buy anything.
        </p>
      </header>

      <div className={styles.mockSpread} aria-hidden="true">
        {POCKET_CELLS.map((cell) => (
          <div
            key={`${cell.row}-${cell.gridColumn}`}
            className={cell.hasCard ? `${styles.mockPocket} ${styles.mockCard}` : styles.mockPocket}
            style={{ gridRow: cell.row, gridColumn: cell.gridColumn }}
          />
        ))}
        <div className={styles.mockGutter} />
        {/* One art piece crossing the center gutter, cut lines included. */}
        <div className={styles.mockArt}>
          <span className={styles.mockArtLabel}>3×2 art span</span>
        </div>
      </div>

      <ul className={styles.featureList}>
        <li>
          <strong>Plan real spreads</strong>: pages render two-up, exactly like
          your open binder.
        </li>
        <li>
          <strong>Search every card</strong>: name, set, and number search
          backed by PokeWallet, with market prices and language filters.
        </li>
        <li>
          <strong>Michi method art</strong>: stretch one image across any block
          of pockets, even across the center gutter.
        </li>
        <li>
          <strong>Print a cut guide</strong>: every pocket at a true{" "}
          {POCKET_WIDTH_MM} mm × {POCKET_HEIGHT_MM} mm with dashed lines
          showing exactly where to cut.
        </li>
        <li>
          <strong>Share with a link</strong>: your whole binder compressed into
          a URL. No accounts, nothing leaves the browser.
        </li>
      </ul>

      <div className={styles.desktopNote}>
        <p>
          <strong>The planner needs a desktop browser</strong>: laying out art
          spans is built around mouse drag-selection. Open this page on a
          computer to start planning.
        </p>
      </div>

      <footer className={styles.footer}>
        <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
          View on GitHub
        </a>
      </footer>
    </div>
  );
}

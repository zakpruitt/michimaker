import styles from "./Pager.module.css";

interface PagerProps {
    page: number;
    pageCount: number;
    onPageChange: (page: number) => void;
}

export function Pager({page, pageCount, onPageChange}: PagerProps) {
    if (pageCount <= 1) {
        return null;
    }
    return (
        <div className={styles.pager}>
            <button
                type="button"
                className={styles.arrow}
                disabled={page === 0}
                onClick={() => onPageChange(page - 1)}
                aria-label="Previous page"
            >
                ◀
            </button>
            <span className={styles.label}>
        {page + 1} / {pageCount}
      </span>
            <button
                type="button"
                className={styles.arrow}
                disabled={page >= pageCount - 1}
                onClick={() => onPageChange(page + 1)}
                aria-label="Next page"
            >
                ▶
            </button>
        </div>
    );
}

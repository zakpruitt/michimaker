import {useNotices} from "./NoticeContext";
import styles from "./NoticeList.module.css";

export function NoticeList() {
    const {notices, dismissNotice} = useNotices();

    if (notices.length === 0) {
        return null;
    }

    return (
        <div className={styles.stack} data-print="hide">
            {notices.map((notice) => (
                <div key={notice.id} className={`${styles.notice} ${styles[notice.kind]}`} role="status">
                    <span className={styles.message}>{notice.message}</span>
                    <button
                        type="button"
                        className={styles.dismiss}
                        onClick={() => dismissNotice(notice.id)}
                        aria-label="Dismiss notification"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}

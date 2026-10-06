import {useNoticeList, useNotices} from "./NoticeContext";
import styles from "./NoticeList.module.css";

export function NoticeList() {
    const notices = useNoticeList();
    const {dismissNotice} = useNotices();

    if (notices.length === 0) {
        return null;
    }

    return (
        <div className={styles.stack}>
            {notices.map((notice) => (
                <div key={notice.id} className={`${styles.notice} ${styles[notice.kind]}`} role="status">
                    <span className={styles.message}>{notice.message}</span>
                    {notice.action !== null && (
                        <button
                            type="button"
                            className={styles.action}
                            onClick={() => {
                                notice.action?.onAction();
                                dismissNotice(notice.id);
                            }}
                        >
                            {notice.action.label}
                        </button>
                    )}
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

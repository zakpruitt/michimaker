import {type ReactNode, useEffect} from "react";
import styles from "./Modal.module.css";

interface ModalProps {
    title: string;
    onClose: () => void;
    canClose?: boolean;
    className?: string;
    children: ReactNode;
}

export function Modal({title, onClose, canClose = true, className, children}: ModalProps) {
    useEffect(() => {
        if (!canClose) {
            return;
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                event.stopPropagation();
                onClose();
            }
        }

        window.addEventListener("keydown", handleKeyDown, true);
        return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, [onClose, canClose]);

    return (
        <div className={styles.overlay} onClick={canClose ? onClose : undefined}>
            <div
                className={className === undefined ? styles.dialog : `${styles.dialog} ${className}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(event) => event.stopPropagation()}
            >
                <h2 className={styles.title}>{title}</h2>
                {children}
            </div>
        </div>
    );
}

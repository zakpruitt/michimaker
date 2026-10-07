import {MAX_PROXY_COPIES, type ProxyCandidate} from "./printLayout";
import styles from "./ProxyCopiesList.module.css";

interface ProxyCopiesListProps {
    candidates: ProxyCandidate[];
    copiesFor: (candidate: ProxyCandidate) => number;
    onAdjust: (candidate: ProxyCandidate, delta: number) => void;
}

export function ProxyCopiesList({candidates, copiesFor, onAdjust}: ProxyCopiesListProps) {
    if (candidates.length === 0) {
        return <p className={styles.empty}>No cards on the selected pages yet.</p>;
    }
    return (
        <ul className={styles.list}>
            {candidates.map((candidate) => {
                const {card} = candidate;
                const copies = copiesFor(candidate);
                return (
                    <li key={card.id} className={copies === 0 ? `${styles.row} ${styles.skipped}` : styles.row}>
                        <img className={styles.thumbnail} src={card.smallImageUrl} alt="" loading="lazy"/>
                        <span className={styles.details}>
                            <strong title={card.name}>{card.name}</strong>
                            <small>{describe(candidate)}</small>
                        </span>
                        <span className={styles.stepper} role="group" aria-label={`Proxies of ${card.name}`}>
                            <button
                                type="button"
                                onClick={() => onAdjust(candidate, -1)}
                                disabled={copies === 0}
                                aria-label={`One fewer ${card.name}`}
                            >
                                −
                            </button>
                            <output aria-live="polite">{copies}</output>
                            <button
                                type="button"
                                onClick={() => onAdjust(candidate, 1)}
                                disabled={copies >= MAX_PROXY_COPIES}
                                aria-label={`One more ${card.name}`}
                            >
                                +
                            </button>
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

function describe({card, pageIndex, pocketCount, neededCount}: ProxyCandidate): string {
    const parts = [card.setName !== "" ? card.setName : null, `page ${pageIndex + 1}`];
    if (pocketCount > 1) {
        parts.push(`${pocketCount} pockets`);
    }
    if (neededCount === 0) {
        parts.push("owned");
    } else if (neededCount < pocketCount) {
        parts.push(`${pocketCount - neededCount} owned`);
    }
    return parts.filter((part) => part !== null).join(" · ");
}

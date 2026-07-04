/**
 * The inside of the front cover: the left half of the first spread, facing
 * page 1 the way a real binder opens. Holds the editable binder title
 * (e.g. "Zak's Michi Binder"), which persists with the binder and travels in
 * share links and exports.
 */
import { useBinderActions, useBinderState } from "./BinderContext";
import styles from "./BinderSpread.module.css";

export function BinderCover() {
  const { binder } = useBinderState();
  const { setBinderTitle } = useBinderActions();

  return (
    <div className={styles.cover} data-print="hide">
      <div className={styles.coverInner}>
        <input
          type="text"
          className={styles.coverTitleInput}
          value={binder.title}
          onChange={(event) => setBinderTitle(event.target.value)}
          placeholder="Name your binder"
          aria-label="Binder title"
          maxLength={60}
          spellCheck={false}
        />
        <div className={styles.coverRule} aria-hidden="true" />
        <span className={styles.coverHint}>click the title to edit</span>
      </div>
    </div>
  );
}

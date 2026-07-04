/**
 * Swaps the printed @page orientation to A4 landscape for 12-pocket pages.
 * Rendering a <style> tag is the one reliable way to change an @page rule,
 * since CSS cannot vary it from a body class.
 */
import { useBinderState } from "../binder/BinderContext";

export function PrintPageSetup() {
  const { binder } = useBinderState();
  if (binder.pocketColumns !== 4) {
    return null;
  }
  return <style>{"@media print { @page { size: A4 landscape; } }"}</style>;
}

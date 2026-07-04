/**
 * Keeps the printed page orientation in step with the binder layout:
 * 9-pocket pages (189mm rows) print portrait, 12-pocket pages (252mm rows)
 * only fit A4 sideways. Rendering a <style> tag is the one reliable way to
 * swap the @page rule, since CSS cannot vary it from a body class.
 */
import { useBinderState } from "../binder/BinderContext";

export function PrintPageSetup() {
  const { binder } = useBinderState();
  if (binder.pocketColumns !== 4) {
    return null;
  }
  return <style>{"@media print { @page { size: A4 landscape; } }"}</style>;
}

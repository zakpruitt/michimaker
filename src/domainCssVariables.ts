/**
 * Bridges the domain constants in types/binder.ts into CSS custom properties
 * on the document root, so stylesheets (notably the printable cut guide in
 * features/print/print.css and the pocket aspect ratio) derive from the same
 * single source of truth as the TypeScript span math: change the pocket
 * size in one place and screen, print, and crop math all stay in sync.
 *
 * The static sizes install once at boot; the per-binder column count (9- vs
 * 12-pocket pages) is applied by BinderProvider whenever it changes.
 */
import {
  DEFAULT_POCKET_COLUMNS,
  POCKET_HEIGHT_MM,
  POCKET_WIDTH_MM,
  type PocketColumns,
} from "./types/binder";

export function installDomainCssVariables(): void {
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--pocket-width", `${POCKET_WIDTH_MM}mm`);
  rootStyle.setProperty("--pocket-height", `${POCKET_HEIGHT_MM}mm`);
  rootStyle.setProperty("--pocket-aspect-ratio", `${POCKET_WIDTH_MM} / ${POCKET_HEIGHT_MM}`);
  applyPocketColumnsCssVariables(DEFAULT_POCKET_COLUMNS);
}

/** Pre-built because CSS cannot take a var() as a repeat() count. */
export function applyPocketColumnsCssVariables(columns: PocketColumns): void {
  document.documentElement.style.setProperty(
    "--print-pocket-grid-columns",
    `repeat(${columns}, ${POCKET_WIDTH_MM}mm)`
  );
}

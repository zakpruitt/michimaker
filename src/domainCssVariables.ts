import {POCKET_HEIGHT_MM, POCKET_WIDTH_MM} from "./types/binder";

export function installDomainCssVariables(): void {
    document.documentElement.style.setProperty("--pocket-aspect-ratio", `${POCKET_WIDTH_MM} / ${POCKET_HEIGHT_MM}`);
}

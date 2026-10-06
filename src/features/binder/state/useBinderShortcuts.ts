import {useEffect} from "react";
import type {BinderActions} from "./BinderContext";

export function useBinderShortcuts(actions: BinderActions): void {
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                actions.clearSelection();
                return;
            }
            if (isEditableTarget(event.target) || event.altKey) {
                return;
            }
            const key = event.key.toLowerCase();
            const withModifier = event.ctrlKey || event.metaKey;
            if (withModifier && (key === "z" || key === "y")) {
                event.preventDefault();
                if (key === "y" || event.shiftKey) {
                    actions.redo();
                } else {
                    actions.undo();
                }
            } else if (!withModifier && (key === "delete" || key === "backspace")) {
                event.preventDefault();
                actions.removeSelectionContent();
            } else if (!withModifier && key === "o") {
                actions.toggleSelectedCardOwned();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [actions]);
}

function isEditableTarget(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    );
}

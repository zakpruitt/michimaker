import type {KeyboardEvent} from "react";

export function activateOnEnterOrSpace(action: () => void): (event: KeyboardEvent) => void {
    return (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            action();
        }
    };
}

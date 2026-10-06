import type {Binder} from "../../../types/binder";
import {type BinderAction, binderReducer} from "./binderReducer";

const HISTORY_LIMIT = 100;

const UNTRACKED_ACTIONS: ReadonlySet<BinderAction["type"]> = new Set(["SET_CARD_IMAGES"]);

const COALESCED_ACTIONS: ReadonlySet<BinderAction["type"]> = new Set(["SET_TITLE", "SET_POCKET_GAP"]);

export interface BinderHistory {
    past: Binder[];
    present: Binder;
    future: Binder[];
    lastActionType: BinderAction["type"] | null;
}

export type BinderHistoryAction = BinderAction | {type: "UNDO"} | {type: "REDO"};

export function createBinderHistory(present: Binder, past: Binder[] = []): BinderHistory {
    return {past, present, future: [], lastActionType: null};
}

export function binderHistoryReducer(history: BinderHistory, action: BinderHistoryAction): BinderHistory {
    switch (action.type) {
        case "UNDO": {
            const previous = history.past.at(-1);
            if (previous === undefined) {
                return history;
            }
            return {
                past: history.past.slice(0, -1),
                present: previous,
                future: [history.present, ...history.future],
                lastActionType: null,
            };
        }

        case "REDO": {
            const [next, ...future] = history.future;
            if (next === undefined) {
                return history;
            }
            return {
                past: [...history.past, history.present],
                present: next,
                future,
                lastActionType: null,
            };
        }

        default: {
            const present = binderReducer(history.present, action);
            if (present === history.present) {
                return history;
            }
            const replacesLastStep =
                UNTRACKED_ACTIONS.has(action.type) ||
                (COALESCED_ACTIONS.has(action.type) && history.lastActionType === action.type);
            if (replacesLastStep) {
                return {...history, present};
            }
            return {
                past: [...history.past, history.present].slice(-HISTORY_LIMIT),
                present,
                future: [],
                lastActionType: action.type,
            };
        }
    }
}

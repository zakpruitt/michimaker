import type {Binder} from "../../types/binder";
import {envelopeToJson, parseBinderJson} from "./binderCodec";

export function downloadBinderAsFile(binder: Binder): void {
    const blob = new Blob([envelopeToJson(binder, true)], {type: "application/json"});
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `pokemon-binder-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();

    URL.revokeObjectURL(objectUrl);
}

/** Resolves to the parsed binder, or rejects with BinderDecodeError. */
export async function readBinderFromFile(file: File): Promise<Binder> {
    const json = await file.text();
    return parseBinderJson(json);
}

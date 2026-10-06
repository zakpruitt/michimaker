import {slugify} from "../../text";
import type {Binder} from "../../types/binder";
import {envelopeToJson, parseBinderJson} from "./binderCodec";

export function downloadBinderAsFile(binder: Binder): void {
    const blob = new Blob([envelopeToJson(binder, true)], {type: "application/json"});
    downloadBlob(blob, `${slugify(binder.title, "pokemon-binder")}-${new Date().toISOString().slice(0, 10)}.json`);
}

export function downloadBlob(blob: Blob, fileName: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export async function readBinderFromFile(file: File): Promise<Binder> {
    const json = await file.text();
    return parseBinderJson(json);
}

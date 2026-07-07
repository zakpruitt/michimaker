/** Reads a Blob (or File) into a data: URL. */
export function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("The file could not be read."));
        reader.readAsDataURL(blob);
    });
}

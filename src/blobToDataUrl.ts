export async function urlToDataUrl(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`The image could not be downloaded (HTTP ${response.status}).`);
    }
    return blobToDataUrl(await response.blob());
}

export function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("The file could not be read."));
        reader.readAsDataURL(blob);
    });
}

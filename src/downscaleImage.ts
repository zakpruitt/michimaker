import {blobToDataUrl} from "./blobToDataUrl";

const MAX_EDGE_PX = 2400;
const WEBP_QUALITY = 0.85;

function loadBitmap(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("The image could not be decoded."));
        };
        image.src = objectUrl;
    });
}

export async function downscaleImageToDataUrl(blob: Blob): Promise<string> {
    if (blob.type === "image/gif" || blob.type === "image/svg+xml") {
        return blobToDataUrl(blob);
    }

    const image = await loadBitmap(blob);
    const {naturalWidth: width, naturalHeight: height} = image;
    if (width === 0 || height === 0) {
        throw new Error("The image could not be decoded.");
    }

    const scale = Math.min(1, MAX_EDGE_PX / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (context === null) {
        return blobToDataUrl(blob);
    }
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const dataUrl = canvas.toDataURL("image/webp", WEBP_QUALITY);
    if (!dataUrl.startsWith("data:image/webp")) {
        return canvas.toDataURL("image/jpeg", WEBP_QUALITY);
    }
    return dataUrl;
}

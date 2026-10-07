import {resolveArtImageUrl} from "../../artImageUrl";
import {
    type ArtPlacement,
    artCellOffsetMm,
    artSpanSizeMm,
    POCKET_HEIGHT_MM,
    POCKET_WIDTH_MM,
    type PocketGap,
} from "../../types/binder";
import {type ArtBox, artImageRectMm} from "../binder/pocket/artSpanStyle";
import {type ArtFill, blockSizeMm, cellOriginMm, type PrintCell, type PrintLayout, type PrintSheet} from "./printLayout";

const EXPORT_DPI = 300;

const MM_PER_INCH = 25.4;
const CUT_LINE_MM = 0.3;
const CUT_DASH_MM = 1.6;
const EMPTY_POCKET_LINE_MM = 0.25;

type Images = Map<string, HTMLImageElement | null>;

export class ImageLoader {
    private readonly images: Images = new Map();
    readonly failedNames = new Set<string>();

    async preload(cells: PrintCell[]): Promise<void> {
        await Promise.all(cells.map((cell) => this.load(cellImage(cell))));
    }

    async load(source: {url: string; name: string} | null): Promise<void> {
        if (source === null || this.images.has(source.url)) {
            return;
        }
        this.images.set(source.url, null);
        const image = await loadImage(source.url);
        this.images.set(source.url, image);
        if (image === null) {
            this.failedNames.add(source.name);
        }
    }

    get(url: string): HTMLImageElement | null {
        return this.images.get(url) ?? null;
    }
}

export async function renderSheetPng(layout: PrintLayout, sheet: PrintSheet, images: ImageLoader): Promise<Uint8Array> {
    const scale = EXPORT_DPI / MM_PER_INCH;
    const canvas = createCanvas(layout.pageWidthMm * scale, layout.pageHeightMm * scale);
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(scale, scale);
    context.translate(layout.marginMm, layout.marginMm);

    const gap = layout.pocketGap;
    for (const {piece, xMm, yMm} of sheet.pieces) {
        const labelHeight = piece.label === null ? 0 : layout.labelHeightMm;
        const block = blockSizeMm(piece, gap);
        if (piece.label !== null) {
            drawLabel(context, piece.label, xMm, yMm + labelHeight - 0.8, block.widthMm);
        }
        const blockY = yMm + labelHeight;
        if (piece.artFill !== null) {
            drawArtFill(context, piece.artFill, gap, images, xMm, blockY, block.widthMm, block.heightMm);
        }
        piece.cells.forEach((cell, index) => {
            const origin = cellOriginMm(piece, index, gap);
            const cellX = xMm + origin.xMm;
            const cellY = blockY + origin.yMm;
            if (cell === null) {
                if (piece.artFill !== null) {
                    context.fillStyle = "#fff";
                    context.fillRect(cellX, cellY, POCKET_WIDTH_MM, POCKET_HEIGHT_MM);
                }
            } else if (piece.artFill !== null && cell.content.kind === "art") {
                drawCutLines(context, cell, cellX, cellY);
            } else {
                drawCell(context, cell, cellX, cellY, gap, images, layout.grayscaleCards);
            }
        });
    }
    return canvasToPng(canvas);
}

export async function renderCellPng(
    cell: PrintCell,
    pocketGap: PocketGap,
    images: ImageLoader,
    grayscale: boolean
): Promise<Uint8Array> {
    const scale = EXPORT_DPI / MM_PER_INCH;
    const canvas = createCanvas(POCKET_WIDTH_MM * scale, POCKET_HEIGHT_MM * scale);
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(scale, scale);
    const uncut = {...cell, cut: {top: false, right: false, bottom: false, left: false}};
    drawCell(context, uncut, 0, 0, pocketGap, images, grayscale);
    return canvasToPng(canvas);
}

export async function renderArtSpanPng(
    placement: ArtPlacement,
    pocketGap: PocketGap,
    images: ImageLoader
): Promise<Uint8Array | null> {
    const url = resolveArtImageUrl(placement.art);
    await images.load({url, name: placement.art.title});
    const image = images.get(url);
    if (image === null) {
        return null;
    }
    const span = artSpanSizeMm(placement.rect, pocketGap);
    const scale = EXPORT_DPI / MM_PER_INCH;
    const canvas = createCanvas(span.widthMm * scale, span.heightMm * scale);
    const context = canvas.getContext("2d")!;
    context.scale(scale, scale);
    const rect = artImageRectMm(placement, placement.crop, pocketGap, image.naturalWidth / image.naturalHeight);
    context.drawImage(image, rect.xMm, rect.yMm, rect.widthMm, rect.heightMm);
    return canvasToPng(canvas);
}

function drawArtFill(
    context: CanvasRenderingContext2D,
    fill: ArtFill,
    gap: PocketGap,
    images: ImageLoader,
    xMm: number,
    yMm: number,
    widthMm: number,
    heightMm: number
): void {
    const url = resolveArtImageUrl(fill.placement.art);
    const image = images.get(url);
    const box: ArtBox = {...artCellOffsetMm(fill.rowOffset, fill.columnOffset, gap), widthMm, heightMm};
    context.save();
    context.beginPath();
    context.rect(xMm, yMm, box.widthMm, box.heightMm);
    context.clip();
    if (image === null) {
        drawMissing(context, fill.placement.art.title, xMm, yMm);
    } else {
        const rect = artImageRectMm(fill.placement, fill.placement.crop, gap, image.naturalWidth / image.naturalHeight);
        context.drawImage(image, xMm + rect.xMm - box.leftMm, yMm + rect.yMm - box.topMm, rect.widthMm, rect.heightMm);
    }
    context.restore();
}

function cellImage(cell: PrintCell): {url: string; name: string} | null {
    switch (cell.content.kind) {
        case "card":
            return {url: cell.content.card.smallImageUrl, name: cell.content.card.name};
        case "art":
            return {url: resolveArtImageUrl(cell.content.placement.art), name: cell.content.placement.art.title};
        case "empty":
            return null;
    }
}

function drawCell(
    context: CanvasRenderingContext2D,
    cell: PrintCell,
    xMm: number,
    yMm: number,
    pocketGap: PocketGap,
    images: ImageLoader,
    grayscale: boolean
): void {
    const {content} = cell;
    const source = cellImage(cell);
    if (source === null) {
        drawEmptyPocket(context, xMm, yMm);
        return;
    }

    context.save();
    context.beginPath();
    context.rect(xMm, yMm, POCKET_WIDTH_MM, POCKET_HEIGHT_MM);
    context.clip();

    const image = images.get(source.url);
    if (image === null) {
        drawMissing(context, source.name, xMm, yMm);
    } else if (content.kind === "card") {
        drawCover(context, image, xMm, yMm);
        if (grayscale) {
            desaturate(context, xMm, yMm, POCKET_WIDTH_MM, POCKET_HEIGHT_MM);
        }
    } else if (content.kind === "art") {
        const rect = artImageRectMm(
            content.placement,
            content.placement.crop,
            pocketGap,
            image.naturalWidth / image.naturalHeight
        );
        const offset = artCellOffsetMm(content.rowOffset, content.columnOffset, pocketGap);
        context.drawImage(
            image,
            xMm + rect.xMm - offset.leftMm,
            yMm + rect.yMm - offset.topMm,
            rect.widthMm,
            rect.heightMm
        );
    }
    context.restore();
    drawCutLines(context, cell, xMm, yMm);
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, xMm: number, yMm: number): void {
    const imageRatio = image.naturalWidth / image.naturalHeight;
    const pocketRatio = POCKET_WIDTH_MM / POCKET_HEIGHT_MM;
    const width = imageRatio > pocketRatio ? POCKET_HEIGHT_MM * imageRatio : POCKET_WIDTH_MM;
    const height = imageRatio > pocketRatio ? POCKET_HEIGHT_MM : POCKET_WIDTH_MM / imageRatio;
    context.drawImage(
        image,
        xMm + (POCKET_WIDTH_MM - width) / 2,
        yMm + (POCKET_HEIGHT_MM - height) / 2,
        width,
        height
    );
}

function desaturate(context: CanvasRenderingContext2D, xMm: number, yMm: number, widthMm: number, heightMm: number): void {
    const transform = context.getTransform();
    const x = Math.round(transform.a * xMm + transform.e);
    const y = Math.round(transform.d * yMm + transform.f);
    const width = Math.round(transform.a * widthMm);
    const height = Math.round(transform.d * heightMm);
    const pixels = context.getImageData(x, y, width, height);
    const data = pixels.data;
    for (let index = 0; index < data.length; index += 4) {
        const luminance = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
        data[index] = luminance;
        data[index + 1] = luminance;
        data[index + 2] = luminance;
    }
    context.putImageData(pixels, x, y);
}

function drawMissing(context: CanvasRenderingContext2D, name: string, xMm: number, yMm: number): void {
    context.fillStyle = "#eef2f6";
    context.fillRect(xMm, yMm, POCKET_WIDTH_MM, POCKET_HEIGHT_MM);
    context.fillStyle = "#5b6b7b";
    context.font = "3px sans-serif";
    context.textAlign = "center";
    context.fillText(name.slice(0, 28), xMm + POCKET_WIDTH_MM / 2, yMm + POCKET_HEIGHT_MM / 2, POCKET_WIDTH_MM - 4);
    context.textAlign = "start";
}

function drawCutLines(context: CanvasRenderingContext2D, cell: PrintCell, xMm: number, yMm: number): void {
    const right = xMm + POCKET_WIDTH_MM;
    const bottom = yMm + POCKET_HEIGHT_MM;
    const inset = CUT_LINE_MM / 2;
    const edges: [boolean, number, number, number, number][] = [
        [cell.cut.top, xMm, yMm + inset, right, yMm + inset],
        [cell.cut.bottom, xMm, bottom - inset, right, bottom - inset],
        [cell.cut.left, xMm + inset, yMm, xMm + inset, bottom],
        [cell.cut.right, right - inset, yMm, right - inset, bottom],
    ];
    context.save();
    context.strokeStyle = "#000";
    context.lineWidth = CUT_LINE_MM;
    context.setLineDash([CUT_DASH_MM, CUT_DASH_MM]);
    for (const [isCut, x1, y1, x2, y2] of edges) {
        if (isCut) {
            context.beginPath();
            context.moveTo(x1, y1);
            context.lineTo(x2, y2);
            context.stroke();
        }
    }
    context.restore();
}

function drawEmptyPocket(context: CanvasRenderingContext2D, xMm: number, yMm: number): void {
    const inset = EMPTY_POCKET_LINE_MM / 2;
    context.save();
    context.strokeStyle = "#b8b8b8";
    context.lineWidth = EMPTY_POCKET_LINE_MM;
    context.setLineDash([CUT_DASH_MM, CUT_DASH_MM]);
    context.strokeRect(xMm + inset, yMm + inset, POCKET_WIDTH_MM - 2 * inset, POCKET_HEIGHT_MM - 2 * inset);
    context.restore();
}

function drawLabel(context: CanvasRenderingContext2D, text: string, xMm: number, baselineMm: number, maxWidthMm: number): void {
    context.save();
    context.fillStyle = "#333";
    context.font = `2.3px "Segoe UI", system-ui, sans-serif`;
    context.textBaseline = "alphabetic";
    context.fillText(text, xMm, baselineMm, maxWidthMm);
    context.restore();
}

function createCanvas(widthPx: number, heightPx: number): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(widthPx);
    canvas.height = Math.round(heightPx);
    return canvas;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const image = new Image();
        if (!url.startsWith("data:") && !url.startsWith("blob:")) {
            image.crossOrigin = "anonymous";
        }
        image.onload = () => resolve(image.naturalWidth > 0 ? image : null);
        image.onerror = () => resolve(null);
        image.src = url;
    });
}

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob === null) {
        throw new Error("The browser could not encode the image.");
    }
    return withPngResolution(new Uint8Array(await blob.arrayBuffer()), EXPORT_DPI);
}

function withPngResolution(png: Uint8Array, dpi: number): Uint8Array {
    const ihdrEnd = 8 + 4 + 4 + 13 + 4;
    const pixelsPerMeter = Math.round(dpi / 0.0254);
    const chunk = new Uint8Array(4 + 4 + 9 + 4);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, 9);
    chunk.set([0x70, 0x48, 0x59, 0x73], 4);
    view.setUint32(8, pixelsPerMeter);
    view.setUint32(12, pixelsPerMeter);
    chunk[16] = 1;
    view.setUint32(17, crc32(chunk.subarray(4, 17)));

    const result = new Uint8Array(png.length + chunk.length);
    result.set(png.subarray(0, ihdrEnd), 0);
    result.set(chunk, ihdrEnd);
    result.set(png.subarray(ihdrEnd), ihdrEnd + chunk.length);
    return result;
}

const CRC_TABLE = Array.from({length: 256}, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

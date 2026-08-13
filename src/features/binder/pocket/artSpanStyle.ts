import type {CSSProperties} from "react";
import {resolveArtImageUrl} from "../../../artImageUrl";
import {
    type ArtCrop,
    type ArtPlacement,
    POCKET_HEIGHT_MM,
    POCKET_WIDTH_MM,
} from "../../../types/binder";

interface CellBox {
    leftMm: number;
    topMm: number;
    widthMm: number;
    heightMm: number;
}

function scaledImageSize(
    spanWidth: number,
    spanHeight: number,
    imageAspectRatio: number | null,
    zoom: number
): { width: number; height: number } {
    if (imageAspectRatio === null || imageAspectRatio <= 0) {
        return {width: spanWidth * zoom, height: spanHeight * zoom};
    }
    const spanAspectRatio = spanWidth / spanHeight;
    if (imageAspectRatio > spanAspectRatio) {
        return {width: spanHeight * imageAspectRatio * zoom, height: spanHeight * zoom};
    }
    return {width: spanWidth * zoom, height: (spanWidth / imageAspectRatio) * zoom};
}

function backgroundStyleFor(
    imageUrl: string,
    spanWidth: number,
    spanHeight: number,
    crop: ArtCrop,
    cell: CellBox,
    imageAspectRatio: number | null
): CSSProperties {
    const scaled = scaledImageSize(spanWidth, spanHeight, imageAspectRatio, crop.zoom);

    const cropMarginX = ((scaled.width - spanWidth) * (1 - crop.panX)) / 2;
    const cropMarginY = ((scaled.height - spanHeight) * (1 - crop.panY)) / 2;

    const denominatorX = scaled.width - cell.widthMm;
    const denominatorY = scaled.height - cell.heightMm;
    const positionX = denominatorX > 0 ? ((cell.leftMm + cropMarginX) / denominatorX) * 100 : 0;
    const positionY = denominatorY > 0 ? ((cell.topMm + cropMarginY) / denominatorY) * 100 : 0;

    return {
        backgroundImage: `url(${JSON.stringify(imageUrl)})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${(scaled.width / cell.widthMm) * 100}% ${(scaled.height / cell.heightMm) * 100}%`,
        backgroundPosition: `${positionX}% ${positionY}%`,
    };
}

export function computeArtCellStyle(
    placement: ArtPlacement,
    rowOffset: number,
    columnOffset: number,
    imageAspectRatio: number | null
): CSSProperties {
    const spanWidth = placement.rect.columnCount * POCKET_WIDTH_MM;
    const spanHeight = placement.rect.rowCount * POCKET_HEIGHT_MM;
    return backgroundStyleFor(
        resolveArtImageUrl(placement.art),
        spanWidth,
        spanHeight,
        placement.crop,
        {
            leftMm: columnOffset * POCKET_WIDTH_MM,
            topMm: rowOffset * POCKET_HEIGHT_MM,
            widthMm: POCKET_WIDTH_MM,
            heightMm: POCKET_HEIGHT_MM,
        },
        imageAspectRatio
    );
}

export function computeArtSpanStyle(
    placement: ArtPlacement,
    crop: ArtCrop,
    imageAspectRatio: number | null
): CSSProperties {
    const spanWidth = placement.rect.columnCount * POCKET_WIDTH_MM;
    const spanHeight = placement.rect.rowCount * POCKET_HEIGHT_MM;
    return backgroundStyleFor(
        resolveArtImageUrl(placement.art),
        spanWidth,
        spanHeight,
        crop,
        {leftMm: 0, topMm: 0, widthMm: spanWidth, heightMm: spanHeight},
        imageAspectRatio
    );
}

export function artPanSlack(
    placement: ArtPlacement,
    crop: ArtCrop,
    imageAspectRatio: number | null
): { widthMm: number; heightMm: number; slackXMm: number; slackYMm: number } {
    const spanWidth = placement.rect.columnCount * POCKET_WIDTH_MM;
    const spanHeight = placement.rect.rowCount * POCKET_HEIGHT_MM;
    const scaled = scaledImageSize(spanWidth, spanHeight, imageAspectRatio, crop.zoom);
    return {
        widthMm: spanWidth,
        heightMm: spanHeight,
        slackXMm: scaled.width - spanWidth,
        slackYMm: scaled.height - spanHeight,
    };
}

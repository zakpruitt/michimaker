import type {CSSProperties} from "react";
import {resolveArtImageUrl} from "../../../artImageUrl";
import {
    type ArtCrop,
    type ArtPlacement,
    artCellOffsetMm,
    artSpanSizeMm,
    POCKET_HEIGHT_MM,
    POCKET_WIDTH_MM,
    type PocketGap,
} from "../../../types/binder";

export interface ArtBox {
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

export interface ImageRectMm {
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
}

export function artImageRectMm(
    placement: ArtPlacement,
    crop: ArtCrop,
    gap: PocketGap,
    imageAspectRatio: number | null
): ImageRectMm {
    const span = artSpanSizeMm(placement.rect, gap);
    const scaled = scaledImageSize(span.widthMm, span.heightMm, imageAspectRatio, crop.zoom);
    return {
        xMm: -((scaled.width - span.widthMm) * (1 - crop.panX)) / 2,
        yMm: -((scaled.height - span.heightMm) * (1 - crop.panY)) / 2,
        widthMm: scaled.width,
        heightMm: scaled.height,
    };
}

function backgroundStyleFor(imageUrl: string, image: ImageRectMm, cell: ArtBox): CSSProperties {
    const denominatorX = image.widthMm - cell.widthMm;
    const denominatorY = image.heightMm - cell.heightMm;
    const positionX = denominatorX > 0 ? ((cell.leftMm - image.xMm) / denominatorX) * 100 : 0;
    const positionY = denominatorY > 0 ? ((cell.topMm - image.yMm) / denominatorY) * 100 : 0;

    return {
        backgroundImage: `url(${JSON.stringify(imageUrl)})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${(image.widthMm / cell.widthMm) * 100}% ${(image.heightMm / cell.heightMm) * 100}%`,
        backgroundPosition: `${positionX}% ${positionY}%`,
    };
}

export function computeArtCellStyle(
    placement: ArtPlacement,
    rowOffset: number,
    columnOffset: number,
    gap: PocketGap,
    imageAspectRatio: number | null
): CSSProperties {
    return computeArtBoxStyle(placement, gap, imageAspectRatio, {
        ...artCellOffsetMm(rowOffset, columnOffset, gap),
        widthMm: POCKET_WIDTH_MM,
        heightMm: POCKET_HEIGHT_MM,
    });
}

export function computeArtBoxStyle(
    placement: ArtPlacement,
    gap: PocketGap,
    imageAspectRatio: number | null,
    box: ArtBox
): CSSProperties {
    return backgroundStyleFor(
        resolveArtImageUrl(placement.art),
        artImageRectMm(placement, placement.crop, gap, imageAspectRatio),
        box
    );
}

export function computeArtSpanStyle(
    placement: ArtPlacement,
    crop: ArtCrop,
    gap: PocketGap,
    imageAspectRatio: number | null
): CSSProperties {
    const span = artSpanSizeMm(placement.rect, gap);
    return backgroundStyleFor(
        resolveArtImageUrl(placement.art),
        artImageRectMm(placement, crop, gap, imageAspectRatio),
        {leftMm: 0, topMm: 0, ...span}
    );
}

export function artPanSlack(
    placement: ArtPlacement,
    crop: ArtCrop,
    gap: PocketGap,
    imageAspectRatio: number | null
): { widthMm: number; heightMm: number; slackXMm: number; slackYMm: number } {
    const span = artSpanSizeMm(placement.rect, gap);
    const scaled = scaledImageSize(span.widthMm, span.heightMm, imageAspectRatio, crop.zoom);
    return {
        ...span,
        slackXMm: scaled.width - span.widthMm,
        slackYMm: scaled.height - span.heightMm,
    };
}

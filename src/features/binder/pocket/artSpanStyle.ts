import type {CSSProperties} from "react";
import {type GridRect, POCKET_HEIGHT_MM, POCKET_WIDTH_MM,} from "../../../types/binder";

/** Background style for one pocket-sized cell of an art span; null aspect ratio stretches to fit. */
export function computeArtCellStyle(
    rect: GridRect,
    rowOffset: number,
    columnOffset: number,
    imageUrl: string,
    imageAspectRatio: number | null
): CSSProperties {
    const spanWidth = rect.columnCount * POCKET_WIDTH_MM;
    const spanHeight = rect.rowCount * POCKET_HEIGHT_MM;

    // Size the image over the span: exact fit (stretch) when the aspect ratio
    // is unknown, otherwise cover: enlarge the smaller dimension and crop.
    let scaledWidth = spanWidth;
    let scaledHeight = spanHeight;
    if (imageAspectRatio !== null && imageAspectRatio > 0) {
        const spanAspectRatio = spanWidth / spanHeight;
        if (imageAspectRatio > spanAspectRatio) {
            scaledHeight = spanHeight;
            scaledWidth = spanHeight * imageAspectRatio;
        } else {
            scaledWidth = spanWidth;
            scaledHeight = spanWidth / imageAspectRatio;
        }
    }

    // This cell's top-left corner in span coordinates, plus the centered-crop
    // margin, gives how far the image must shift left/up within this cell.
    const cellLeft = columnOffset * POCKET_WIDTH_MM;
    const cellTop = rowOffset * POCKET_HEIGHT_MM;
    const cropMarginX = (scaledWidth - spanWidth) / 2;
    const cropMarginY = (scaledHeight - spanHeight) / 2;

    // background-position P% places the image at (cell - image) * P/100, so
    // solve for P. Denominator 0 means the image exactly fits one cell.
    const denominatorX = scaledWidth - POCKET_WIDTH_MM;
    const denominatorY = scaledHeight - POCKET_HEIGHT_MM;
    const positionX = denominatorX > 0 ? ((cellLeft + cropMarginX) / denominatorX) * 100 : 0;
    const positionY = denominatorY > 0 ? ((cellTop + cropMarginY) / denominatorY) * 100 : 0;

    return {
        backgroundImage: `url(${JSON.stringify(imageUrl)})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${(scaledWidth / POCKET_WIDTH_MM) * 100}% ${(scaledHeight / POCKET_HEIGHT_MM) * 100}%`,
        backgroundPosition: `${positionX}% ${positionY}%`,
    };
}

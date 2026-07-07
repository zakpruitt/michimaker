import type {DragEvent, MouseEvent} from "react";
import type {PocketColumns, PocketContent, PocketRef} from "../../types/binder";
import {formatUsd} from "../../types/card";
import {useBinderActions, useSelection} from "./BinderContext";
import {computeArtCellStyle} from "./artSpanStyle";
import {dragPayloadHasArt, dragPayloadHasCard, readArtDragPayload, readCardDragPayload,} from "./dragPayload";
import {pocketKey, rectArea} from "./gridMath";
import {useImageAspectRatio} from "./useImageAspectRatio";
import styles from "./PocketView.module.css";

interface PocketViewProps {
    pocket: PocketRef;
    content: PocketContent;
    /** The binder's page width (3 or 4), for gutter-aware print cut lines. */
    columns: PocketColumns;
}

export function PocketView({pocket, content, columns}: PocketViewProps) {
    const {selection, selectedPocketKeys, selectionIsPlaceable} = useSelection();
    const {handlePocketMouseDown, handlePocketMouseEnter, placeCardAt, dropArtOnPocket} =
        useBinderActions();

    const isSelected = selectedPocketKeys.has(pocketKey(pocket));
    // A multi-pocket selection that overlaps existing content can't take art;
    // tint it as a conflict. (A single-pocket selection of a filled pocket is
    // a normal "selected for replace/remove" state, not a conflict.)
    const isConflict =
        isSelected &&
        !selectionIsPlaceable &&
        selection !== null &&
        rectArea(selection) > 1;

    function handleMouseDown(event: MouseEvent) {
        if (event.button !== 0) {
            return;
        }
        // Prevent native image-drag/text-select from hijacking drag-selection.
        event.preventDefault();
        handlePocketMouseDown(pocket);
    }

    function handleDragOver(event: DragEvent) {
        if (dragPayloadHasCard(event) || dragPayloadHasArt(event)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
        }
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        const card = readCardDragPayload(event);
        if (card !== null) {
            placeCardAt(pocket, card);
            return;
        }
        const art = readArtDragPayload(event);
        if (art !== null) {
            dropArtOnPocket(pocket, art);
        }
    }

    const classNames = [styles.pocket];
    if (isSelected) {
        classNames.push(isConflict ? styles.conflict : styles.selected);
    }
    if (content.kind === "art") {
        classNames.push(styles.artCell);
    }

    return (
        <div
            className={classNames.join(" ")}
            data-print="pocket"
            data-print-content={content.kind}
            onMouseDown={handleMouseDown}
            // buttons === 1: only extend the drag-selection while the left button
            // is still held (protects against a missed mouseup outside the window)
            onMouseEnter={(event) => {
                if (event.buttons === 1) {
                    handlePocketMouseEnter(pocket);
                }
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {content.kind === "card" && <CardCell content={content}/>}
            {content.kind === "art" && <ArtCell content={content} columns={columns}/>}
        </div>
    );
}

function CardCell({content}: { content: Extract<PocketContent, { kind: "card" }> }) {
    return (
        <>
            <img
                src={content.card.smallImageUrl}
                alt={content.card.name}
                className={styles.cardImage}
                draggable={false}
            />
            {content.card.marketPrice !== null && (
                <span className={styles.priceTag} data-print="hide">
          {formatUsd(content.card.marketPrice)}
        </span>
            )}
        </>
    );
}

function ArtCell({
                     content,
                     columns,
                 }: {
    content: Extract<PocketContent, { kind: "art" }>;
    columns: PocketColumns;
}) {
    const {placement, rowOffset, columnOffset} = content;
    const aspectRatio = useImageAspectRatio(placement.art.imageUrl);
    const backgroundStyle = computeArtCellStyle(
        placement.rect,
        rowOffset,
        columnOffset,
        placement.art.imageUrl,
        aspectRatio
    );

    const isAnchorCell = rowOffset === 0 && columnOffset === 0;

    // Collapsed cut-line edges for the printed guide: the top of every row
    // (plus the span's outer bottom), and the ends of each horizontal run on
    // this physical page. A span crossing the spread gutter starts a new run
    // on the facing page, so the gutter always gets cut edges on both sides.
    // print.css decides whether runs stay connected or every cell is cut.
    const absoluteColumn = placement.rect.column + columnOffset;
    const cutEdges = ["top"];
    if (rowOffset === placement.rect.rowCount - 1) {
        cutEdges.push("bottom");
    }
    if (columnOffset === 0 || absoluteColumn === columns) {
        cutEdges.push("left");
    }
    if (
        columnOffset === placement.rect.columnCount - 1 ||
        absoluteColumn === columns - 1
    ) {
        cutEdges.push("right");
    }

    return (
        <div
            className={styles.artSlice}
            style={backgroundStyle}
            data-print="art-cell"
            data-print-cut={cutEdges.join(" ")}
        >
            {isAnchorCell && (
                <span className={styles.artTitle} data-print="hide">
          {placement.art.title} · {placement.rect.rowCount}×{placement.rect.columnCount}
        </span>
            )}
        </div>
    );
}

import {type DragEvent, type MouseEvent, useMemo, useState} from "react";
import {resolveArtImageUrl} from "../../../artImageUrl";
import type {PocketContent, PocketGap, PocketRef} from "../../../types/binder";
import {formatUsd} from "../../../types/card";
import {useBinderActions, useSelection} from "../state/BinderContext";
import {computeArtCellStyle} from "./artSpanStyle";
import {
    dragPayloadHasArt,
    dragPayloadHasCard,
    dragPayloadHasMove,
    readArtDragPayload,
    readArtMovePayload,
    readCardDragPayload,
    readCardMovePayload,
    setArtMovePayload,
    setCardMovePayload,
} from "./dragPayload";
import {artOffsetKey, firstVisibleArtOffset, pocketKey, rectArea} from "../state/gridMath";
import {useImageAspectRatio} from "./useImageAspectRatio";
import styles from "./PocketView.module.css";

interface PocketViewProps {
    pocket: PocketRef;
    content: PocketContent;
    pocketGap: PocketGap;
}

export function PocketView({pocket, content, pocketGap}: PocketViewProps) {
    const {selection, selectedPocketKeys, selectionIsPlaceable} = useSelection();
    const {
        handlePocketMouseDown,
        handlePocketMouseEnter,
        placeCardAt,
        moveCard,
        dropArtOnPocket,
        moveArt,
    } = useBinderActions();

    const isSelected = selectedPocketKeys.has(pocketKey(pocket));
    const isConflict =
        isSelected &&
        !selectionIsPlaceable &&
        selection !== null &&
        rectArea(selection) > 1;

    function handleMouseDown(event: MouseEvent) {
        if (event.button !== 0) {
            return;
        }
        if (content.kind === "empty") {
            event.preventDefault();
        }
        handlePocketMouseDown(pocket);
    }

    function handleDragStart(event: DragEvent) {
        if (content.kind === "card") {
            setCardMovePayload(event, pocket);
        } else if (content.kind === "art") {
            setArtMovePayload(event, {
                placementId: content.placement.id,
                rowOffset: content.rowOffset,
                columnOffset: content.columnOffset,
            });
        }
    }

    function handleDragOver(event: DragEvent) {
        if (dragPayloadHasCard(event) || dragPayloadHasArt(event)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
        } else if (dragPayloadHasMove(event)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
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
            return;
        }
        const cardFrom = readCardMovePayload(event);
        if (cardFrom !== null) {
            moveCard(cardFrom, pocket);
            return;
        }
        const artMove = readArtMovePayload(event);
        if (artMove !== null) {
            moveArt(artMove, pocket);
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
            draggable={content.kind !== "empty"}
            onDragStart={handleDragStart}
            onMouseDown={handleMouseDown}
            onMouseEnter={(event) => {
                if (event.buttons === 1) {
                    handlePocketMouseEnter(pocket);
                }
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {content.kind === "card" && <CardCell content={content}/>}
            {content.kind === "art" && <ArtCell content={content} pocketGap={pocketGap}/>}
        </div>
    );
}

function CardCell({content}: { content: Extract<PocketContent, { kind: "card" }> }) {
    const {card} = content;
    const [failedUrl, setFailedUrl] = useState<string | null>(null);

    return (
        <>
            {failedUrl === card.smallImageUrl ? (
                <span className={styles.cardFallback}>{card.name}</span>
            ) : (
                <img
                    src={card.smallImageUrl}
                    alt={card.name}
                    className={styles.cardImage}
                    draggable={false}
                    onError={() => setFailedUrl(card.smallImageUrl)}
                />
            )}
            {card.marketPrice !== null && (
                <span className={styles.priceTag}>
                    {formatUsd(card.marketPrice)}
                </span>
            )}
            {card.owned === true && (
                <span className={styles.ownedBadge} title="Owned" aria-label="Owned">✓</span>
            )}
        </>
    );
}

function ArtCell({content, pocketGap}: { content: Extract<PocketContent, { kind: "art" }>; pocketGap: PocketGap }) {
    const {placement, rowOffset, columnOffset, holes} = content;
    const aspectRatio = useImageAspectRatio(resolveArtImageUrl(placement.art));
    const backgroundStyle = useMemo(
        () => computeArtCellStyle(placement, rowOffset, columnOffset, pocketGap, aspectRatio),
        [placement, rowOffset, columnOffset, pocketGap, aspectRatio]
    );

    const isAnchorCell =
        firstVisibleArtOffset(placement.rect, holes) === artOffsetKey(rowOffset, columnOffset);

    return (
        <div className={styles.artSlice} style={backgroundStyle}>
            {isAnchorCell && (
                <span className={styles.artTitle}>
                    {placement.art.title} · {placement.rect.rowCount}×{placement.rect.columnCount}
                </span>
            )}
        </div>
    );
}

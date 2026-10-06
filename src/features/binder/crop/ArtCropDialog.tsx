import {type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState} from "react";
import {resolveArtImageUrl} from "../../../artImageUrl";
import {
    type ArtCrop,
    type ArtPlacement,
    DEFAULT_ART_CROP,
    MAX_ART_ZOOM,
    MIN_ART_ZOOM,
    artSpanSizeMm,
} from "../../../types/binder";
import {useBinderActions, useBinderState} from "../state/BinderContext";
import {artPanSlack, computeArtSpanStyle} from "../pocket/artSpanStyle";
import {useImageAspectRatio} from "../pocket/useImageAspectRatio";
import {artHoleOffsets, artOffsetKey, listCardPocketKeys} from "../state/gridMath";
import {Modal} from "../../../components/Modal";
import styles from "./ArtCropDialog.module.css";

const MAX_PREVIEW_WIDTH_PX = 420;
const MAX_PREVIEW_HEIGHT_PX = 380;

interface ArtCropDialogProps {
    placement: ArtPlacement;
    onClose: () => void;
}

interface DragState {
    pointerId: number;
    startX: number;
    startY: number;
    startCrop: ArtCrop;
    previewWidth: number;
    previewHeight: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function ArtCropDialog({placement, onClose}: ArtCropDialogProps) {
    const {binder} = useBinderState();
    const {setArtCrop} = useBinderActions();

    const [crop, setCrop] = useState<ArtCrop>(placement.crop);
    const dragRef = useRef<DragState | null>(null);
    const previewRef = useRef<HTMLDivElement | null>(null);

    const aspectRatio = useImageAspectRatio(resolveArtImageUrl(placement.art));
    const rect = placement.rect;

    const holes = useMemo(
        () => artHoleOffsets(rect, binder.pocketColumns, listCardPocketKeys(binder)),
        [rect, binder]
    );

    const gap = binder.pocketGap;
    const {widthMm: spanWidthMm, heightMm: spanHeightMm} = artSpanSizeMm(rect, gap);
    const previewScale = Math.min(
        MAX_PREVIEW_WIDTH_PX / spanWidthMm,
        MAX_PREVIEW_HEIGHT_PX / spanHeightMm
    );
    const previewWidth = spanWidthMm * previewScale;
    const previewHeight = spanHeightMm * previewScale;

    const slack = artPanSlack(placement, crop, gap, aspectRatio);
    const canPanX = slack.slackXMm > 0.01;
    const canPanY = slack.slackYMm > 0.01;

    useEffect(() => {
        const node = previewRef.current;
        if (node === null) {
            return;
        }

        function handleWheel(event: WheelEvent) {
            event.preventDefault();
            setCrop((current) => ({
                ...current,
                zoom: clamp(
                    current.zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08),
                    MIN_ART_ZOOM,
                    MAX_ART_ZOOM
                ),
            }));
        }

        node.addEventListener("wheel", handleWheel, {passive: false});
        return () => node.removeEventListener("wheel", handleWheel);
    }, []);

    function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
        if (event.button !== 0 || (!canPanX && !canPanY)) {
            return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startCrop: crop,
            previewWidth,
            previewHeight,
        };
    }

    function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        const drag = dragRef.current;
        if (drag === null || drag.pointerId !== event.pointerId) {
            return;
        }
        const fractionX = (event.clientX - drag.startX) / drag.previewWidth;
        const fractionY = (event.clientY - drag.startY) / drag.previewHeight;
        setCrop({
            zoom: drag.startCrop.zoom,
            panX: canPanX
                ? clamp(drag.startCrop.panX + (2 * fractionX * spanWidthMm) / slack.slackXMm, -1, 1)
                : drag.startCrop.panX,
            panY: canPanY
                ? clamp(drag.startCrop.panY + (2 * fractionY * spanHeightMm) / slack.slackYMm, -1, 1)
                : drag.startCrop.panY,
        });
    }

    function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
        if (dragRef.current?.pointerId === event.pointerId) {
            dragRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    }

    function apply() {
        setArtCrop(placement.id, crop);
        onClose();
    }

    const cells: { rowOffset: number; columnOffset: number }[] = [];
    for (let rowOffset = 0; rowOffset < rect.rowCount; rowOffset++) {
        for (let columnOffset = 0; columnOffset < rect.columnCount; columnOffset++) {
            cells.push({rowOffset, columnOffset});
        }
    }

    return (
        <Modal title={`Frame ${placement.art.title}`} onClose={onClose}>
            <div
                ref={previewRef}
                className={styles.preview}
                style={{
                    width: `${previewWidth}px`,
                    height: `${previewHeight}px`,
                    cursor: canPanX || canPanY ? "grab" : "default",
                    ...computeArtSpanStyle(placement, crop, gap, aspectRatio),
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <div
                    className={styles.grid}
                    style={{
                        gridTemplateColumns: `repeat(${rect.columnCount}, 1fr)`,
                        gridTemplateRows: `repeat(${rect.rowCount}, 1fr)`,
                        columnGap: `${gap.xMm * previewScale}px`,
                        rowGap: `${gap.yMm * previewScale}px`,
                        "--seam-shade": `${(Math.max(gap.xMm, gap.yMm) * previewScale) / 2}px`,
                    } as CSSProperties}
                >
                    {cells.map(({rowOffset, columnOffset}) => {
                        const classNames = [styles.cell];
                        if (holes.has(artOffsetKey(rowOffset, columnOffset))) {
                            classNames.push(styles.hole);
                        }
                        if (rect.column + columnOffset === binder.pocketColumns) {
                            classNames.push(styles.gutter);
                        }
                        return (
                            <div
                                key={artOffsetKey(rowOffset, columnOffset)}
                                className={classNames.join(" ")}
                            />
                        );
                    })}
                </div>
            </div>

            <p className={styles.hint}>
                Drag the art to reposition it, scroll or use the slider to zoom. Striped
                pockets sit behind a card; the darker bands are the seams between
                pockets, which never get printed.
            </p>

            <label className={styles.zoomRow}>
                <span>Zoom</span>
                <input
                    type="range"
                    min={MIN_ART_ZOOM}
                    max={MAX_ART_ZOOM}
                    step={0.01}
                    value={crop.zoom}
                    onChange={(event) =>
                        setCrop((current) => ({...current, zoom: Number(event.target.value)}))
                    }
                />
                <span className={styles.zoomValue}>{crop.zoom.toFixed(2)}×</span>
            </label>

            <div className={styles.buttons}>
                <button
                    type="button"
                    className={styles.resetButton}
                    onClick={() => setCrop(DEFAULT_ART_CROP)}
                >
                    Reset
                </button>
                <span className={styles.spacer}/>
                <button type="button" className={styles.cancelButton} onClick={onClose}>
                    Cancel
                </button>
                <button type="button" className={styles.applyButton} onClick={apply}>
                    Apply
                </button>
            </div>
        </Modal>
    );
}

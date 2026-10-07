import {type CSSProperties, useMemo} from "react";
import {resolveArtImageUrl} from "../../artImageUrl";
import {artCellOffsetMm, POCKET_HEIGHT_MM, POCKET_WIDTH_MM, type PocketGap} from "../../types/binder";
import {computeArtBoxStyle, computeArtCellStyle} from "../binder/pocket/artSpanStyle";
import {useImageAspectRatio} from "../binder/pocket/useImageAspectRatio";
import {type ArtFill, blockSizeMm, cellOriginMm, type PrintCell, type PrintLayout, type PrintSheet} from "./printLayout";
import styles from "./PrintSheets.module.css";

const MM_TO_PX = 96 / 25.4;

interface SheetProps {
    layout: PrintLayout;
    sheet: PrintSheet;
}

export function PrintSheets({layout}: {layout: PrintLayout}) {
    return layout.sheets.map((sheet, index) => (
        <section
            key={index}
            className={styles.sheet}
            style={{
                width: `${layout.pageWidthMm - 2 * layout.marginMm}mm`,
                height: `${layout.pageHeightMm - 2 * layout.marginMm}mm`,
            }}
        >
            <SheetContent layout={layout} sheet={sheet}/>
        </section>
    ));
}

export function SheetPreview({layout, sheet, widthPx}: SheetProps & {widthPx: number}) {
    const scale = widthPx / (layout.pageWidthMm * MM_TO_PX);
    return (
        <div
            className={styles.previewPaper}
            style={{width: `${widthPx}px`, height: `${layout.pageHeightMm * MM_TO_PX * scale}px`}}
        >
            <div
                className={styles.previewInner}
                style={{
                    width: `${layout.pageWidthMm}mm`,
                    height: `${layout.pageHeightMm}mm`,
                    padding: `${layout.marginMm}mm`,
                    transform: `scale(${scale})`,
                }}
            >
                <div className={styles.previewPrintable}>
                    <SheetContent layout={layout} sheet={sheet}/>
                </div>
            </div>
        </div>
    );
}

function SheetContent({layout, sheet}: SheetProps) {
    const gap = layout.pocketGap;
    return sheet.pieces.map(({piece, xMm, yMm}) => {
        const block = blockSizeMm(piece, gap);
        return (
            <div key={piece.key} className={styles.piece} style={{left: `${xMm}mm`, top: `${yMm}mm`, width: `${block.widthMm}mm`}}>
                {piece.label !== null && (
                    <div className={styles.label} style={{height: `${layout.labelHeightMm}mm`}}>
                        {piece.label}
                    </div>
                )}
                <div className={styles.block} style={{width: `${block.widthMm}mm`, height: `${block.heightMm}mm`}}>
                    {piece.artFill !== null && <ArtFillView fill={piece.artFill} gap={gap} widthMm={block.widthMm} heightMm={block.heightMm}/>}
                    {piece.cells.map((cell, index) => {
                        const origin = cellOriginMm(piece, index, gap);
                        const position: CSSProperties = {
                            left: `${origin.xMm}mm`,
                            top: `${origin.yMm}mm`,
                            width: `${POCKET_WIDTH_MM}mm`,
                            height: `${POCKET_HEIGHT_MM}mm`,
                        };
                        if (cell === null) {
                            return piece.artFill === null ? null : <div key={index} className={styles.blank} style={position}/>;
                        }
                        return (
                            <div key={index} className={styles.cellSlot} style={position}>
                                <CellView
                                    cell={cell}
                                    gap={gap}
                                    paintsArt={piece.artFill === null}
                                    grayscale={layout.grayscaleCards}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    });
}

function ArtFillView({fill, gap, widthMm, heightMm}: {fill: ArtFill; gap: PocketGap; widthMm: number; heightMm: number}) {
    const aspectRatio = useImageAspectRatio(resolveArtImageUrl(fill.placement.art));
    const style = useMemo(
        () => computeArtBoxStyle(fill.placement, gap, aspectRatio, {
            ...artCellOffsetMm(fill.rowOffset, fill.columnOffset, gap),
            widthMm,
            heightMm,
        }),
        [fill, gap, aspectRatio, widthMm, heightMm]
    );
    return <div className={styles.artFill} style={style}/>;
}

interface CellViewProps {
    cell: PrintCell;
    gap: PocketGap;
    paintsArt: boolean;
    grayscale: boolean;
}

function CellView({cell, gap, paintsArt, grayscale}: CellViewProps) {
    const {content, cut} = cell;
    if (content.kind === "empty") {
        return <div className={styles.emptyPocket}/>;
    }
    const cutStyle: CSSProperties = {
        borderTopWidth: cut.top ? undefined : 0,
        borderRightWidth: cut.right ? undefined : 0,
        borderBottomWidth: cut.bottom ? undefined : 0,
        borderLeftWidth: cut.left ? undefined : 0,
    };
    return (
        <>
            {content.kind === "card" && (
                <img
                    className={grayscale ? `${styles.cardImage} ${styles.grayscale}` : styles.cardImage}
                    src={content.card.smallImageUrl}
                    alt={content.card.name}
                />
            )}
            {content.kind === "art" && paintsArt && <ArtSlice content={content} gap={gap}/>}
            <div className={styles.cutLines} style={cutStyle}/>
        </>
    );
}

function ArtSlice({content, gap}: {content: Extract<PrintCell["content"], {kind: "art"}>; gap: PocketGap}) {
    const {placement, rowOffset, columnOffset} = content;
    const aspectRatio = useImageAspectRatio(resolveArtImageUrl(placement.art));
    const style = useMemo(
        () => computeArtCellStyle(placement, rowOffset, columnOffset, gap, aspectRatio),
        [placement, rowOffset, columnOffset, gap, aspectRatio]
    );
    return <div className={styles.artSlice} style={style}/>;
}

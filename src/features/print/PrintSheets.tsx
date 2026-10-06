import {type CSSProperties, useMemo} from "react";
import {resolveArtImageUrl} from "../../artImageUrl";
import {POCKET_HEIGHT_MM, POCKET_WIDTH_MM, type PocketGap} from "../../types/binder";
import {computeArtCellStyle} from "../binder/pocket/artSpanStyle";
import {useImageAspectRatio} from "../binder/pocket/useImageAspectRatio";
import type {PrintCell, PrintLayout, PrintSheet} from "./printLayout";
import styles from "./PrintSheets.module.css";

const MM_TO_PX = 96 / 25.4;

interface SheetProps {
    layout: PrintLayout;
    sheet: PrintSheet;
    pocketGap: PocketGap;
}

export function PrintSheets({layout, pocketGap}: {layout: PrintLayout; pocketGap: PocketGap}) {
    return layout.sheets.map((sheet, index) => (
        <section
            key={index}
            className={styles.sheet}
            style={{
                width: `${layout.pageWidthMm - 2 * layout.marginMm}mm`,
                height: `${layout.pageHeightMm - 2 * layout.marginMm}mm`,
            }}
        >
            <SheetContent layout={layout} sheet={sheet} pocketGap={pocketGap}/>
        </section>
    ));
}

export function SheetPreview({layout, sheet, pocketGap, widthPx}: SheetProps & {widthPx: number}) {
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
                    <SheetContent layout={layout} sheet={sheet} pocketGap={pocketGap}/>
                </div>
            </div>
        </div>
    );
}

function SheetContent({layout, sheet, pocketGap}: SheetProps) {
    return sheet.pieces.map(({piece, xMm, yMm}) => {
        const labelHeight = piece.label === null ? 0 : layout.labelHeightMm;
        return (
            <div
                key={piece.key}
                className={styles.piece}
                style={{left: `${xMm}mm`, top: `${yMm}mm`, width: `${piece.columns * POCKET_WIDTH_MM}mm`}}
            >
                {piece.label !== null && (
                    <div className={styles.label} style={{height: `${labelHeight}mm`}}>
                        {piece.label}
                    </div>
                )}
                <div
                    className={styles.grid}
                    style={{
                        gridTemplateColumns: `repeat(${piece.columns}, ${POCKET_WIDTH_MM}mm)`,
                        gridAutoRows: `${POCKET_HEIGHT_MM}mm`,
                    }}
                >
                    {piece.cells.map((cell, index) =>
                        cell === null ? <div key={index}/> : <CellView key={index} cell={cell} pocketGap={pocketGap}/>
                    )}
                </div>
            </div>
        );
    });
}

function CellView({cell, pocketGap}: {cell: PrintCell; pocketGap: PocketGap}) {
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
        <div className={styles.cell}>
            {content.kind === "card" ? (
                <img className={styles.cardImage} src={content.card.smallImageUrl} alt={content.card.name}/>
            ) : (
                <ArtSlice content={content} pocketGap={pocketGap}/>
            )}
            <div className={styles.cutLines} style={cutStyle}/>
        </div>
    );
}

function ArtSlice({content, pocketGap}: {content: Extract<PrintCell["content"], {kind: "art"}>; pocketGap: PocketGap}) {
    const {placement, rowOffset, columnOffset} = content;
    const aspectRatio = useImageAspectRatio(resolveArtImageUrl(placement.art));
    const style = useMemo(
        () => computeArtCellStyle(placement, rowOffset, columnOffset, pocketGap, aspectRatio),
        [placement, rowOffset, columnOffset, pocketGap, aspectRatio]
    );
    return <div className={styles.artSlice} style={style}/>;
}

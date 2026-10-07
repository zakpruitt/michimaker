import {useMemo, useState} from "react";
import {DEFAULT_POCKET_GAP, MAX_POCKET_GAP_MM, pocketsPerPage} from "../../types/binder";
import {Modal} from "../../components/Modal";
import {useNotices} from "../../components/notices/NoticeContext";
import {useBinderActions, useBinderState} from "../binder/state/BinderContext";
import {downloadBlob} from "../sharing/fileTransfer";
import {loadPaperPreference, PAPER_SPECS, type PaperSize, savePaperPreference} from "./paper";
import {
    buildPrintLayout,
    countProxyCards,
    listPrintCells,
    type PrintJob,
    type PrintLayout,
    type PrintSettings,
    type ProxySelection,
} from "./printLayout";
import {SheetPreview} from "./PrintSheets";
import styles from "./PrintDialog.module.css";

const PREVIEW_SHEET_LIMIT = 6;
const PREVIEW_WIDTH_PX = 145;
const SINGLE_PREVIEW_WIDTH_PX = 300;

interface PrintDialogProps {
    onPrint: (layout: PrintLayout) => void;
    onClose: () => void;
}

export function PrintDialog({onPrint, onClose}: PrintDialogProps) {
    const {binder, pocketContents} = useBinderState();
    const {setPocketGap} = useBinderActions();
    const {showNotice} = useNotices();

    const [job, setJob] = useState<PrintJob>(() => (binder.artPlacements.length > 0 ? "art" : "proxies"));
    const [allPages, setAllPages] = useState(true);
    const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
    const [paper, setPaper] = useState<PaperSize>(loadPaperPreference);
    const [connectStrips, setConnectStrips] = useState(false);
    const [proxySelection, setProxySelection] = useState<ProxySelection>("needed");
    const [exportProgress, setExportProgress] = useState<{done: number; total: number} | null>(null);

    const pageIndexes = useMemo<number[] | "all">(
        () => (allPages ? "all" : [...selectedPages].sort((a, b) => a - b)),
        [allPages, selectedPages]
    );
    const settings = useMemo<PrintSettings>(
        () => ({job, pageIndexes, paper, connectStrips, proxySelection}),
        [job, pageIndexes, paper, connectStrips, proxySelection]
    );
    const layout = useMemo(() => buildPrintLayout(binder, pocketContents, settings), [binder, pocketContents, settings]);
    const artPieceCount = useMemo(
        () => listPrintCells(buildPrintLayout(binder, pocketContents, {...settings, job: "art"})).length,
        [binder, pocketContents, settings]
    );
    const neededCount = countProxyCards(binder, pageIndexes, "needed");
    const cardCount = countProxyCards(binder, pageIndexes, "all");

    const isExporting = exportProgress !== null;
    const nothingSelected = !allPages && selectedPages.size === 0;
    const isEmpty = layout.sheets.length === 0;

    function togglePage(pageIndex: number) {
        setSelectedPages((current) => {
            const next = new Set(current);
            if (next.has(pageIndex)) {
                next.delete(pageIndex);
            } else {
                next.add(pageIndex);
            }
            return next;
        });
    }

    function choosePaper(next: PaperSize) {
        setPaper(next);
        savePaperPreference(next);
    }

    function updateGap(axis: "xMm" | "yMm", value: string) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            setPocketGap({...binder.pocketGap, [axis]: Math.min(MAX_POCKET_GAP_MM, Math.max(0, parsed))});
        }
    }

    async function handleExport() {
        setExportProgress({done: 0, total: 1});
        try {
            const {buildExportZip} = await import("./exportZip");
            const result = await buildExportZip(binder, layout, settings, (done, total) =>
                setExportProgress({done, total})
            );
            downloadBlob(result.blob, result.fileName);
            if (result.failedNames.length > 0) {
                showNotice(
                    `Downloaded ${result.fileName}, but these images could not be included (their site blocks downloads): ${result.failedNames.join(", ")}. Print them from the Print button instead, or upload a copy under Art > Uploads.`,
                    "error"
                );
            } else {
                showNotice(`Downloaded ${result.fileName}.`, "success");
            }
            onClose();
        } catch (error) {
            showNotice(error instanceof Error ? error.message : "The export failed.", "error");
        } finally {
            setExportProgress(null);
        }
    }

    const orientationLabel = `${PAPER_SPECS[paper].label} ${layout.orientation}`;

    return (
        <Modal title="Print & export" onClose={onClose} canClose={!isExporting} className={styles.dialog}>
            <div className={styles.body}>
                <div className={styles.options}>
                    <fieldset className={styles.fieldset}>
                        <legend className={styles.legend}>What to make</legend>
                        <JobOption
                            job="art"
                            current={job}
                            onSelect={setJob}
                            title="Michi art cut-outs"
                            description={
                                artPieceCount === 0
                                    ? "No art on the selected pages yet."
                                    : `${artPieceCount} pocket piece${artPieceCount === 1 ? "" : "s"}. Each piece prints whole, including the strips that sit under the seams between pockets; cut out each pocket and throw the strips away.`
                            }
                        />
                        <JobOption
                            job="proxies"
                            current={job}
                            onSelect={setJob}
                            title="Proxy cards"
                            description={`Card-sized placeholders for the cards you still need (${neededCount} of ${cardCount}), 9 to a sheet with cut lines.`}
                        />
                        <JobOption
                            job="pages"
                            current={job}
                            onSelect={setJob}
                            title="Whole binder pages"
                            description={`Each page as a full ${pocketsPerPage(binder.pocketColumns)}-pocket layout guide.`}
                        />
                    </fieldset>

                    {job === "proxies" && (
                        <fieldset className={styles.fieldset}>
                            <legend className={styles.legend}>Which cards</legend>
                            <label className={styles.option}>
                                <input
                                    type="radio"
                                    name="proxy-selection"
                                    checked={proxySelection === "needed"}
                                    onChange={() => setProxySelection("needed")}
                                />
                                <span>
                                    <strong>Cards I still need ({neededCount})</strong>
                                    <small>Mark cards you own with the ✓ button (or press O) and they are skipped.</small>
                                </span>
                            </label>
                            <label className={styles.option}>
                                <input
                                    type="radio"
                                    name="proxy-selection"
                                    checked={proxySelection === "all"}
                                    onChange={() => setProxySelection("all")}
                                />
                                <span><strong>Every card ({cardCount})</strong></span>
                            </label>
                        </fieldset>
                    )}

                    {job === "art" && (
                        <fieldset className={styles.fieldset}>
                            <legend className={styles.legend}>Your binder pages</legend>
                            <div className={styles.gapRow}>
                                <label>
                                    Gap between pockets
                                    <span className={styles.gapInputs}>
                                        <input
                                            type="number"
                                            min={0}
                                            max={MAX_POCKET_GAP_MM}
                                            step={0.5}
                                            value={binder.pocketGap.xMm}
                                            onChange={(event) => updateGap("xMm", event.target.value)}
                                            aria-label="Gap between columns in millimetres"
                                        />
                                        ↔
                                        <input
                                            type="number"
                                            min={0}
                                            max={MAX_POCKET_GAP_MM}
                                            step={0.5}
                                            value={binder.pocketGap.yMm}
                                            onChange={(event) => updateGap("yMm", event.target.value)}
                                            aria-label="Gap between rows in millimetres"
                                        />
                                        ↕ mm
                                    </span>
                                </label>
                                <small>
                                    The welded seam between pockets (about {DEFAULT_POCKET_GAP.xMm} mm on standard
                                    pages). The art behind each seam is trimmed away so the picture lines up across
                                    pockets. Use 0 to slice the art edge to edge.
                                </small>
                            </div>
                            {binder.pocketGap.xMm === 0 && (
                                <label className={styles.option}>
                                    <input
                                        type="checkbox"
                                        checked={connectStrips}
                                        onChange={(event) => setConnectStrips(event.target.checked)}
                                    />
                                    <span>
                                        <strong>Skip cut lines inside side-by-side art</strong>
                                        <small>Fewer cuts while trimming; you still cut each pocket apart before sliding it in.</small>
                                    </span>
                                </label>
                            )}
                        </fieldset>
                    )}

                    <fieldset className={styles.fieldset}>
                        <legend className={styles.legend}>Pages and paper</legend>
                        <div className={styles.segmented} role="group" aria-label="Paper size">
                            {(Object.keys(PAPER_SPECS) as PaperSize[]).map((size) => (
                                <button
                                    key={size}
                                    type="button"
                                    className={paper === size ? styles.segmentActive : undefined}
                                    onClick={() => choosePaper(size)}
                                >
                                    {PAPER_SPECS[size].label}
                                </button>
                            ))}
                        </div>
                        <label className={styles.option}>
                            <input
                                type="checkbox"
                                checked={allPages}
                                onChange={(event) => setAllPages(event.target.checked)}
                            />
                            <span>All binder pages</span>
                        </label>
                        {!allPages && (
                            <div className={styles.pageGrid}>
                                {binder.pages.map((_, pageIndex) => (
                                    <label key={pageIndex} className={styles.pageCheckbox}>
                                        <input
                                            type="checkbox"
                                            checked={selectedPages.has(pageIndex)}
                                            onChange={() => togglePage(pageIndex)}
                                        />
                                        <span>{pageIndex + 1}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                        {nothingSelected && <p className={styles.warning}>Pick at least one page.</p>}
                    </fieldset>
                </div>

                <div className={styles.previewColumn}>
                    <p className={styles.summary}>
                        {isEmpty
                            ? "Nothing to print with these options."
                            : `${layout.sheets.length} sheet${layout.sheets.length === 1 ? "" : "s"} · ${orientationLabel}`}
                    </p>
                    <div className={styles.previewList}>
                        {layout.sheets.slice(0, PREVIEW_SHEET_LIMIT).map((sheet, index) => (
                            <SheetPreview
                                key={index}
                                layout={layout}
                                sheet={sheet}
                                widthPx={layout.sheets.length === 1 ? SINGLE_PREVIEW_WIDTH_PX : PREVIEW_WIDTH_PX}
                            />
                        ))}
                    </div>
                    {layout.sheets.length > PREVIEW_SHEET_LIMIT && (
                        <p className={styles.summary}>+ {layout.sheets.length - PREVIEW_SHEET_LIMIT} more</p>
                    )}
                    <p className={styles.tip}>
                        Print at 100% (“Actual size”, not “Fit to page”) on matte photo paper or ~300 gsm
                        cardstock, then cut on the dashed lines.
                    </p>
                </div>
            </div>

            <div className={styles.buttons}>
                <button type="button" className={styles.cancelButton} onClick={onClose} disabled={isExporting}>
                    Cancel
                </button>
                <span className={styles.spacer}/>
                <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={isEmpty || isExporting}
                    onClick={handleExport}
                    title="300 DPI PNGs: printable sheets plus individual pieces and full art for Canva"
                >
                    {isExporting
                        ? `Preparing ${exportProgress.done}/${exportProgress.total}…`
                        : "Download images (.zip)"}
                </button>
                <button
                    type="button"
                    className={styles.printButton}
                    disabled={isEmpty || isExporting}
                    onClick={() => onPrint(layout)}
                >
                    Print / Save PDF
                </button>
            </div>
        </Modal>
    );
}

interface JobOptionProps {
    job: PrintJob;
    current: PrintJob;
    onSelect: (job: PrintJob) => void;
    title: string;
    description: string;
}

function JobOption({job, current, onSelect, title, description}: JobOptionProps) {
    return (
        <label className={styles.option}>
            <input type="radio" name="print-job" checked={current === job} onChange={() => onSelect(job)}/>
            <span>
                <strong>{title}</strong>
                <small>{description}</small>
            </span>
        </label>
    );
}

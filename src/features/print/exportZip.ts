import {type Zippable, zipSync} from "fflate";
import {type ArtPlacement, artSpanSizeMm, type Binder, POCKET_HEIGHT_MM, POCKET_WIDTH_MM} from "../../types/binder";
import {PAPER_SPECS} from "./paper";
import {padNumber, slugify} from "../../text";
import {listPrintCells, type PrintLayout, type PrintSettings} from "./printLayout";
import {ImageLoader, renderArtSpanPng, renderCellPng, renderSheetPng} from "./sheetImages";

export interface ExportResult {
    blob: Blob;
    fileName: string;
    failedNames: string[];
}

export async function buildExportZip(
    binder: Binder,
    layout: PrintLayout,
    settings: PrintSettings,
    onProgress: (done: number, total: number) => void
): Promise<ExportResult> {
    const images = new ImageLoader();
    const cells = listPrintCells(layout).filter((cell) => cell.content.kind !== "empty");
    const placements = settings.job === "art" ? uniquePlacements(layout) : [];

    const total = layout.sheets.length + (settings.job === "pages" ? 0 : cells.length) + placements.length;
    let done = 0;
    const tick = () => onProgress(++done, total);
    onProgress(0, total);

    await images.preload(cells);
    const files: Zippable = {};
    const store = (path: string, data: Uint8Array) => {
        files[path] = [data, {level: 0}];
    };

    for (const [index, sheet] of layout.sheets.entries()) {
        store(`print-sheets/sheet-${padNumber(index + 1)}.png`, await renderSheetPng(layout, sheet, images));
        tick();
    }

    if (settings.job !== "pages") {
        const folder = settings.job === "art" ? "pocket-pieces" : "proxy-cards";
        const usedNames = new Set<string>();
        for (const cell of cells) {
            store(`${folder}/${uniqueName(cell.fileName, usedNames)}.png`, await renderCellPng(cell, layout.pocketGap, images, layout.grayscaleCards));
            tick();
        }
    }

    for (const placement of placements) {
        const png = await renderArtSpanPng(placement, binder.pocketGap, images);
        if (png !== null) {
            const size = artSpanSizeMm(placement.rect, binder.pocketGap);
            const name = `${slugify(placement.art.title)}_${placement.rect.rowCount}x${placement.rect.columnCount}_${formatMm(size.widthMm)}x${formatMm(size.heightMm)}mm`;
            store(`canva-full-art/${name}.png`, png);
        }
        tick();
    }

    files["README.txt"] = new TextEncoder().encode(readme(binder, layout, settings));

    const zipped = zipSync(files);
    return {
        blob: new Blob([zipped], {type: "application/zip"}),
        fileName: `${slugify(binder.title)}-${settings.job === "art" ? "michi-art" : settings.job}.zip`,
        failedNames: [...images.failedNames],
    };
}

function uniquePlacements(layout: PrintLayout): ArtPlacement[] {
    const byId = new Map<string, ArtPlacement>();
    for (const cell of listPrintCells(layout)) {
        if (cell.content.kind === "art") {
            byId.set(cell.content.placement.id, cell.content.placement);
        }
    }
    return [...byId.values()];
}

function uniqueName(base: string, used: Set<string>): string {
    let name = base;
    for (let suffix = 2; used.has(name); suffix++) {
        name = `${base}-${suffix}`;
    }
    used.add(name);
    return name;
}

function formatMm(value: number): string {
    return String(Math.round(value * 10) / 10);
}

function inches(mm: number): string {
    return (mm / 25.4).toFixed(2);
}

function readme(binder: Binder, layout: PrintLayout, settings: PrintSettings): string {
    const paper = PAPER_SPECS[layout.paper];
    const gap = binder.pocketGap;
    const lines = [
        `${binder.title}: exported from MichiMaker`,
        "",
        "PRINTING THE SHEETS (print-sheets/)",
        `- Each PNG is one ${paper.label} page (${layout.orientation}) at 300 DPI.`,
        "- Print at 100% / \"Actual size\". Turn OFF \"Fit to page\" and borderless printing,",
        `  or the pieces will not come out at ${POCKET_WIDTH_MM} x ${POCKET_HEIGHT_MM} mm.`,
        "- Check the first sheet with a ruler: one pocket should measure exactly",
        `  ${POCKET_WIDTH_MM} mm x ${POCKET_HEIGHT_MM} mm (${inches(POCKET_WIDTH_MM)}" x ${inches(POCKET_HEIGHT_MM)}").`,
        "- Matte coated photo paper or cardstock around 300 gsm feels closest to a real card",
        "  and stays stiff in the pocket. Avoid uncoated cardstock (fuzzy prints).",
        "- Cut on the dashed lines. A paper trimmer gives the cleanest edges; a corner",
        "  rounder makes pieces match real cards.",
        "- Art sheets print each piece of art whole. The thin strips between the dashed",
        "  pockets sit under the seams of your binder page: cut them off and throw them away.",
        "",
    ];
    if (settings.job === "art") {
        lines.push(
            "POCKET PIECES (pocket-pieces/)",
            `- One PNG per pocket, exactly ${POCKET_WIDTH_MM} x ${POCKET_HEIGHT_MM} mm at 300 DPI, named by page, row, and column.`,
            "- Handy for photo-print services: order them as 2.5\" x 3.5\" (wallet) prints.",
            "",
            "FULL ART FOR CANVA (canva-full-art/)",
            "- One PNG per art span with your crop and zoom applied, at 300 DPI.",
            `- The size in each file name includes the ${gap.xMm} mm x ${gap.yMm} mm seams between pockets,`,
            "  so pieces cut from it line up across the pocket seams in your binder.",
            "- In Canva: Create a design > Custom size > switch units to mm > enter the size from the",
            "  file name > upload the PNG and stretch it to fill the page. Edit as you like, then",
            "  download as \"PDF Print\" for the best quality.",
            `- To cut it yourself, each pocket is ${POCKET_WIDTH_MM} mm wide with ${gap.xMm} mm between pockets,`,
            `  and ${POCKET_HEIGHT_MM} mm tall with ${gap.yMm} mm between rows.`,
            "",
        );
    }
    if (settings.job === "proxies") {
        lines.push(
            "PROXY CARDS (proxy-cards/)",
            `- One PNG per card, ${POCKET_WIDTH_MM} x ${POCKET_HEIGHT_MM} mm at 300 DPI, named by the pocket it belongs in.`,
            "- Placeholders for your own binder only. Swap each one out when you pick up the real card.",
            "",
        );
    }
    return lines.join("\r\n");
}

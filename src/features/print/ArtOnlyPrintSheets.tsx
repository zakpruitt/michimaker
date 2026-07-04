/**
 * The ink-saving print layout: just the art pieces, packed onto as few A4
 * sheets as possible, each at true physical size with the same cut lines as
 * the full page guide and a small "Page N" label so the cut strips are easy
 * to route back into the binder.
 *
 * Invisible on screen; features/print/print.css reveals it (and hides the
 * binder) while a body.print-art-only print job runs. Sheet dimensions and
 * orientation follow the binder's 9- vs 12-pocket layout (see
 * packArtSheets.ts and PrintPageSetup.tsx).
 */
import { POCKET_HEIGHT_MM, POCKET_WIDTH_MM } from "../../types/binder";
import { useBinderState } from "../binder/BinderContext";
import { computeArtCellStyle } from "../binder/artSpanStyle";
import { useImageAspectRatio } from "../binder/useImageAspectRatio";
import {
  packPiecesIntoSheets,
  sheetDimensionsFor,
  splitPlacementsIntoPieces,
  PIECE_LABEL_HEIGHT_MM,
  type PositionedPiece,
} from "./packArtSheets";

interface ArtOnlyPrintSheetsProps {
  pageIndexes: number[] | "all";
}

export function ArtOnlyPrintSheets({ pageIndexes }: ArtOnlyPrintSheetsProps) {
  const { binder } = useBinderState();

  const sheetSize = sheetDimensionsFor(binder.pocketColumns);
  const pieces = splitPlacementsIntoPieces(
    binder.artPlacements,
    pageIndexes,
    binder.pocketColumns
  );
  const sheets = packPiecesIntoSheets(pieces, sheetSize);
  if (sheets.length === 0) {
    return null;
  }

  return (
    <div data-print="art-sheets">
      {sheets.map((sheet, sheetIndex) => (
        <section
          key={sheetIndex}
          data-print="art-sheet"
          style={{
            width: `${sheetSize.widthMm}mm`,
            height: `${sheetSize.heightMm}mm`,
          }}
        >
          {sheet.pieces.map((positioned) => (
            <PackedPiece
              key={`${positioned.piece.placement.id}:${positioned.piece.pageIndex}:${positioned.piece.rowOffsetStart}`}
              positioned={positioned}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function PackedPiece({ positioned }: { positioned: PositionedPiece }) {
  const { piece, xMm, yMm } = positioned;
  const {
    placement,
    pageIndex,
    columnOffsetStart,
    columnOffsetEnd,
    rowOffsetStart,
    rowOffsetEnd,
  } = piece;
  const rect = placement.rect;
  const aspectRatio = useImageAspectRatio(placement.art.imageUrl);

  const columnCount = columnOffsetEnd - columnOffsetStart + 1;
  const cells: { rowOffset: number; columnOffset: number }[] = [];
  for (let rowOffset = rowOffsetStart; rowOffset <= rowOffsetEnd; rowOffset++) {
    for (let offset = columnOffsetStart; offset <= columnOffsetEnd; offset++) {
      cells.push({ rowOffset, columnOffset: offset });
    }
  }

  const isRowChunk = rowOffsetStart > 0 || rowOffsetEnd < rect.rowCount - 1;
  const rowsLabel = isRowChunk
    ? rowOffsetStart === rowOffsetEnd
      ? ` · row ${rowOffsetStart + 1}`
      : ` · rows ${rowOffsetStart + 1}-${rowOffsetEnd + 1}`
    : "";

  return (
    <div
      data-print="art-piece"
      style={{
        position: "absolute",
        left: `${xMm}mm`,
        top: `${yMm}mm`,
        width: `${piece.widthMm}mm`,
      }}
    >
      <div
        data-print="piece-label"
        style={{ height: `${PIECE_LABEL_HEIGHT_MM}mm` }}
      >
        Page {pageIndex + 1} · {placement.art.title} ({rect.rowCount}×
        {columnCount}){rowsLabel}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columnCount}, ${POCKET_WIDTH_MM}mm)`,
          gridAutoRows: `${POCKET_HEIGHT_MM}mm`,
          gap: 0,
        }}
      >
        {cells.map(({ rowOffset, columnOffset }) => {
          // Collapsed cut lines: the top of every row, the chunk's outer
          // bottom (its paper edge), and the left/right ends of each row
          // run. The connected vs. cut-everything choice is applied by
          // print.css, exactly as in the full page guide.
          const cutEdges = ["top"];
          if (rowOffset === rowOffsetEnd) {
            cutEdges.push("bottom");
          }
          if (columnOffset === columnOffsetStart) {
            cutEdges.push("left");
          }
          if (columnOffset === columnOffsetEnd) {
            cutEdges.push("right");
          }
          return (
            <div
              key={`${rowOffset}:${columnOffset}`}
              data-print="art-cell"
              data-print-cut={cutEdges.join(" ")}
              style={computeArtCellStyle(
                rect,
                rowOffset,
                columnOffset,
                placement.art.imageUrl,
                aspectRatio
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

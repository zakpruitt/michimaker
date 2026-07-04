/**
 * Art side panel for the Michi method: upload your own images or browse the
 * curated gallery, then click a piece to fill the selected pocket region
 * (or drag it onto the binder).
 *
 * Uploaded images are converted to data: URLs entirely in the browser
 * (nothing is sent anywhere), so they survive auto-save and share links.
 */
import { useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import type { ArtPiece } from "../../types/art";
import { Pager } from "../../components/Pager";
import { useBinderActions, useSelection } from "../binder/BinderContext";
import { setArtDragPayload } from "../binder/dragPayload";
import { useNotices } from "../../components/notices/NoticeContext";
import { listCategories, listGalleryArt } from "./galleryData";
import styles from "./ArtPanel.module.css";

const ALL_CATEGORIES = "All";
const UPLOADS_CATEGORY = "Uploads";

/** Pieces per pager page: fills the panel without endless scrolling. */
const ART_PER_PAGE = 4;

export function ArtPanel() {
  const { placeArtInSelection } = useBinderActions();
  const { selection, selectionIsPlaceable } = useSelection();
  const { showNotice } = useNotices();

  const galleryArt = useMemo(listGalleryArt, []);
  const [uploads, setUploads] = useState<ArtPiece[]>([]);
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState("");
  const [artPage, setArtPage] = useState(0);

  // Uploads is always present so there is a permanent home for your own
  // images, even before the first upload.
  const categories = useMemo(
    () => [ALL_CATEGORIES, UPLOADS_CATEGORY, ...listCategories(galleryArt)],
    [galleryArt]
  );

  const visibleArt = useMemo(() => {
    let art = [...uploads, ...galleryArt];
    if (activeCategory !== ALL_CATEGORIES) {
      art = art.filter((artPiece) => artPiece.category === activeCategory);
    }
    const query = searchQuery.trim().toLowerCase();
    if (query !== "") {
      art = art.filter(
        (artPiece) =>
          artPiece.title.toLowerCase().includes(query) ||
          artPiece.category.toLowerCase().includes(query)
      );
    }
    return art;
  }, [uploads, galleryArt, activeCategory, searchQuery]);

  const pageCount = Math.ceil(visibleArt.length / ART_PER_PAGE);
  const currentPage = Math.min(artPage, Math.max(0, pageCount - 1));
  const pagedArt = visibleArt.slice(
    currentPage * ART_PER_PAGE,
    (currentPage + 1) * ART_PER_PAGE
  );

  function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allow re-uploading the same file later.
    event.target.value = "";
    if (file === undefined) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      showNotice("Only image files can be uploaded.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const artPiece: ArtPiece = {
        id: crypto.randomUUID(),
        title: file.name,
        category: UPLOADS_CATEGORY,
        imageUrl: reader.result as string,
        sourceUrl: null,
      };
      setUploads((current) => [artPiece, ...current]);
      showNotice(
        `Added "${file.name}". Click it (or drag it onto the binder) to place it.`,
        "success"
      );
    };
    reader.onerror = () => {
      showNotice("The image could not be read.", "error");
    };
    reader.readAsDataURL(file);
  }

  function handleThumbnailDragStart(event: DragEvent, artPiece: ArtPiece) {
    setArtDragPayload(event, artPiece);
  }

  return (
    <div className={styles.panel}>
      <p className={styles.placementHint}>
        {selection !== null && selectionIsPlaceable
          ? "Click a piece below to fill the selected region."
          : "Drag across empty pockets in the binder first, then click a piece."}
      </p>

      <input
        type="search"
        className={styles.searchInput}
        placeholder="Search art by name or category…"
        value={searchQuery}
        onChange={(event) => {
          setSearchQuery(event.target.value);
          setArtPage(0);
        }}
        aria-label="Search art"
      />

      <div className={styles.categoryChips}>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={
              category === activeCategory
                ? `${styles.chip} ${styles.chipActive}`
                : styles.chip
            }
            onClick={() => {
              setActiveCategory(category);
              setArtPage(0);
            }}
          >
            {category}
          </button>
        ))}
      </div>

      {activeCategory === UPLOADS_CATEGORY && (
        <div className={styles.uploadSection}>
          <label className={styles.uploadButton}>
            Upload an image…
            <input
              type="file"
              accept="image/*"
              onChange={handleUploadChange}
              className={styles.uploadInput}
            />
          </label>
          <p className={styles.uploadHint}>Images are not uploaded to a server.</p>
        </div>
      )}

      {visibleArt.length === 0 ? (
        <p className={styles.emptyHint}>
          {searchQuery.trim() !== ""
            ? `No art matches "${searchQuery.trim()}".`
            : activeCategory === UPLOADS_CATEGORY
              ? "Nothing uploaded yet. Use the upload button above."
              : "No art here yet. Add entries to src/data/art-gallery.json, or upload your own under Uploads."}
        </p>
      ) : (
        <div className={styles.list}>
          {pagedArt.map((artPiece) => (
            <figure key={artPiece.id} className={styles.thumbnailCard}>
              <img
                src={artPiece.imageUrl}
                alt={artPiece.title}
                className={styles.thumbnail}
                draggable
                onDragStart={(event) => handleThumbnailDragStart(event, artPiece)}
                onClick={() => placeArtInSelection(artPiece)}
                loading="lazy"
                title={`${artPiece.title}: click to place in the selected region`}
              />
              <figcaption className={styles.caption}>
                <span className={styles.title}>{artPiece.title}</span>
                {artPiece.sourceUrl !== null && (
                  <a
                    href={artPiece.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.sourceLink}
                    title="Open the original source"
                  >
                    source ↗
                  </a>
                )}
              </figcaption>
            </figure>
          ))}
          <Pager
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setArtPage}
          />
        </div>
      )}
    </div>
  );
}

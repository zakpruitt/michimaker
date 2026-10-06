import {type ChangeEvent, useMemo, useState} from "react";
import {downscaleImageToDataUrl} from "../../downscaleImage";
import type {ArtPiece} from "../../types/art";
import {Pager} from "../../components/Pager";
import {activateOnEnterOrSpace} from "../../keyboard";
import {useBinderActions, useSelection} from "../binder/state/BinderContext";
import {setArtDragPayload} from "../binder/pocket/dragPayload";
import {useNotices} from "../../components/notices/NoticeContext";
import {GALLERY_ART, listCategories} from "./galleryData";
import {UPLOADS_CATEGORY} from "./uploadStore";
import {useUploadedArt} from "./useUploadedArt";
import styles from "./ArtPanel.module.css";

const ALL_CATEGORIES = "All";

const CATEGORIES = [ALL_CATEGORIES, UPLOADS_CATEGORY, ...listCategories(GALLERY_ART)];

const ART_PER_PAGE = 4;

export function ArtPanel() {
    const {placeArtInSelection} = useBinderActions();
    const {selection, selectionIsPlaceable} = useSelection();
    const {showNotice} = useNotices();

    const {uploads, addUploads, removeUpload} = useUploadedArt();
    const uploadIds = useMemo(() => new Set(uploads.map((piece) => piece.id)), [uploads]);
    const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);
    const [searchQuery, setSearchQuery] = useState("");
    const [artPage, setArtPage] = useState(0);

    const visibleArt = useMemo(() => {
        let art = [...uploads, ...GALLERY_ART];
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
    }, [uploads, activeCategory, searchQuery]);

    const pageCount = Math.ceil(visibleArt.length / ART_PER_PAGE);
    const currentPage = Math.min(artPage, Math.max(0, pageCount - 1));
    const pagedArt = visibleArt.slice(
        currentPage * ART_PER_PAGE,
        (currentPage + 1) * ART_PER_PAGE
    );

    async function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
        const files = [...(event.target.files ?? [])];
        event.target.value = "";
        const images = files.filter((file) => file.type.startsWith("image/"));
        if (images.length < files.length) {
            showNotice("Only image files can be uploaded; other files were skipped.", "error");
        }

        const added: ArtPiece[] = [];
        for (const file of images) {
            try {
                added.push({
                    id: crypto.randomUUID(),
                    title: file.name,
                    category: UPLOADS_CATEGORY,
                    imageUrl: await downscaleImageToDataUrl(file),
                    sourceUrl: null,
                });
            } catch {
                showNotice(`"${file.name}" could not be read.`, "error");
            }
        }
        if (added.length === 0) {
            return;
        }
        addUploads(added);
        setArtPage(0);
        showNotice(
            added.length === 1
                ? `Added "${added[0].title}". Click it (or drag it onto the binder) to place it.`
                : `Added ${added.length} images. Click one (or drag it onto the binder) to place it.`,
            "success"
        );
    }

    function handleRemoveUpload(artPiece: ArtPiece) {
        removeUpload(artPiece.id);
        showNotice(
            `Removed "${artPiece.title}" from your uploads. Anything already placed in the binder stays.`,
            "info",
            {label: "Undo", onAction: () => addUploads([artPiece])}
        );
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
                {CATEGORIES.map((category) => (
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
                        Upload images…
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleUploadChange}
                            className={styles.uploadInput}
                        />
                    </label>
                    <p className={styles.uploadHint}>
                        Images stay in this browser (never sent to a server) and are kept between visits.
                    </p>
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
                            {uploadIds.has(artPiece.id) && (
                                <button
                                    type="button"
                                    className={styles.removeUpload}
                                    onClick={() => handleRemoveUpload(artPiece)}
                                    title="Remove from your uploads"
                                    aria-label={`Remove ${artPiece.title} from your uploads`}
                                >
                                    ×
                                </button>
                            )}
                            <img
                                src={artPiece.imageUrl}
                                alt={artPiece.title}
                                className={styles.thumbnail}
                                role="button"
                                tabIndex={0}
                                draggable
                                onDragStart={(event) => setArtDragPayload(event, artPiece)}
                                onClick={() => placeArtInSelection(artPiece)}
                                onKeyDown={activateOnEnterOrSpace(() => placeArtInSelection(artPiece))}
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

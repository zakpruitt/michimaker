import type {ArtPiece} from "../../types/art";

const DATABASE_NAME = "michimaker";
const DATABASE_VERSION = 1;
const UPLOADS_STORE = "uploads";

export const UPLOADS_CATEGORY = "Uploads";

interface StoredUpload {
    id: string;
    title: string;
    imageUrl: string;
    createdAt: number;
}

let databasePromise: Promise<IDBDatabase> | null = null;
let lastStamp = 0;

export async function loadUploads(): Promise<ArtPiece[]> {
    const database = await openDatabase();
    const records = await request(
        database.transaction(UPLOADS_STORE, "readonly").objectStore(UPLOADS_STORE).getAll() as IDBRequest<StoredUpload[]>
    );
    return records.sort((a, b) => b.createdAt - a.createdAt).map(toArtPiece);
}

export async function saveUploads(pieces: ArtPiece[]): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(UPLOADS_STORE, "readwrite");
    const store = transaction.objectStore(UPLOADS_STORE);
    for (const piece of [...pieces].reverse()) {
        const record: StoredUpload = {id: piece.id, title: piece.title, imageUrl: piece.imageUrl, createdAt: nextStamp()};
        store.put(record);
    }
    await completion(transaction);
}

export async function deleteUpload(id: string): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(UPLOADS_STORE, "readwrite");
    transaction.objectStore(UPLOADS_STORE).delete(id);
    await completion(transaction);
}

function nextStamp(): number {
    lastStamp = Math.max(Date.now(), lastStamp + 1);
    return lastStamp;
}

function toArtPiece(record: StoredUpload): ArtPiece {
    return {
        id: record.id,
        title: record.title,
        category: UPLOADS_CATEGORY,
        imageUrl: record.imageUrl,
        sourceUrl: null,
    };
}

function openDatabase(): Promise<IDBDatabase> {
    databasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
        const opening = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        opening.onupgradeneeded = () => {
            if (!opening.result.objectStoreNames.contains(UPLOADS_STORE)) {
                opening.result.createObjectStore(UPLOADS_STORE, {keyPath: "id"});
            }
        };
        opening.onsuccess = () => resolve(opening.result);
        opening.onerror = () => reject(opening.error ?? new Error("Browser storage is unavailable."));
        opening.onblocked = () => reject(new Error("Browser storage is busy in another tab."));
    }).catch((error: unknown) => {
        databasePromise = null;
        throw error;
    });
    return databasePromise;
}

function request<T>(pending: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        pending.onsuccess = () => resolve(pending.result);
        pending.onerror = () => reject(pending.error ?? new Error("Browser storage request failed."));
    });
}

function completion(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Browser storage write failed."));
        transaction.onabort = () => reject(transaction.error ?? new Error("Browser storage write was aborted."));
    });
}

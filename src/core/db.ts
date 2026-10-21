/**
 * IndexedDB persistence. Two stores:
 *  - `blobs`: imported media files, artwork, photos, voice memos
 *  - `state`: JSON snapshots of the library and other records
 */
import { createStore, get, set, del, keys } from 'idb-keyval';

const blobStore = typeof indexedDB !== 'undefined' ? createStore('iport-blobs', 'blobs') : undefined;
const stateStore = typeof indexedDB !== 'undefined' ? createStore('iport-state', 'state') : undefined;

export async function putBlob(key: string, blob: Blob): Promise<void> {
  if (!blobStore) return;
  await set(key, blob, blobStore);
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  if (!blobStore) return undefined;
  return get<Blob>(key, blobStore);
}

export async function deleteBlob(key: string): Promise<void> {
  if (!blobStore) return;
  await del(key, blobStore);
}

export async function listBlobKeys(): Promise<string[]> {
  if (!blobStore) return [];
  return (await keys(blobStore)) as string[];
}

/** Async storage adapter for zustand's `persist` middleware. */
export const idbStateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (!stateStore) return null;
    return (await get<string>(name, stateStore)) ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (!stateStore) return;
    await set(name, value, stateStore);
  },
  removeItem: async (name: string): Promise<void> => {
    if (!stateStore) return;
    await del(name, stateStore);
  },
};

/** Object URLs for stored blobs, cached so the same blob is not re-read. */
const urlCache = new Map<string, Promise<string | null>>();

export function blobUrl(key: string): Promise<string | null> {
  let p = urlCache.get(key);
  if (!p) {
    p = getBlob(key).then((b) => (b ? URL.createObjectURL(b) : null));
    urlCache.set(key, p);
    // drop failed lookups so a later import can fill them
    p.then((u) => {
      if (!u) urlCache.delete(key);
    });
  }
  return p;
}

export function forgetBlobUrl(key: string): void {
  const p = urlCache.get(key);
  if (p) {
    p.then((u) => u && URL.revokeObjectURL(u));
    urlCache.delete(key);
  }
}

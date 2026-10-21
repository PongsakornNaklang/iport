import { useEffect, useState } from 'react';
import { blobUrl } from '../db';

/**
 * Artwork references are either remote URLs or `idb:<key>` pointers to a
 * blob in IndexedDB. Resolve either to something an <img> can show.
 */
export function resolveArtwork(ref: string | undefined): Promise<string | null> {
  if (!ref) return Promise.resolve(null);
  if (ref.startsWith('idb:')) return blobUrl(ref.slice(4));
  return Promise.resolve(ref);
}

const syncCache = new Map<string, string | null>();

export function useArtworkUrl(ref: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    !ref ? null : ref.startsWith('idb:') ? syncCache.get(ref) ?? null : ref,
  );
  useEffect(() => {
    let alive = true;
    if (!ref) {
      setUrl(null);
      return;
    }
    if (!ref.startsWith('idb:')) {
      setUrl(ref);
      return;
    }
    if (syncCache.has(ref)) setUrl(syncCache.get(ref)!);
    resolveArtwork(ref).then((u) => {
      syncCache.set(ref, u);
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [ref]);
  return url;
}

/** Same as useArtworkUrl but for many refs at once (Cover Flow, grids). */
export function useArtworkUrls(refs: (string | undefined)[]): (string | null)[] {
  const key = refs.join('|');
  const [urls, setUrls] = useState<(string | null)[]>(() =>
    refs.map((r) => (!r ? null : r.startsWith('idb:') ? syncCache.get(r) ?? null : r)),
  );
  useEffect(() => {
    let alive = true;
    Promise.all(refs.map((r) => resolveArtwork(r))).then((u) => {
      refs.forEach((r, i) => r && syncCache.set(r, u[i]));
      if (alive) setUrls(u);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

/**
 * Generic "no artwork" image: the grey music-note tile iTunes uses.
 * Returned as a data URL so it works in <img> and CSS backgrounds.
 */
export const DEFAULT_ARTWORK = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9e9ee"/><stop offset="1" stop-color="#c8c8d0"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><path d="M62 24v38.5a9 9 0 1 1-4-7.5V34l-20 5v28.5a9 9 0 1 1-4-7.5V30z" fill="#9a9aa5"/></svg>`,
)}`;

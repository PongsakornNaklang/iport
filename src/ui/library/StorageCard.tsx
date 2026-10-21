/** iTunes-style capacity bar: what the library uses in this browser. */
import { useEffect, useMemo, useState } from 'react';
import { getBlob } from '@/core/db';
import { useLibrary } from '@/core/library/store';
import { formatBytes } from '@/core/util/format';
import type { Track } from '@/core/types';
import { toast } from '../toast';

const COLORS = { audio: '#3d8bff', video: '#a463f2', photos: '#ff9f0a', other: '#ffd60a' };

interface Sizes {
  audio: number;
  video: number;
  photos: number;
}

async function blobSize(key: string): Promise<number> {
  try {
    return (await getBlob(key))?.size ?? 0;
  } catch {
    return 0;
  }
}

export function StorageCard() {
  const tracks = useLibrary((s) => s.tracks);
  const photos = useLibrary((s) => s.photos);
  const [sizes, setSizes] = useState<Sizes | null>(null);
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  const counts = useMemo(() => {
    const c = { songs: 0, videos: 0, podcasts: 0, books: 0, radio: 0 };
    for (const t of Object.values(tracks)) {
      if (t.mediaType === 'music') c.songs++;
      else if (t.mediaType === 'musicvideo' || t.mediaType === 'movie' || t.mediaType === 'tvshow') c.videos++;
      else if (t.mediaType === 'podcast') c.podcasts++;
      else if (t.mediaType === 'audiobook') c.books++;
      else if (t.mediaType === 'radio') c.radio++;
    }
    return c;
  }, [tracks]);

  // which blobs to measure (only changes when local files come or go)
  const localKey = useMemo(
    () =>
      Object.values(tracks)
        .filter((t) => t.source === 'local')
        .map((t) => `${t.ref}:${t.hasVideo ? 1 : 0}`)
        .sort()
        .join('|') +
      '#' +
      photos.map((p) => p.blobKey).join('|'),
    [tracks, photos],
  );

  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(async () => {
      const lib = useLibrary.getState();
      const local = Object.values(lib.tracks).filter((x: Track) => x.source === 'local');
      const s: Sizes = { audio: 0, video: 0, photos: 0 };
      for (const x of local) s[x.hasVideo ? 'video' : 'audio'] += await blobSize(x.ref);
      for (const p of lib.photos) s.photos += await blobSize(p.blobKey);
      if (!alive) return;
      setSizes(s);
      try {
        const e = await navigator.storage?.estimate?.();
        if (alive && e) setEst({ usage: e.usage ?? 0, quota: e.quota ?? 0 });
      } catch {
        /* unsupported */
      }
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [localKey]);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  const used = Math.max(est?.usage ?? 0, (sizes?.audio ?? 0) + (sizes?.video ?? 0) + (sizes?.photos ?? 0));
  const other = Math.max(0, used - (sizes?.audio ?? 0) - (sizes?.video ?? 0) - (sizes?.photos ?? 0));
  const segs = [
    { k: 'Audio', v: sizes?.audio ?? 0, c: COLORS.audio },
    { k: 'Video', v: sizes?.video ?? 0, c: COLORS.video },
    { k: 'Photos', v: sizes?.photos ?? 0, c: COLORS.photos },
    { k: 'Other', v: other, c: COLORS.other },
  ];
  const free = est ? Math.max(0, est.quota - used) : null;
  // Like iTunes' capacity bar, but on a scale that keeps a real library visible:
  // at least 1 GB (or the whole quota if smaller), growing with the library.
  const GB = 1024 ** 3;
  const scale = Math.max(used * 1.35, est?.quota ? Math.min(est.quota, GB) : GB, 1);

  const persist = async () => {
    try {
      const ok = await navigator.storage.persist();
      setPersisted(ok);
      toast(ok ? 'Your library will be kept even when storage is low' : 'Your browser declined — bookmark or install the site and try again');
    } catch {
      toast('Your browser doesn’t support this');
    }
  };

  return (
    <div className="lib-card lib-storage">
      <div className="lib-storage-top">
        <span className="ttl">On this browser</span>
        <span className="grow" />
        <span className="used">
          {sizes ? formatBytes(used) : '…'} used{free != null && est!.quota > 0 ? ` · ${formatBytes(free)} free` : ''}
        </span>
      </div>
      <div className="lib-capacity" role="img" aria-label={`Storage used: ${formatBytes(used)}`}>
        {segs.map((s) =>
          s.v > 0 ? <div key={s.k} style={{ width: `${(s.v / scale) * 100}%`, background: s.c }} title={`${s.k}: ${formatBytes(s.v)}`} /> : null,
        )}
      </div>
      <div className="lib-legend">
        {segs.map((s) => (
          <span key={s.k}>
            <i style={{ background: s.c }} />
            {s.k} <b>{formatBytes(s.v)}</b>
          </span>
        ))}
        {persisted === false && (
          <button className="btn ghost small" style={{ height: 18, marginLeft: 'auto' }} onClick={persist} title="Ask the browser not to clear your library when space is low">
            Keep offline
          </button>
        )}
      </div>
      <div className="lib-counts">
        <div>
          <b>{counts.songs}</b>
          <span>Songs</span>
        </div>
        <div>
          <b>{counts.videos}</b>
          <span>Videos</span>
        </div>
        <div>
          <b>{counts.podcasts}</b>
          <span>Podcasts</span>
        </div>
        <div>
          <b>{counts.radio}</b>
          <span>Radio</span>
        </div>
        <div>
          <b>{photos.length}</b>
          <span>Photos</span>
        </div>
      </div>
    </div>
  );
}

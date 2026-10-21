import { uid } from '../util/id';
import type { Track } from '../types';

export type NewTrack = Omit<Track, 'id' | 'addedAt' | 'playCount' | 'skipCount'> & Partial<Pick<Track, 'id' | 'addedAt'>>;

/** Fill in the bookkeeping fields every Track needs. Empty strings / NaN are dropped. */
export function makeTrack(t: NewTrack): Track {
  const out: Track = {
    ...t,
    id: t.id ?? uid('t'),
    addedAt: t.addedAt ?? Date.now(),
    playCount: 0,
    skipCount: 0,
    title: (t.title || '').trim() || 'Untitled',
    artist: (t.artist || '').trim() || 'Unknown Artist',
    album: (t.album || '').trim(),
  };
  for (const k of Object.keys(out) as (keyof Track)[]) {
    const v = out[k];
    if (v === undefined || v === '' || (typeof v === 'number' && !Number.isFinite(v))) delete out[k];
  }
  if (out.album === undefined) out.album = '';
  return out;
}

/** iTunes names one-off singles "<Title> - Single"; we do the same for streamed one-offs. */
export function singleAlbum(title: string): string {
  return `${title} - Single`;
}

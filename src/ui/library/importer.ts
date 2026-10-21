/**
 * Importing files from the user's computer (buttons, panel drop zone and the
 * global "drop anywhere" overlay all go through here). Media and photos use
 * the core importer; .vcf / .ics files become contacts / calendar events;
 * .lrc files attach synced lyrics to matching songs.
 */
import { create } from 'zustand';
import { importFiles } from '@/core/library/importLocal';
import { useLibrary } from '@/core/library/store';
import { parseVCards } from '@/core/sources/vcard';
import { parseIcs } from '@/core/sources/ics';
import type { MediaType } from '@/core/types';
import { toast } from '../toast';
import { getStickyPref } from './state';

export type VideoKind = Extract<MediaType, 'movie' | 'musicvideo' | 'tvshow'>;

export interface ImportSummary {
  songs: number;
  videos: number;
  photos: number;
  contacts: number;
  events: number;
  lyrics: number;
  skipped: string[];
}

interface ImportState {
  running: boolean;
  done: number;
  total: number;
  current?: string;
  origin?: 'panel' | 'global';
  last?: ImportSummary;
}

export const useImport = create<ImportState>(() => ({ running: false, done: 0, total: 0 }));

export const VIDEO_PREF_KEY = 'videoAs';

export function videoPref(): VideoKind {
  return getStickyPref<VideoKind>(VIDEO_PREF_KEY, 'movie');
}

let chain: Promise<unknown> = Promise.resolve();

export function describeSummary(s: ImportSummary): string {
  const parts: string[] = [];
  const n = (k: number, one: string, many = `${one}s`) => k && parts.push(`${k} ${k === 1 ? one : many}`);
  n(s.songs, 'song');
  n(s.videos, 'video');
  n(s.photos, 'photo');
  n(s.contacts, 'contact');
  n(s.events, 'event');
  n(s.lyrics, 'lyrics file', 'lyrics files');
  const added = parts.length ? `Added ${parts.join(', ')}` : 'Nothing was added';
  return s.skipped.length ? `${added} · skipped ${s.skipped.length} unsupported file${s.skipped.length === 1 ? '' : 's'}` : added;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+[\s.\-_)]+/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');

async function importLyrics(files: File[]): Promise<number> {
  const lib = useLibrary.getState();
  const tracks = Object.values(lib.tracks);
  let n = 0;
  for (const f of files) {
    const text = await f.text();
    const key = norm(f.name);
    // match "Artist - Title.lrc" or "Title.lrc"
    const t =
      tracks.find((x) => norm(`${x.artist} - ${x.title}`) === key) ??
      tracks.find((x) => norm(x.title) === key) ??
      tracks.find((x) => x.source === 'local' && key.length > 3 && norm(x.title).includes(key));
    if (!t) continue;
    lib.updateTrack(t.id, { syncedLyrics: text, lyrics: t.lyrics || text.replace(/^\[[^\]]*\]\s?/gm, '').trim() });
    n++;
  }
  return n;
}

/** Import any mix of files; serialised so two drops don't interleave. */
export function runImport(files: File[], opts: { videoAs?: VideoKind; origin?: 'panel' | 'global' } = {}): Promise<ImportSummary> {
  const p = chain.then(() => doImport(files, opts));
  chain = p.catch(() => undefined);
  return p;
}

async function doImport(files: File[], opts: { videoAs?: VideoKind; origin?: 'panel' | 'global' }): Promise<ImportSummary> {
  const summary: ImportSummary = { songs: 0, videos: 0, photos: 0, contacts: 0, events: 0, lyrics: 0, skipped: [] };
  const media: File[] = [];
  const vcf: File[] = [];
  const ics: File[] = [];
  const lrc: File[] = [];
  for (const f of files) {
    if (/\.vcf$|\.vcard$/i.test(f.name) || f.type === 'text/vcard' || f.type === 'text/x-vcard') vcf.push(f);
    else if (/\.ics$|\.ical$/i.test(f.name) || f.type === 'text/calendar') ics.push(f);
    else if (/\.lrc$/i.test(f.name)) lrc.push(f);
    else media.push(f);
  }
  useImport.setState({ running: true, done: 0, total: files.length, current: undefined, origin: opts.origin ?? 'panel' });
  try {
    const lib = useLibrary.getState();
    for (const f of vcf) {
      try {
        for (const c of parseVCards(await f.text())) {
          lib.upsertContact(c);
          summary.contacts++;
        }
      } catch {
        summary.skipped.push(f.name);
      }
    }
    for (const f of ics) {
      try {
        for (const e of parseIcs(await f.text())) {
          lib.upsertEvent(e);
          summary.events++;
        }
      } catch {
        summary.skipped.push(f.name);
      }
    }
    const offset = vcf.length + ics.length;
    if (media.length) {
      const res = await importFiles(
        media,
        (p) => useImport.setState({ done: offset + p.done, current: p.current }),
        { videoAs: opts.videoAs ?? videoPref() },
      );
      for (const t of res.tracks) {
        if (t.hasVideo) summary.videos++;
        else summary.songs++;
      }
      summary.photos = res.photos.length;
      summary.skipped.push(...res.skipped);
    }
    // lyrics last, so they can match songs imported in the same drop
    if (lrc.length) summary.lyrics = await importLyrics(lrc);
  } finally {
    useImport.setState({ running: false, done: files.length, current: undefined, last: summary });
  }
  return summary;
}

/** Import + toast (used by the global drop overlay). */
export async function importWithToast(files: File[], origin: 'panel' | 'global' = 'global'): Promise<void> {
  if (!files.length) return;
  toast(`Importing ${files.length} file${files.length === 1 ? '' : 's'}…`, 1800);
  const s = await runImport(files, { origin });
  toast(describeSummary(s), 4000);
}

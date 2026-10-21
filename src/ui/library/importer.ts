/**
 * Importing files from the user's computer (buttons, panel drop zone and the
 * global "drop anywhere" overlay all go through here). Media and photos use
 * the core importer; .vcf / .ics files become contacts / calendar events;
 * .lrc files attach synced lyrics to matching songs.
 */
import { create } from 'zustand';
import { classifyFile, importFiles } from '@/core/library/importLocal';
import { useLibrary } from '@/core/library/store';
import { contactKey, parseVCards, type ParsedContact } from '@/core/sources/vcard';
import { eventKey, parseIcs, type ParsedEvent } from '@/core/sources/ics';
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
  /** files that were already imported earlier (same name, size and date) */
  duplicates: number;
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
  let out = parts.length ? `Added ${parts.join(', ')}` : s.duplicates ? 'Everything is already in your library' : 'Nothing was added';
  if (s.duplicates && parts.length) out += ` · ${s.duplicates} already in your library`;
  if (s.skipped.length) out += ` · skipped ${s.skipped.length} unsupported file${s.skipped.length === 1 ? '' : 's'}`;
  return out;
}

// ------------------------------------------------------------------ duplicate detection
// iTunes doesn't add a file twice. Files carry no stable path in the browser,
// so we remember name + size + modification time of everything imported and
// map it to the library item it became (forgotten once that item is deleted).

const FP_KEY = 'iport.lib.fingerprints';

export function fingerprint(f: File): string {
  const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
  const name = rel ? rel.split('/').pop()! : f.name;
  return `${name}|${f.size}|${f.lastModified}`;
}

function loadPrints(): Record<string, string> {
  try {
    const raw = localStorage.getItem(FP_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return v && typeof v === 'object' ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function savePrints(m: Record<string, string>): void {
  try {
    localStorage.setItem(FP_KEY, JSON.stringify(m));
  } catch {
    /* quota / private mode: duplicates are merely not detected */
  }
}

/** Fingerprints whose library item still exists (prunes deleted ones). */
function livePrints(): Record<string, string> {
  const lib = useLibrary.getState();
  const photoIds = new Set(lib.photos.map((p) => p.id));
  const out: Record<string, string> = {};
  for (const [fp, id] of Object.entries(loadPrints())) if (lib.tracks[id] || photoIds.has(id)) out[fp] = id;
  return out;
}

/**
 * Pair every imported file with the item it produced. importFiles keeps file
 * order and lists failures by name, so walk the files and skip those.
 */
function pairResults(files: File[], res: { tracks: { id: string }[]; photos: { id: string }[]; skipped: string[] }): [string, string][] {
  const failed = new Map<string, number>();
  for (const n of res.skipped) failed.set(n, (failed.get(n) ?? 0) + 1);
  const pairs: [string, string][] = [];
  let ti = 0;
  let pi = 0;
  for (const f of files) {
    const kind = classifyFile(f);
    if (!kind) continue;
    const k = failed.get(f.name) ?? 0;
    if (k > 0) {
      failed.set(f.name, k - 1);
      continue;
    }
    const item = kind === 'image' ? res.photos[pi++] : res.tracks[ti++];
    if (item) pairs.push([fingerprint(f), item.id]);
  }
  return pairs;
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

/** Add parsed contacts, skipping people who are already in the library. */
export function addContacts(list: ParsedContact[]): { added: number; existing: number } {
  const lib = useLibrary.getState();
  const have = new Set(lib.contacts.map(contactKey));
  let added = 0;
  for (const c of list) {
    const k = contactKey(c);
    if (have.has(k)) continue;
    have.add(k);
    lib.upsertContact(c);
    added++;
  }
  return { added, existing: list.length - added };
}

/** Add parsed events, skipping ones that are already in the library. */
export function addEvents(list: ParsedEvent[]): { added: number; existing: number } {
  const lib = useLibrary.getState();
  const have = new Set(lib.events.map(eventKey));
  let added = 0;
  for (const e of list) {
    const k = eventKey(e);
    if (have.has(k)) continue;
    have.add(k);
    lib.upsertEvent(e);
    added++;
  }
  return { added, existing: list.length - added };
}

/** Import any mix of files; serialised so two drops don't interleave. */
export function runImport(files: File[], opts: { videoAs?: VideoKind; origin?: 'panel' | 'global' } = {}): Promise<ImportSummary> {
  const p = chain.then(() => doImport(files, opts));
  chain = p.catch(() => undefined);
  return p;
}

async function doImport(files: File[], opts: { videoAs?: VideoKind; origin?: 'panel' | 'global' }): Promise<ImportSummary> {
  const summary: ImportSummary = { songs: 0, videos: 0, photos: 0, contacts: 0, events: 0, lyrics: 0, duplicates: 0, skipped: [] };
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
    for (const f of vcf) {
      try {
        const r = addContacts(parseVCards(await f.text()));
        summary.contacts += r.added;
        summary.duplicates += r.existing;
      } catch {
        summary.skipped.push(f.name);
      }
    }
    for (const f of ics) {
      try {
        const r = addEvents(parseIcs(await f.text()));
        summary.events += r.added;
        summary.duplicates += r.existing;
      } catch {
        summary.skipped.push(f.name);
      }
    }
    const prints = livePrints();
    const fresh = media.filter((f) => !(classifyFile(f) && prints[fingerprint(f)]));
    const dupFiles = media.length - fresh.length;
    summary.duplicates += dupFiles;
    const offset = vcf.length + ics.length + dupFiles;
    if (dupFiles) useImport.setState({ done: offset });
    if (fresh.length) {
      const res = await importFiles(
        fresh,
        (p) => useImport.setState({ done: offset + p.done, current: p.current }),
        { videoAs: opts.videoAs ?? videoPref() },
      );
      for (const [fp, id] of pairResults(fresh, res)) prints[fp] = id;
      savePrints(prints);
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

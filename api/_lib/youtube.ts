/**
 * YouTube page scraping helpers (pure, unit-tested with fixtures).
 * The search / playlist pages embed their data as `var ytInitialData = {…}`.
 */
import { collect, dig, extractJsonAfter } from './scrape.js';

export interface YtItem {
  id: string;
  title: string;
  channel?: string;
  /** "3:33" as shown by YouTube; undefined for live streams */
  duration?: string;
  seconds?: number;
  thumbnail: string;
}

export interface YtPlaylistPage {
  id: string;
  title: string;
  author?: string;
  items: YtItem[];
  continuation?: string;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function extractInitialData(html: string): unknown | null {
  return (
    extractJsonAfter(html, /var\s+ytInitialData\s*=\s*/) ??
    extractJsonAfter(html, /window\[["']ytInitialData["']\]\s*=\s*/) ??
    extractJsonAfter(html, /ytInitialData\s*=\s*/)
  );
}

/** ytcfg values needed for continuation requests. */
export function extractClientVersion(html: string): string | undefined {
  return /"INNERTUBE_CLIENT_VERSION"\s*:\s*"([\d.]+)"/.exec(html)?.[1] ?? /"clientVersion"\s*:\s*"([\d.]+)"/.exec(html)?.[1];
}

/** YouTube text objects: { simpleText } | { runs: [{ text }] } | { content } */
export function ytText(t: unknown): string | undefined {
  if (!t) return undefined;
  if (typeof t === 'string') return t;
  const o = t as { simpleText?: string; runs?: { text?: string }[]; content?: string };
  if (typeof o.simpleText === 'string') return o.simpleText;
  if (Array.isArray(o.runs)) return o.runs.map((r) => r.text ?? '').join('');
  if (typeof o.content === 'string') return o.content;
  return undefined;
}

export function clockToSeconds(s: string | undefined): number | undefined {
  if (!s || !/^\d+(:\d{1,2}){1,2}$/.test(s.trim())) return undefined;
  return s
    .trim()
    .split(':')
    .reduce((a, p) => a * 60 + parseInt(p, 10), 0);
}

export function secondsToClock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, '0');
  return h ? `${h}:${m.toString().padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function thumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function fromVideoRenderer(v: Record<string, unknown>): YtItem | null {
  const id = v.videoId;
  if (typeof id !== 'string' || !VIDEO_ID.test(id)) return null;
  const title = ytText(v.title) ?? ytText(dig(v, 'headline'));
  if (!title) return null;
  const channel = ytText(v.ownerText) ?? ytText(v.longBylineText) ?? ytText(v.shortBylineText);
  let duration = ytText(v.lengthText);
  let seconds = typeof v.lengthSeconds === 'string' || typeof v.lengthSeconds === 'number' ? Number(v.lengthSeconds) || undefined : undefined;
  if (!duration && seconds) duration = secondsToClock(seconds);
  if (!seconds) seconds = clockToSeconds(duration);
  if (duration && !seconds) duration = undefined; // "LIVE" etc.
  return { id, title, channel, duration, seconds, thumbnail: thumb(id) };
}

/** 2024+ "lockup" view models used on some list pages. */
function fromLockup(l: Record<string, unknown>): YtItem | null {
  if (l.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO') return null;
  const id = l.contentId;
  if (typeof id !== 'string' || !VIDEO_ID.test(id)) return null;
  const meta = dig(l, 'metadata', 'lockupMetadataViewModel');
  const title = ytText(dig(meta, 'title'));
  if (!title) return null;
  const rows = dig(meta, 'metadata', 'contentMetadataViewModel', 'metadataRows');
  const channel = Array.isArray(rows) ? ytText(dig(rows[0], 'metadataParts', 0, 'text')) : undefined;
  let duration: string | undefined;
  for (const b of collect(l.contentImage, ['thumbnailBadgeViewModel'], 10)) {
    const t = typeof b.value.text === 'string' ? b.value.text : undefined;
    if (t && /^\d+(:\d{2}){1,2}$/.test(t)) duration = t;
  }
  return { id, title, channel, duration, seconds: clockToSeconds(duration), thumbnail: thumb(id) };
}

const UNAVAILABLE = /^\[(deleted|private) video\]$/i;

function itemsFrom(root: unknown, keys: string[], limit: number): YtItem[] {
  const seen = new Set<string>();
  const out: YtItem[] = [];
  for (const { key, value } of collect(root, [...keys, 'lockupViewModel'], limit * 3)) {
    if (key === 'playlistVideoRenderer' && value.isPlayable === false) continue;
    const item = key === 'lockupViewModel' ? fromLockup(value) : fromVideoRenderer(value);
    if (!item || seen.has(item.id) || UNAVAILABLE.test(item.title)) continue;
    seen.add(item.id);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

/** Search results page → videos (shelves of shorts / channels / playlists are ignored). */
export function parseSearchResults(data: unknown, limit = 30): YtItem[] {
  const primary = dig(data, 'contents', 'twoColumnSearchResultsRenderer', 'primaryContents') ?? data;
  return itemsFrom(primary, ['videoRenderer'], limit);
}

export function findContinuation(data: unknown): string | undefined {
  for (const { value } of collect(data, ['continuationItemRenderer'], 5)) {
    const token =
      dig(value, 'continuationEndpoint', 'continuationCommand', 'token') ??
      dig(value, 'continuationEndpoint', 'commandExecutorCommand', 'commands', 1, 'continuationCommand', 'token');
    if (typeof token === 'string') return token;
  }
  return undefined;
}

export function parsePlaylistPage(data: unknown, listId: string, limit = 500): YtPlaylistPage {
  const title =
    ytText(dig(data, 'metadata', 'playlistMetadataRenderer', 'title')) ??
    ytText(dig(data, 'header', 'playlistHeaderRenderer', 'title')) ??
    ytText(dig(data, 'header', 'pageHeaderRenderer', 'pageTitle')) ??
    ytText(dig(data, 'microformat', 'microformatDataRenderer', 'title')) ??
    'YouTube Playlist';
  const author =
    ytText(dig(data, 'header', 'playlistHeaderRenderer', 'ownerText')) ??
    ytText(collect(dig(data, 'sidebar'), ['videoOwnerRenderer'], 1)[0]?.value.title) ??
    undefined;
  const items = itemsFrom(dig(data, 'contents') ?? data, ['playlistVideoRenderer', 'playlistPanelVideoRenderer'], limit);
  return { id: listId, title, author, items, continuation: findContinuation(dig(data, 'contents') ?? data) };
}

/** Items from a `youtubei/v1/browse` continuation response. */
export function parseContinuation(data: unknown, limit = 200): { items: YtItem[]; continuation?: string } {
  const actions = dig(data, 'onResponseReceivedActions') ?? data;
  return { items: itemsFrom(actions, ['playlistVideoRenderer'], limit), continuation: findContinuation(actions) };
}

/**
 * Importing files from the user's computer: audio, video and images.
 * Media blobs are copied into IndexedDB so the library survives reloads.
 */
import { putBlob } from '../db';
import { uid, hash } from '../util/id';
import type { MediaType, Photo, Track } from '../types';
import { useLibrary } from './store';

const AUDIO_EXT = /\.(mp3|m4a|aac|mp4a|ogg|oga|opus|wav|flac|webm|weba|aif|aiff|caf)$/i;
const VIDEO_EXT = /\.(mp4|m4v|mov|webm|ogv|mkv)$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|heic)$/i;

export function classifyFile(f: File): 'audio' | 'video' | 'image' | null {
  const t = f.type;
  if (t.startsWith('audio/')) return 'audio';
  if (t.startsWith('video/')) {
    // .webm and .mp4 audio-only files often report video/*; treat m4a as audio
    return 'video';
  }
  if (t.startsWith('image/')) return 'image';
  if (AUDIO_EXT.test(f.name)) return 'audio';
  if (VIDEO_EXT.test(f.name)) return 'video';
  if (IMAGE_EXT.test(f.name)) return 'image';
  return null;
}

export interface ImportProgress {
  done: number;
  total: number;
  current?: string;
}

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

/** "01 - Artist - Title" / "Artist - Title" → best-effort tags from a file name. */
export function tagsFromFileName(name: string): { title: string; artist?: string; trackNo?: number } {
  let s = baseName(name).replace(/_/g, ' ').trim();
  let trackNo: number | undefined;
  const m = s.match(/^(\d{1,3})[\s.\-_)]+(.*)$/);
  if (m) {
    trackNo = parseInt(m[1], 10);
    s = m[2];
  }
  const parts = s.split(/\s+-\s+/);
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim(), trackNo };
  return { title: s, trackNo };
}

async function mediaDuration(blob: Blob, kind: 'audio' | 'video'): Promise<{ duration: number; width?: number; height?: number }> {
  return new Promise((resolve) => {
    const el = document.createElement(kind === 'video' ? 'video' : 'audio') as HTMLMediaElement;
    const url = URL.createObjectURL(blob);
    const done = (d: number) => {
      const v = el as HTMLVideoElement;
      resolve({ duration: isFinite(d) ? d : 0, width: v.videoWidth || undefined, height: v.videoHeight || undefined });
      URL.revokeObjectURL(url);
    };
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(el.duration);
    el.onerror = () => done(0);
    setTimeout(() => done(0), 8000);
    el.src = url;
  });
}

async function importAudioOrVideo(file: File, kind: 'audio' | 'video'): Promise<Track> {
  const id = uid('t');
  const blobKey = `media:${id}`;
  await putBlob(blobKey, file);

  const fromName = tagsFromFileName(file.name);
  const track: Track = {
    id,
    source: 'local',
    ref: blobKey,
    mediaType: kind === 'video' ? 'movie' : 'music',
    hasVideo: kind === 'video',
    title: fromName.title,
    artist: fromName.artist ?? 'Unknown Artist',
    album: 'Unknown Album',
    trackNo: fromName.trackNo,
    addedAt: Date.now(),
    playCount: 0,
    skipCount: 0,
  };

  try {
    const { parseBlob } = await import('music-metadata');
    const meta = await parseBlob(file, { duration: false, skipCovers: false });
    const c = meta.common;
    if (c.title) track.title = c.title;
    if (c.artist) track.artist = c.artist;
    if (c.albumartist) track.albumArtist = c.albumartist;
    if (c.album) track.album = c.album;
    if (c.genre?.[0]) track.genre = c.genre[0];
    if (c.composer?.[0]) track.composer = c.composer[0];
    if (c.year) track.year = c.year;
    if (c.track?.no) track.trackNo = c.track.no;
    if (c.disk?.no) track.discNo = c.disk.no;
    if (c.compilation) track.compilation = true;
    if (meta.format.duration) track.duration = meta.format.duration;
    const lyr = c.lyrics?.[0];
    if (lyr) track.lyrics = typeof lyr === 'string' ? lyr : (lyr as { text?: string }).text;
    // iTunes media kind atom (stik): 1 music, 2 audiobook, 6 music video, 9 movie, 10 tv, 21 podcast
    const stik = (meta.native?.iTunes ?? []).find((t) => t.id === 'stik')?.value as number | undefined;
    const kindMap: Record<number, MediaType> = { 1: 'music', 2: 'audiobook', 6: 'musicvideo', 9: 'movie', 10: 'tvshow', 21: 'podcast' };
    if (stik && kindMap[stik]) track.mediaType = kindMap[stik];
    else if (/audiobook/i.test(c.genre?.[0] ?? '') || /\.m4b$/i.test(file.name)) track.mediaType = 'audiobook';
    else if (/podcast/i.test(c.genre?.[0] ?? '')) track.mediaType = 'podcast';
    if (track.mediaType === 'podcast') track.show = c.album || c.artist;

    const pic = c.picture?.[0];
    if (pic) {
      const artKey = `art:${hash(`${track.albumArtist || track.artist}::${track.album}::${pic.data.length}`)}`;
      await putBlob(artKey, new Blob([pic.data as BlobPart], { type: pic.format || 'image/jpeg' }));
      track.artwork = `idb:${artKey}`;
    }
  } catch (err) {
    console.warn('[import] could not read tags for', file.name, err);
  }

  if (!track.duration || (kind === 'video' && !track.duration)) {
    const d = await mediaDuration(file, kind);
    track.duration = d.duration;
  }
  if (kind === 'video' && track.mediaType === 'music') track.mediaType = 'musicvideo';
  return track;
}

async function importImage(file: File): Promise<Photo> {
  const id = uid('ph');
  const blobKey = `photo:${id}`;
  await putBlob(blobKey, file);
  let width = 0;
  let height = 0;
  try {
    const bmp = await createImageBitmap(file);
    width = bmp.width;
    height = bmp.height;
    bmp.close();
  } catch {
    /* unsupported image type (e.g. HEIC) — still stored */
  }
  const folder = (file as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/').slice(-2, -1)[0];
  return { id, name: baseName(file.name), blobKey, width, height, addedAt: Date.now(), album: folder || undefined };
}

/**
 * Import any mix of files. Returns counts per kind.
 * `onProgress` is called after every file.
 */
export async function importFiles(
  files: File[] | FileList,
  onProgress?: (p: ImportProgress) => void,
  opts: { videoAs?: MediaType } = {},
): Promise<{ tracks: Track[]; photos: Photo[]; skipped: string[] }> {
  const list = Array.from(files);
  const tracks: Track[] = [];
  const pending: Track[] = [];
  const photos: Photo[] = [];
  const skipped: string[] = [];
  let done = 0;
  for (const f of list) {
    onProgress?.({ done, total: list.length, current: f.name });
    const kind = classifyFile(f);
    try {
      if (kind === 'audio' || kind === 'video') {
        const t = await importAudioOrVideo(f, kind);
        if (kind === 'video' && opts.videoAs) t.mediaType = opts.videoAs;
        tracks.push(t);
        pending.push(t);
      } else if (kind === 'image') photos.push(await importImage(f));
      else skipped.push(f.name);
    } catch (e) {
      console.warn('[import] failed', f.name, e);
      skipped.push(f.name);
    }
    done++;
    // commit in batches so the UI updates while a big folder imports
    if (pending.length && done % 10 === 0) {
      useLibrary.getState().addTracks(pending.splice(0));
    }
  }
  const lib = useLibrary.getState();
  if (pending.length) lib.addTracks(pending);
  if (photos.length) lib.addPhotos(photos);
  onProgress?.({ done, total: list.length });
  return { tracks, photos, skipped };
}

import { useEffect, useState } from 'react';
import { directTrack } from '@/core/sources/links';
import { normalizeUrl } from '@/core/sources/net';
import type { MediaType } from '@/core/types';
import { IconPlay, IconPlus } from '../../icons';
import type { Intent } from '../AddMusicTab';
import { addToLibrary, MEDIA_LABEL } from '../state';
import { Notice } from '../ui';

const KINDS: MediaType[] = ['music', 'musicvideo', 'movie', 'tvshow', 'podcast', 'audiobook', 'radio'];
const VIDEO_KINDS = new Set<MediaType>(['musicvideo', 'movie', 'tvshow']);

export function LinkSource({ intent }: { intent: Extract<Intent, { kind: 'link' }> | null }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [kind, setKind] = useState<MediaType>('music');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (intent) setUrl(intent.url);
  }, [intent]);

  const submit = (play: boolean) => {
    const u = normalizeUrl(url);
    if (!u) {
      setError('Enter a web address that starts with https://');
      return;
    }
    setError(null);
    const isVideoFile = /\.(mp4|m4v|mov|webm|ogv)(\?|#|$)/i.test(u);
    const t = directTrack(u, {
      title,
      artist,
      album,
      mediaType: kind,
      video: VIDEO_KINDS.has(kind) || (kind === 'podcast' && isVideoFile),
    });
    addToLibrary([t], { play });
    setUrl('');
    setTitle('');
    setArtist('');
    setAlbum('');
  };

  const insecure = /^http:\/\//i.test(url.trim()) && typeof location !== 'undefined' && location.protocol === 'https:';

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      <div className="field">
        <label>Address</label>
        <input className="input" type="url" inputMode="url" required value={url} placeholder="https://example.com/song.mp3" spellCheck={false} onChange={(e) => setUrl(e.target.value)} />
      </div>
      {insecure && <div className="lib-notice info">This is an http:// address. iPort will try the secure https:// version, which some servers don’t offer.</div>}
      <div className="lib-grid2">
        <div className="field">
          <label>Title</label>
          <input className="input" value={title} placeholder="From the file name" onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Artist</label>
          <input className="input" value={artist} placeholder="Optional" onChange={(e) => setArtist(e.target.value)} />
        </div>
      </div>
      <div className="lib-grid2">
        <div className="field">
          <label>Album</label>
          <input className="input" value={album} placeholder="Optional" onChange={(e) => setAlbum(e.target.value)} />
        </div>
        <div className="field">
          <label>Kind</label>
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value as MediaType)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k === 'radio' ? 'Radio Stream' : MEDIA_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Notice error={error} />
      <div className="lib-row-flex">
        <button className="btn primary" type="submit" disabled={!url.trim()}>
          <IconPlus /> Add to Library
        </button>
        <button className="btn" type="button" disabled={!url.trim()} onClick={() => submit(true)}>
          <IconPlay width={12} height={12} /> Add & Play
        </button>
      </div>
      <p className="lib-hint">
        Works with direct links to MP3, AAC/M4A, OGG/Opus, WAV, FLAC, MP4 or WebM files, and Icecast/Shoutcast radio streams. The file must allow streaming from other sites (most do).
      </p>
    </form>
  );
}

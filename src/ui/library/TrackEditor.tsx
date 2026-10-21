/** "Get Info" sheet: edit tags, media kind, artwork and lyrics of one track. */
import { useRef, useState } from 'react';
import { Artwork } from '@/core/library/Artwork';
import { putBlob } from '@/core/db';
import { useLibrary } from '@/core/library/store';
import { uid } from '@/core/util/id';
import { formatTime } from '@/core/util/format';
import type { MediaType, Track } from '@/core/types';
import { toast } from '../toast';
import { IconStar } from './icons';
import { MEDIA_LABEL, SOURCE_LABEL } from './state';
import { Sheet } from './ui';

const KINDS: MediaType[] = ['music', 'musicvideo', 'movie', 'tvshow', 'podcast', 'audiobook', 'radio', 'voicememo'];

type Draft = Pick<Track, 'title' | 'artist' | 'album' | 'mediaType'> & {
  albumArtist: string;
  genre: string;
  composer: string;
  year: string;
  trackNo: string;
  discNo: string;
  show: string;
  description: string;
  lyrics: string;
  compilation: boolean;
  rating: number;
  artwork?: string;
};

function draftOf(t: Track): Draft {
  return {
    title: t.title,
    artist: t.artist,
    album: t.album,
    mediaType: t.mediaType,
    albumArtist: t.albumArtist ?? '',
    genre: t.genre ?? '',
    composer: t.composer ?? '',
    year: t.year ? String(t.year) : '',
    trackNo: t.trackNo ? String(t.trackNo) : '',
    discNo: t.discNo ? String(t.discNo) : '',
    show: t.show ?? '',
    description: t.description ?? '',
    lyrics: t.lyrics ?? '',
    compilation: !!t.compilation,
    rating: t.rating ?? 0,
    artwork: t.artwork,
  };
}

const num = (s: string) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function TrackEditor({ track, onClose }: { track: Track; onClose: () => void }) {
  const [d, setD] = useState<Draft>(() => draftOf(track));
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const save = () => {
    useLibrary.getState().updateTrack(track.id, {
      title: d.title.trim() || track.title,
      artist: d.artist.trim() || 'Unknown Artist',
      album: d.album.trim(),
      mediaType: d.mediaType,
      albumArtist: d.albumArtist.trim() || undefined,
      genre: d.genre.trim() || undefined,
      composer: d.composer.trim() || undefined,
      year: num(d.year),
      trackNo: num(d.trackNo),
      discNo: num(d.discNo),
      show: d.show.trim() || undefined,
      description: d.description.trim() || undefined,
      lyrics: d.lyrics.trim() || undefined,
      compilation: d.compilation || undefined,
      rating: d.rating || undefined,
      artwork: d.artwork,
    });
    toast('Saved');
    onClose();
  };

  const pickArt = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast('Choose an image file');
      return;
    }
    const key = `art:custom-${uid()}`;
    await putBlob(key, f);
    set('artwork', `idb:${key}`);
  };

  const showShow = d.mediaType === 'podcast' || d.mediaType === 'tvshow' || d.mediaType === 'audiobook';

  return (
    <Sheet
      title="Get Info"
      onClose={onClose}
      actions={
        <button className="btn small primary" onClick={save}>
          Save
        </button>
      }
    >
      <div className="lib-editor-art">
        <Artwork src={d.artwork} size={96} radius={8} />
        <div className="btns">
          <div style={{ fontWeight: 600, fontSize: 14 }}>{track.title}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {SOURCE_LABEL[track.source]}
            {track.duration ? ` · ${formatTime(track.duration)}` : ''}
          </div>
          <div className="lib-row-flex">
            <button className="btn small" onClick={() => fileRef.current?.click()}>
              Change artwork…
            </button>
            {d.artwork && (
              <button className="btn small ghost" onClick={() => set('artwork', undefined)}>
                Remove
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void pickArt(e.target.files?.[0])} />
        </div>
      </div>

      <div className="field">
        <label>Title</label>
        <input className="input" value={d.title} onChange={(e) => set('title', e.target.value)} />
      </div>
      <div className="lib-grid2">
        <div className="field">
          <label>Artist</label>
          <input className="input" value={d.artist} onChange={(e) => set('artist', e.target.value)} />
        </div>
        <div className="field">
          <label>Album Artist</label>
          <input className="input" value={d.albumArtist} placeholder={d.artist} onChange={(e) => set('albumArtist', e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Album</label>
        <input className="input" value={d.album} onChange={(e) => set('album', e.target.value)} />
      </div>
      <div className="lib-grid2">
        <div className="field">
          <label>Genre</label>
          <input className="input" value={d.genre} list="lib-genres" onChange={(e) => set('genre', e.target.value)} />
        </div>
        <div className="field">
          <label>Composer</label>
          <input className="input" value={d.composer} onChange={(e) => set('composer', e.target.value)} />
        </div>
      </div>
      <datalist id="lib-genres">
        {['Pop', 'Rock', 'Alternative', 'Hip Hop', 'R&B/Soul', 'Electronic', 'Dance', 'Jazz', 'Classical', 'Country', 'Folk', 'Indie', 'Metal', 'Reggae', 'Soundtrack', 'Thai Pop', 'Luk Thung', 'K-Pop', 'J-Pop', 'Podcast', 'Audiobook'].map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <div className="lib-grid3">
        <div className="field">
          <label>Year</label>
          <input className="input" inputMode="numeric" value={d.year} onChange={(e) => set('year', e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </div>
        <div className="field">
          <label>Track #</label>
          <input className="input" inputMode="numeric" value={d.trackNo} onChange={(e) => set('trackNo', e.target.value.replace(/\D/g, '').slice(0, 3))} />
        </div>
        <div className="field">
          <label>Disc #</label>
          <input className="input" inputMode="numeric" value={d.discNo} onChange={(e) => set('discNo', e.target.value.replace(/\D/g, '').slice(0, 2))} />
        </div>
      </div>
      <div className="lib-grid2">
        <div className="field">
          <label>Media Kind</label>
          <select className="select" value={d.mediaType} onChange={(e) => set('mediaType', e.target.value as MediaType)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {MEDIA_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Rating</label>
          <div className="lib-stars" style={{ height: 36, alignItems: 'center' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={n <= d.rating ? 'on' : ''} onClick={() => set('rating', d.rating === n ? 0 : n)} aria-label={`${n} stars`}>
                <IconStar filled={n <= d.rating} />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="lib-switch-row">
        <span>
          Part of a compilation
          <span className="tiny" style={{ display: 'block' }}>
            Shows under Compilations on the iPod
          </span>
        </span>
        <button className={`switch ${d.compilation ? 'on' : ''}`} role="switch" aria-checked={d.compilation} aria-label="Part of a compilation" onClick={() => set('compilation', !d.compilation)} />
      </div>
      {showShow && (
        <>
          <div className="field">
            <label>{d.mediaType === 'tvshow' ? 'Show' : d.mediaType === 'audiobook' ? 'Book' : 'Podcast'}</label>
            <input className="input" value={d.show} onChange={(e) => set('show', e.target.value)} />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea className="input" rows={3} value={d.description} onChange={(e) => set('description', e.target.value)} />
          </div>
        </>
      )}
      <div className="field">
        <label>Lyrics</label>
        <textarea className="input" rows={6} value={d.lyrics} placeholder="Paste the lyrics — they appear on the iPod’s Now Playing screen" onChange={(e) => set('lyrics', e.target.value)} />
      </div>

      <div className="section-title" style={{ marginTop: 16 }}>
        File
      </div>
      <dl className="lib-kv">
        <dt>Source</dt>
        <dd>{SOURCE_LABEL[track.source]}</dd>
        <dt>{track.source === 'local' ? 'Stored as' : track.source === 'youtube' ? 'Video ID' : 'Address'}</dt>
        <dd>
          {/^https?:\/\//.test(track.ref) ? (
            <a href={track.ref} target="_blank" rel="noreferrer noopener">
              {track.ref.length > 80 ? `${track.ref.slice(0, 80)}…` : track.ref}
            </a>
          ) : track.source === 'youtube' ? (
            <a href={`https://www.youtube.com/watch?v=${track.ref}`} target="_blank" rel="noreferrer noopener">
              {track.ref}
            </a>
          ) : (
            'Private copy in this browser'
          )}
        </dd>
        <dt>Added</dt>
        <dd>{new Date(track.addedAt).toLocaleString()}</dd>
        <dt>Plays</dt>
        <dd>
          {track.playCount}
          {track.lastPlayed ? ` · last ${new Date(track.lastPlayed).toLocaleDateString()}` : ''}
        </dd>
      </dl>
    </Sheet>
  );
}

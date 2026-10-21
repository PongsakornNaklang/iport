import { useState } from 'react';
import { friendlyError } from '@/core/sources/net';
import { soundcloudSearch, soundcloudTracks } from '@/core/sources/soundcloud';
import { player } from '@/core/player/player';
import type { Track } from '@/core/types';
import { formatTime } from '@/core/util/format';
import { IconLink } from '../../icons';
import { addToLibrary, isInLibrary, useLibraryKeys, useSticky } from '../state';
import { Empty, InlineForm, LoadingRows, Notice, ResultRow, SearchField, useTask } from '../ui';

export function SoundCloudSource() {
  const [link, setLink] = useState('');
  const [q, setQ] = useSticky('sc.q', '');
  const [results, setResults] = useSticky<Track[] | null>('sc.results', null);
  const [added, setAdded] = useState<{ text: string; ids: string[] } | null>(null);
  const linkTask = useTask();
  const searchTask = useTask();
  const keys = useLibraryKeys();

  const addLink = (v: string) =>
    void linkTask.run(async () => {
      setAdded(null);
      const r = await soundcloudTracks(v);
      const a = addToLibrary(r.tracks, { quiet: true });
      setAdded({ text: a.length === 1 ? `Added “${a[0].title}”` : `Added ${a.length} tracks from “${r.title}”${r.note ? `. ${r.note}` : ''}`, ids: a.map((t) => t.id) });
      setLink('');
    }, (e) => friendlyError(e, 'SoundCloud'));

  const search = (v: string) => {
    if (!v) return;
    void searchTask.run(async () => setResults(await soundcloudSearch(v)), (e) => friendlyError(e, 'SoundCloud'));
  };

  return (
    <>
      <InlineForm value={link} onChange={setLink} onSubmit={addLink} busy={linkTask.busy} icon={<IconLink />} button="Add" placeholder="Paste a SoundCloud track or playlist link" />
      <Notice error={linkTask.error} />
      {added && (
        <div className="lib-paste-result">
          <span className="msg ok">{added.text}</span>
          <button className="btn small primary" onClick={() => player.playTracks(added.ids, 0)}>
            Play
          </button>
        </div>
      )}

      <div className="section-title" style={{ marginTop: 16 }}>
        Search SoundCloud
      </div>
      <SearchField value={q} onChange={setQ} onSubmit={search} busy={searchTask.busy} placeholder="Artists, songs, DJ mixes…" />
      <Notice error={searchTask.error} />
      {searchTask.busy && !results ? (
        <LoadingRows n={5} />
      ) : results && results.length ? (
        <div className="list" style={{ marginTop: 10 }}>
          {results.map((t) => (
            <ResultRow
              key={t.ref}
              art={t.artwork}
              title={t.title}
              sub={[t.artist, t.duration ? formatTime(t.duration) : ''].filter(Boolean).join(' · ')}
              meta={t.genre}
              added={isInLibrary(keys, t)}
              onPlay={() => addToLibrary([{ ...t }], { play: true })}
              onAdd={() => addToLibrary([{ ...t }])}
            />
          ))}
        </div>
      ) : results ? (
        <Empty title="No tracks found" />
      ) : null}

      <p className="lib-hint">
        On SoundCloud use <b>Share → Copy link</b>. Plays through SoundCloud’s official widget; Go+ (paid) tracks only play a 30-second preview. Playlists are expanded into their
        tracks when possible.
      </p>
    </>
  );
}

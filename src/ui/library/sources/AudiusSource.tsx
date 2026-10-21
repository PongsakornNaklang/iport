import { useEffect } from 'react';
import { AUDIUS_GENRES, audiusSearchResults, audiusStreamUrl, audiusTrendingResults, type AudiusResult } from '@/core/sources/audius';
import { friendlyError } from '@/core/sources/net';
import { formatTime } from '@/core/util/format';
import { IconPlay, IconPlus } from '../../icons';
import { addToLibrary, isInLibrary, togglePreview, useLibraryKeys, useSticky } from '../state';
import { Chips, Empty, LoadingRows, Notice, ResultRow, SearchField, Segmented, useTask } from '../ui';

type Time = 'week' | 'month' | 'allTime';

function plays(n?: number): string {
  if (!n) return '';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M plays`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K plays`;
  return `${n} plays`;
}

export function AudiusSource() {
  const [q, setQ] = useSticky('au.q', '');
  const [genre, setGenre] = useSticky('au.genre', '');
  const [time, setTime] = useSticky<Time>('au.time', 'week');
  const [mode, setMode] = useSticky<'trending' | 'search'>('au.mode', 'trending');
  const [results, setResults] = useSticky<AudiusResult[] | null>('au.results', null);
  const task = useTask();
  const keys = useLibraryKeys();

  const loadTrending = (g: string, t: Time) => {
    setMode('trending');
    void task.run(async () => setResults(await audiusTrendingResults(g || undefined, t)), (e) => friendlyError(e, 'Audius'));
  };

  useEffect(() => {
    if (!results) loadTrending(genre, time);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = (v: string) => {
    if (!v) return;
    setMode('search');
    void task.run(async () => setResults(await audiusSearchResults(v)), (e) => friendlyError(e, 'Audius'));
  };

  const list = results ?? [];

  return (
    <>
      <SearchField
        value={q}
        onChange={(v) => {
          setQ(v);
          if (!v && mode === 'search') loadTrending(genre, time);
        }}
        onSubmit={search}
        busy={task.busy && mode === 'search'}
        placeholder="Search Audius"
      />
      {mode === 'trending' && (
        <>
          <div className="section-title" style={{ marginTop: 14 }}>
            <span className="grow">Trending</span>
            <Segmented
              value={time}
              onChange={(t) => {
                setTime(t);
                loadTrending(genre, t);
              }}
              options={[
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
                { value: 'allTime', label: 'All Time' },
              ]}
            />
          </div>
          <Chips
            value={genre}
            onChange={(g) => {
              setGenre(g);
              loadTrending(g, time);
            }}
            options={[{ value: '', label: 'All Genres' }, ...AUDIUS_GENRES.map((g) => ({ value: g, label: g }))]}
          />
        </>
      )}
      <Notice error={task.error} />
      {list.length > 0 && !task.busy && (
        <div className="lib-row-flex" style={{ margin: '10px 0 8px' }}>
          <span className="tiny grow">
            {mode === 'search' ? `Results for “${q}”` : `Top ${list.length}${genre ? ` · ${genre}` : ''}`}
          </span>
          <button className="btn small" onClick={() => addToLibrary(list.map((r) => ({ ...r.track })), { play: true, label: `${list.length} songs` })}>
            <IconPlay width={12} height={12} /> Play all
          </button>
          <button className="btn small primary" onClick={() => addToLibrary(list.map((r) => ({ ...r.track })), { label: `${list.length} songs` })}>
            <IconPlus /> Add all
          </button>
        </div>
      )}
      {task.busy ? (
        <div style={{ marginTop: 10 }}>
          <LoadingRows n={6} />
        </div>
      ) : list.length ? (
        <div className="list">
          {list.map(({ track: t, plays: p }) => (
            <ResultRow
              key={t.ref}
              art={t.artwork}
              title={t.title}
              sub={[t.artist, t.duration ? formatTime(t.duration) : ''].filter(Boolean).join(' · ')}
              meta={[t.genre, plays(p)].filter(Boolean).join(' · ') || undefined}
              previewKey={`audius:${t.ref}`}
              onPreview={() => void togglePreview(`audius:${t.ref}`, () => audiusStreamUrl(t.ref))}
              added={isInLibrary(keys, t)}
              onAdd={() => addToLibrary([{ ...t }])}
            />
          ))}
        </div>
      ) : results ? (
        <Empty title="Nothing found">Try another search or genre.</Empty>
      ) : null}
      <p className="lib-hint">Audius is a free, artist-owned streaming network: full songs, no account, no ads. ▶ previews here; + adds to every iPod.</p>
    </>
  );
}

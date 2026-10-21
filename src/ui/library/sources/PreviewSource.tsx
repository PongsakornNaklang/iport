import { ITUNES_COUNTRIES, searchPreviews, type ItunesResult } from '@/core/sources/itunes';
import { friendlyError } from '@/core/sources/net';
import type { Track } from '@/core/types';
import { IconPlay, IconPlus } from '../../icons';
import { addToLibrary, isInLibrary, togglePreview, useLibraryKeys, useSticky } from '../state';
import { Chips, Empty, LoadingRows, Notice, ResultRow, SearchField, Segmented, useTask } from '../ui';

const SUGGEST = ['Taylor Swift', 'BLACKPINK', 'Bodyslam', 'Ed Sheeran', 'Queen', 'Polycat', 'NewJeans', 'Coldplay'];

export function PreviewSource() {
  const [q, setQ] = useSticky('it.q', '');
  const [video, setVideo] = useSticky('it.video', false);
  const [country, setCountry] = useSticky('it.country', 'th', true);
  const [results, setResults] = useSticky<{ result: ItunesResult; track: Track }[] | null>('it.results', null);
  const task = useTask();
  const keys = useLibraryKeys();

  const search = (v: string, vid = video, c = country) => {
    if (!v) return;
    setQ(v);
    void task.run(async () => setResults(await searchPreviews(v, { video: vid, country: c })), (e) => friendlyError(e, 'the iTunes Store'));
  };

  const list = results ?? [];

  return (
    <>
      <div className="lib-row-flex">
        <div className="grow">
          <SearchField value={q} onChange={setQ} onSubmit={(v) => search(v)} busy={task.busy} placeholder="Songs, artists, albums" />
        </div>
        <select
          className="select"
          style={{ width: 'auto', flex: 'none' }}
          value={country}
          aria-label="Store country"
          onChange={(e) => {
            setCountry(e.target.value);
            if (q) search(q, video, e.target.value);
          }}
        >
          {ITUNES_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginTop: 10 }}>
        <Segmented
          value={video ? 'video' : 'song'}
          onChange={(v) => {
            setVideo(v === 'video');
            if (q) search(q, v === 'video');
          }}
          options={[
            { value: 'song', label: 'Songs' },
            { value: 'video', label: 'Music Videos' },
          ]}
        />
      </div>
      <Notice error={task.error} />
      {list.length > 0 && !task.busy && (
        <div className="lib-row-flex" style={{ margin: '10px 0 8px' }}>
          <span className="tiny grow">{list.length} previews</span>
          <button className="btn small" onClick={() => addToLibrary(list.map((r) => ({ ...r.track })), { play: true, label: `${list.length} previews` })}>
            <IconPlay width={12} height={12} /> Play all
          </button>
          <button className="btn small primary" onClick={() => addToLibrary(list.map((r) => ({ ...r.track })), { label: `${list.length} previews` })}>
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
          {list.map(({ track: t }) => (
            <ResultRow
              key={t.ref}
              art={t.artwork}
              title={t.title}
              sub={[t.artist, t.album].filter(Boolean).join(' · ')}
              meta={[t.genre, t.year].filter(Boolean).join(' · ') || undefined}
              previewKey={`it:${t.ref}`}
              onPreview={() => void togglePreview(`it:${t.ref}`, t.ref)}
              added={isInLibrary(keys, t)}
              onAdd={() => addToLibrary([{ ...t }])}
            />
          ))}
        </div>
      ) : results ? (
        <Empty title="No previews found">Try another search or store country.</Empty>
      ) : (
        <div style={{ marginTop: 14 }}>
          <div className="section-title">Try</div>
          <Chips wrap value={'' as string} onChange={(v) => search(v)} options={SUGGEST.map((s) => ({ value: s, label: s }))} />
        </div>
      )}
      <p className="lib-hint">
        Official 30-second previews with real album art and tags — great for building playlists, Cover Flow and the Music Quiz game. Full songs need another source.
      </p>
    </>
  );
}

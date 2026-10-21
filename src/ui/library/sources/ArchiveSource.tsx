import { useEffect, useMemo } from 'react';
import { Artwork } from '@/core/library/Artwork';
import {
  ARCHIVE_COLLECTIONS,
  archiveItem,
  archiveSearch,
  archiveTrack,
  type ArchiveHit,
  type ArchiveItem,
  type ArchiveKind,
} from '@/core/sources/archive';
import { friendlyError } from '@/core/sources/net';
import { formatTime } from '@/core/util/format';
import { IconPlay, IconPlus } from '../../icons';
import type { Intent } from '../AddMusicTab';
import { IconBackArrow } from '../icons';
import { addToLibrary, isInLibrary, togglePreview, useLibraryKeys, useSticky } from '../state';
import { Chips, Empty, LoadingRows, Notice, ResultRow, SearchField, Segmented, Spinner, useTask } from '../ui';

function downloads(n?: number): string {
  if (!n) return '';
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M views` : n >= 1e3 ? `${Math.round(n / 1e3)}K views` : `${n} views`;
}

export function ArchiveSource({ intent }: { intent: Extract<Intent, { kind: 'archive-item' }> | null }) {
  const [kind, setKind] = useSticky<ArchiveKind>('ia.kind', 'audio');
  const [q, setQ] = useSticky('ia.q', '');
  const [coll, setColl] = useSticky('ia.coll', 'etree');
  const [hits, setHits] = useSticky<{ hits: ArchiveHit[]; total: number; page: number } | null>('ia.hits', null);
  const [item, setItem] = useSticky<ArchiveItem | null>('ia.item', null);
  const task = useTask();
  const more = useTask();
  const itemTask = useTask();
  const keys = useLibraryKeys();

  const collections = useMemo(() => ARCHIVE_COLLECTIONS.filter((c) => c.kind === kind), [kind]);
  const collection = collections.find((c) => c.id === coll);

  const load = (text: string, k: ArchiveKind, cid: string) => {
    const c = ARCHIVE_COLLECTIONS.find((x) => x.id === cid && x.kind === k);
    void task.run(async () => {
      const r = await archiveSearch(text, k, c, 1);
      setHits({ ...r, page: 1 });
    }, (e) => friendlyError(e, 'archive.org'));
  };

  const loadMore = () => {
    if (!hits) return;
    void more.run(async () => {
      const r = await archiveSearch(q, kind, collection, hits.page + 1);
      setHits({ hits: [...hits.hits, ...r.hits], total: r.total, page: hits.page + 1 });
    }, (e) => friendlyError(e, 'archive.org'));
  };

  const open = (id: string) =>
    void itemTask.run(async () => setItem(await archiveItem(id)), (e) => friendlyError(e, 'archive.org'));

  useEffect(() => {
    if (intent) open(intent.id);
    else if (!hits) load(q, kind, coll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.seq]);

  if (item || itemTask.busy) {
    const tracks = item ? item.files.map((f) => archiveTrack(item, f)) : [];
    return (
      <>
        <button className="lib-back" onClick={() => setItem(null)}>
          <IconBackArrow /> Results
        </button>
        <Notice error={itemTask.error} />
        {itemTask.busy || !item ? (
          <div style={{ padding: 30, textAlign: 'center' }}>
            <Spinner size={22} />
          </div>
        ) : (
          <>
            <div className="lib-detail">
              <Artwork src={item.artwork} size={80} radius={8} />
              <div className="txt">
                <div className="ttl">{item.title}</div>
                <div className="sub">{[item.creator, item.year].filter(Boolean).join(' · ')}</div>
                {item.description && <div className="desc">{item.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}</div>}
                <div className="lib-row-flex" style={{ marginTop: 8 }}>
                  <button className="btn small primary" disabled={!tracks.length} onClick={() => addToLibrary(tracks.map((t) => ({ ...t })), { label: `${tracks.length} items` })}>
                    <IconPlus /> Add all {tracks.length}
                  </button>
                  <button className="btn small" disabled={!tracks.length} onClick={() => addToLibrary(tracks.map((t) => ({ ...t })), { play: true, label: `“${item.title}”` })}>
                    <IconPlay width={12} height={12} /> Play
                  </button>
                  <a className="btn small ghost" href={`https://archive.org/details/${encodeURIComponent(item.identifier)}`} target="_blank" rel="noreferrer noopener">
                    archive.org ↗
                  </a>
                </div>
              </div>
            </div>
            {tracks.length === 0 ? (
              <Empty title="Nothing playable here">This item has no audio or video files a browser can stream.</Empty>
            ) : (
              <div className="list">
                {item.files.map((f, i) => {
                  const t = tracks[i];
                  return (
                    <ResultRow
                      key={f.name}
                      art={item.artwork}
                      title={f.title}
                      sub={[f.trackNo ? `#${f.trackNo}` : '', f.duration ? formatTime(f.duration) : '', f.format].filter(Boolean).join(' · ')}
                      added={isInLibrary(keys, t)}
                      previewKey={f.video ? undefined : `ia:${f.url}`}
                      onPreview={f.video ? undefined : () => void togglePreview(`ia:${f.url}`, f.url)}
                      onPlay={f.video ? () => addToLibrary([{ ...t }], { play: true }) : undefined}
                      onAdd={() => addToLibrary([{ ...t }])}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </>
    );
  }

  return (
    <>
      <Segmented
        value={kind}
        onChange={(k) => {
          setKind(k);
          const first = ARCHIVE_COLLECTIONS.find((c) => c.kind === k)!.id;
          setColl(first);
          load(q, k, first);
        }}
        options={[
          { value: 'audio', label: 'Music & Audio' },
          { value: 'movies', label: 'Films' },
        ]}
      />
      <div style={{ marginTop: 10 }}>
        <SearchField value={q} onChange={setQ} onSubmit={(v) => load(v, kind, coll)} busy={task.busy} placeholder={kind === 'audio' ? 'Artist, album, concert…' : 'Film title, actor, year…'} />
      </div>
      <div style={{ marginTop: 10 }}>
        <Chips
          value={coll}
          onChange={(c) => {
            setColl(c);
            load(q, kind, c);
          }}
          options={[...collections.map((c) => ({ value: c.id, label: c.label })), { value: 'all', label: kind === 'audio' ? 'All audio' : 'All films' }]}
        />
      </div>
      <Notice error={task.error} />
      {task.busy ? (
        <div style={{ marginTop: 10 }}>
          <LoadingRows n={6} />
        </div>
      ) : hits && hits.hits.length ? (
        <>
          <p className="tiny" style={{ margin: '10px 2px 6px' }}>
            {hits.total.toLocaleString()} items · most popular first
          </p>
          <div className="list">
            {hits.hits.map((h) => (
              <ResultRow
                key={h.identifier}
                art={`https://archive.org/services/img/${encodeURIComponent(h.identifier)}`}
                title={h.title}
                sub={[h.creator, h.year].filter(Boolean).join(' · ') || undefined}
                meta={downloads(h.downloads) || undefined}
                onClick={() => open(h.identifier)}
                chevron
              />
            ))}
          </div>
          {hits.hits.length < hits.total && (
            <div className="lib-more">
              <button className="btn small" onClick={loadMore} disabled={more.busy}>
                {more.busy ? <Spinner size={14} /> : 'Load more'}
              </button>
            </div>
          )}
        </>
      ) : hits ? (
        <Empty title="Nothing found">Try other words or another collection.</Empty>
      ) : null}
      <p className="lib-hint">The Internet Archive is a non-profit library of millions of free recordings and public-domain films. Open an item to add its tracks.</p>
    </>
  );
}

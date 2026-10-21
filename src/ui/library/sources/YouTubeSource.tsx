import { useEffect, useState } from 'react';
import { Artwork } from '@/core/library/Artwork';
import { friendlyError } from '@/core/sources/net';
import {
  isAlbumList,
  isExpandableList,
  parseYouTubeUrl,
  youtubePlaylist,
  youtubeSearch,
  youtubeTrack,
  youtubeTrackFromId,
  type YtItem,
  type YtPlaylist,
} from '@/core/sources/youtube';
import { IconLink, IconPlay, IconPlus } from '../../icons';
import type { Intent } from '../AddMusicTab';
import { IconBackArrow, IconYouTube } from '../icons';
import { addToLibrary, isInLibrary, useLibraryKeys, useSticky } from '../state';
import { Chips, Empty, InlineForm, LoadingRows, Notice, ResultRow, SearchField, Segmented, useTask } from '../ui';

const SUGGEST = ['Thai pop hits', 'lofi hip hop', 'city pop', 'K-pop', 'acoustic covers', '80s hits'];

export function YouTubeSource({ intent }: { intent: Extract<Intent, { kind: 'yt-list' }> | null }) {
  const [q, setQ] = useSticky('yt.q', '');
  const [results, setResults] = useSticky<YtItem[] | null>('yt.results', null);
  const [playlist, setPlaylist] = useSticky<YtPlaylist | null>('yt.playlist', null);
  const [asVideo, setAsVideo] = useSticky('yt.asVideo', false, true);
  const [albumMode, setAlbumMode] = useSticky('yt.albumMode', false);
  const [link, setLink] = useState('');
  const task = useTask();
  const keys = useLibraryKeys();

  const loadList = (listId: string) =>
    task.run(async () => {
      const p = await youtubePlaylist(listId);
      setPlaylist(p);
      setAlbumMode(isAlbumList(listId));
    }, (e) => friendlyError(e, 'YouTube'));

  useEffect(() => {
    if (intent) void loadList(intent.listId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.seq]);

  const search = (v: string) => {
    if (!v) return;
    setQ(v);
    void task.run(async () => {
      setResults(await youtubeSearch(v));
      setPlaylist(null);
    }, (e) => friendlyError(e, 'YouTube'));
  };

  const trackOf = (item: YtItem, i?: number) =>
    youtubeTrack(item, {
      musicVideo: asVideo,
      ...(albumMode && playlist && i !== undefined
        ? { album: playlist.title, albumArtist: playlist.author?.replace(/\s*-\s*Topic$/i, ''), trackNo: i + 1 }
        : {}),
    });

  const addLink = (v: string) => {
    const ref = parseYouTubeUrl(v);
    if (!ref) {
      task.setError('That isn’t a YouTube link. Copy it from the address bar or Share → Copy link.');
      return;
    }
    if (ref.listId && isExpandableList(ref.listId) && !ref.videoId) {
      setLink('');
      void loadList(ref.listId);
      return;
    }
    if (!ref.videoId) {
      task.setError('Mixes and private lists can’t be imported. Paste a public playlist link.');
      return;
    }
    void task.run(async () => {
      const t = await youtubeTrackFromId(ref.videoId!, { musicVideo: asVideo });
      addToLibrary([t]);
      setLink('');
      if (ref.listId && isExpandableList(ref.listId)) await loadList(ref.listId);
    }, (e) => friendlyError(e, 'YouTube'));
  };

  const items = playlist ? playlist.items : (results ?? []);

  return (
    <>
      <SearchField value={q} onChange={setQ} onSubmit={search} busy={task.busy && !playlist} placeholder="Search YouTube" />
      <div style={{ marginTop: 8 }}>
        <InlineForm value={link} onChange={setLink} onSubmit={addLink} icon={<IconLink />} button="Add" placeholder="…or paste a video / Shorts / playlist link" />
      </div>
      <div className="lib-row-flex" style={{ marginTop: 10 }}>
        <span className="tiny">Add as</span>
        <Segmented
          className="grow"
          value={asVideo ? 'video' : 'song'}
          onChange={(v) => setAsVideo(v === 'video')}
          options={[
            { value: 'song', label: 'Songs' },
            { value: 'video', label: 'Music Videos' },
          ]}
        />
      </div>
      <Notice error={task.error} />

      {playlist ? (
        <>
          <button className="lib-back" onClick={() => setPlaylist(null)} style={{ marginTop: 8 }}>
            <IconBackArrow /> {results ? 'Search results' : 'Back'}
          </button>
          <div className="lib-detail">
            <Artwork src={playlist.items[0]?.thumbnail} size={72} radius={8} />
            <div className="txt">
              <div className="ttl">{playlist.title}</div>
              <div className="sub">
                {[playlist.author, `${playlist.items.length} video${playlist.items.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
              </div>
              <div className="lib-row-flex" style={{ marginTop: 8 }}>
                <button className="btn small primary" onClick={() => addToLibrary(playlist.items.map(trackOf), { label: `${playlist.items.length} videos` })}>
                  <IconPlus /> Add all
                </button>
                <button className="btn small" onClick={() => addToLibrary(playlist.items.map(trackOf), { play: true, label: `“${playlist.title}”` })}>
                  <IconPlay width={12} height={12} /> Play all
                </button>
              </div>
            </div>
          </div>
          <label className="lib-row-flex" style={{ fontSize: 12.5, margin: '0 0 10px', cursor: 'pointer', color: 'var(--ui-text-2)' }}>
            <input type="checkbox" checked={albumMode} onChange={(e) => setAlbumMode(e.target.checked)} />
            Add as an album (“{playlist.title}”, numbered in order)
          </label>
        </>
      ) : null}

      {task.busy && !items.length ? (
        <LoadingRows n={6} />
      ) : items.length ? (
        <div className="list">
          {items.map((it, i) => (
            <ResultRow
              key={it.id}
              art={it.thumbnail}
              title={it.title}
              sub={[it.channel, it.duration].filter(Boolean).join(' · ') || undefined}
              added={isInLibrary(keys, { source: 'youtube', ref: it.id })}
              onPlay={() => addToLibrary([trackOf(it, i)], { play: true })}
              onAdd={() => addToLibrary([trackOf(it, i)])}
            />
          ))}
        </div>
      ) : results && !playlist ? (
        <Empty title="No videos found">Try other words.</Empty>
      ) : !playlist ? (
        <div style={{ marginTop: 14 }}>
          <div className="section-title">Try</div>
          <Chips wrap value={'' as string} onChange={(v) => search(v)} options={SUGGEST.map((s) => ({ value: s, label: s }))} />
        </div>
      ) : null}

      <p className="lib-hint">
        <IconYouTube width={12} height={12} style={{ color: '#ff3b30', verticalAlign: -2 }} /> Plays through YouTube’s official embedded player — the video shows on iPods with a screen. Some videos don’t allow
        embedding; those are skipped. Titles like “Artist - Song (Official Video)” are tidied into Artist and Title (change them with Get Info).
      </p>
    </>
  );
}

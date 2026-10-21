/**
 * TV (iOS 15): Watch Now / Library / Search for every video on the iPod —
 * imported movies, TV shows, music videos, Camera home videos and YouTube.
 * Playback is the full-screen VideoPlayer (rotates to landscape).
 */
import { useMemo, useState } from 'react';
import { Artwork } from '../../../core/library/Artwork';
import { importFiles } from '../../../core/library/importLocal';
import { useTracks } from '../../../core/library/selectors';
import { formatTime } from '../../../core/util/format';
import type { MediaType, Track } from '../../../core/types';
import { Glyph } from '../os/glyphs';
import { os, usePrefs } from '../os/store';
import { Scroller } from '../os/Scroller';
import { Empty, NavStack, Page, SearchField, Tabs, useNav } from '../os/ui';
import { openVideo } from './VideoPlayer';
import { pickFiles } from './shared';
import './music/music.css';

type Kind = 'movies' | 'tv' | 'musicvideos' | 'home' | 'youtube';
const KINDS: { id: Kind; label: string; glyph: string }[] = [
  { id: 'movies', label: 'Movies', glyph: 'film' },
  { id: 'tv', label: 'TV Shows', glyph: 'tv' },
  { id: 'musicvideos', label: 'Music Videos', glyph: 'music.note.list' },
  { id: 'home', label: 'Home Videos', glyph: 'video' },
  { id: 'youtube', label: 'YouTube', glyph: 'play.rectangle.fill' },
];

function kindOf(t: Track): Kind | null {
  if (t.source === 'youtube' && (t.hasVideo || t.mediaType === 'musicvideo' || t.mediaType === 'music')) return 'youtube';
  if (t.mediaType === 'movie') return t.album === 'Camera' || t.genre === 'Home Video' ? 'home' : 'movies';
  if (t.mediaType === 'tvshow') return 'tv';
  if (t.mediaType === 'musicvideo') return 'musicvideos';
  if (t.mediaType === 'podcast' && t.hasVideo) return 'tv';
  return null;
}

function useVideos() {
  const tracks = useTracks();
  return useMemo(() => {
    const all = Object.values(tracks).filter((t) => kindOf(t));
    all.sort((a, b) => b.addedAt - a.addedAt);
    const by: Record<Kind, Track[]> = { movies: [], tv: [], musicvideos: [], home: [], youtube: [] };
    for (const t of all) by[kindOf(t)!].push(t);
    return { all, by };
  }, [tracks]);
}

async function importVideos() {
  const files = await pickFiles('video/*', true);
  if (!files.length) return;
  const as = await new Promise<MediaType | null>((resolve) =>
    os.alert({
      sheet: true,
      title: 'Add to TV',
      message: `${files.length} video${files.length === 1 ? '' : 's'}`,
      actions: [
        { label: 'Movie', onPress: () => resolve('movie') },
        { label: 'TV Show', onPress: () => resolve('tvshow') },
        { label: 'Music Video', onPress: () => resolve('musicvideo') },
        { label: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
    }),
  );
  if (!as) return;
  const r = await importFiles(files, undefined, { videoAs: as });
  if (r.tracks.length) os.toast('Added to Library', 'checkmark');
}

export default function TV() {
  const tab = usePrefs((s) => s.tvTab);
  const setTab = (v: string) => usePrefs.getState().set('tvTab', v);
  return (
    <div className="t7tv-root">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'watch', label: 'Watch Now', glyph: 'play.circle.fill', render: (r) => <NavStack root={<WatchNow />} rootTitle="Watch Now" resetSerial={r} /> },
          { id: 'library', label: 'Library', glyph: 'rectangle.stack.fill', render: (r) => <NavStack root={<LibraryTab />} rootTitle="Library" resetSerial={r} /> },
          { id: 'search', label: 'Search', glyph: 'magnifyingglass', render: (r) => <NavStack root={<SearchTab />} rootTitle="Search" resetSerial={r} /> },
        ]}
      />
    </div>
  );
}

function VideoTile({ t, list, wide }: { t: Track; list: Track[]; wide?: boolean }) {
  const prog = t.bookmark && t.duration ? Math.min(1, t.bookmark / t.duration) : 0;
  return (
    <div className={`t7tv-tile ${wide ? 'wide' : ''}`} onClick={() => openVideo(list.map((x) => x.id), list.indexOf(t))}>
      <div className="t7tv-art">
        {t.artwork ? <Artwork src={t.artwork} radius={0} /> : <Glyph name="film" size={30} />}
        {prog > 0 && (
          <span className="t7tv-prog">
            <i style={{ width: `${prog * 100}%` }} />
          </span>
        )}
      </div>
      <div className="t">{t.title}</div>
      <div className="s">{[t.artist, t.duration ? formatTime(t.duration) : ''].filter(Boolean).join(' · ')}</div>
    </div>
  );
}

function Row({ title, list, onAll }: { title: string; list: Track[]; onAll?: () => void }) {
  if (!list.length) return null;
  return (
    <>
      <div className="t7a-h2">
        {title}
        {onAll && list.length > 2 && <button onClick={onAll}>See All</button>}
      </div>
      <Scroller axis="x" className="t7tv-row" innerClassName="t7tv-row-in" snap={208}>
        {list.slice(0, 12).map((t) => (
          <VideoTile key={t.id} t={t} list={list} />
        ))}
      </Scroller>
    </>
  );
}

function WatchNow() {
  const nav = useNav()!;
  const { all, by } = useVideos();
  const upNext = all.filter((t) => t.bookmark && t.duration && t.bookmark < t.duration - 10);
  const hero = upNext[0] ?? by.movies[0] ?? all[0];
  return (
    <Page title="Watch Now">
      {!all.length && (
        <Empty glyph="tv" title="Nothing to Watch Yet" text="Add YouTube videos with the Library button above the iPod, or import movies from your computer.">
          <button className="t7-pill" onClick={() => void importVideos()}>
            Import Videos
          </button>
        </Empty>
      )}
      {hero && (
        <div className="t7tv-hero" onClick={() => openVideo(all.map((x) => x.id), all.indexOf(hero))}>
          {hero.artwork ? <Artwork src={hero.artwork} /> : <Glyph name="film" size={50} />}
          <div className="cap">
            <span>{upNext[0] === hero ? 'CONTINUE WATCHING' : 'FEATURED'}</span>
            <b>{hero.title}</b>
            <button className="t7tv-playbtn">
              <Glyph name="play.fill" size={13} /> {upNext[0] === hero ? 'Resume' : 'Play'}
            </button>
          </div>
        </div>
      )}
      <Row title="Up Next" list={upNext} />
      {KINDS.map((k) => (
        <Row key={k.id} title={k.label} list={by[k.id]} onAll={() => nav.push(<Grid kind={k.id} />, k.label)} />
      ))}
    </Page>
  );
}

function LibraryTab() {
  const nav = useNav()!;
  const { all, by } = useVideos();
  return (
    <Page
      title="Library"
      right={
        <button className="t7-gbtn" aria-label="Import Videos" onClick={() => void importVideos()}>
          <Glyph name="plus" size={22} />
        </button>
      }
    >
      <div className="t7pod-libmenu">
        {KINDS.map((k) => (
          <div key={k.id} className="t7m-librow" onClick={() => nav.push(<Grid kind={k.id} />, k.label)}>
            <Glyph name={k.glyph} size={22} className="t7m-librow-g" />
            <div className="t7m-librow-main">
              <span>{k.label}</span>
              <span className="t7tv-n">{by[k.id].length || ''}</span>
              <Glyph name="chevron.right" size={14} className="t7-cell-chev" />
            </div>
          </div>
        ))}
      </div>
      <div className="t7a-h2">Recently Added</div>
      {all.length ? (
        <div className="t7tv-grid">
          {all.slice(0, 12).map((t) => (
            <VideoTile key={t.id} t={t} list={all} />
          ))}
        </div>
      ) : (
        <div className="t7a-hint">Videos you add appear here.</div>
      )}
    </Page>
  );
}

function Grid({ kind }: { kind: Kind }) {
  const { by } = useVideos();
  const list = by[kind];
  const label = KINDS.find((k) => k.id === kind)!.label;
  return (
    <Page title={label}>
      {list.length ? (
        <div className="t7tv-grid">
          {list.map((t) => (
            <VideoTile key={t.id} t={t} list={list} />
          ))}
        </div>
      ) : (
        <Empty glyph={KINDS.find((k) => k.id === kind)!.glyph} title={`No ${label}`} />
      )}
    </Page>
  );
}

function SearchTab() {
  const { all } = useVideos();
  const [q, setQ] = useState('');
  const hits = q.trim() ? all.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q.trim().toLowerCase())) : [];
  return (
    <Page title="Search" search={<SearchField value={q} onChange={setQ} placeholder="Shows, Movies, and More" />}>
      {!q.trim() && (
        <>
          <div className="t7a-h2">Recently Added</div>
          <div className="t7tv-grid">
            {all.slice(0, 6).map((t) => (
              <VideoTile key={t.id} t={t} list={all} />
            ))}
          </div>
        </>
      )}
      {q.trim() && (hits.length ? <div className="t7tv-grid">{hits.map((t) => <VideoTile key={t.id} t={t} list={hits} />)}</div> : <Empty title="No Results" />)}
    </Page>
  );
}

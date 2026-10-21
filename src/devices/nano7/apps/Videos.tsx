import { useMemo } from 'react';
import { Artwork } from '../../../core/library/Artwork';
import { useLibrary } from '../../../core/library/store';
import { videosOf } from '../../../core/library/selectors';
import { compareTitles, formatTime } from '../../../core/util/format';
import type { Track } from '../../../core/types';
import { useNano, useNanoData } from '../state';
import { Glyph } from '../os/icons';
import { NavStack, useNav } from '../os/Nav';
import { Empty, Page, Row } from '../os/ui';
import { useAppNav } from './registry';
import { startPlayback } from './common';

const TINT = '#007aff';

export function playVideo(ids: string[], i: number) {
  const tracks = useLibrary.getState().tracks;
  const t = tracks[ids[i]];
  const resume = useNanoData.getState().videoResume;
  const startAt = t && resume && t.bookmark && (!t.duration || t.bookmark < t.duration - 10) ? t.bookmark : 0;
  startPlayback(ids, i, { startAt });
  useNano.setState({ video: true });
}

function useCategories() {
  const tracks = useLibrary((s) => s.tracks);
  return useMemo(() => {
    const movies = videosOf(tracks, 'movie');
    const mv = videosOf(tracks, 'musicvideo');
    const tv = videosOf(tracks, 'tvshow');
    const yt = Object.values(tracks)
      .filter((t) => t.source === 'youtube' && t.mediaType === 'music')
      .sort((a, b) => compareTitles(a.title, b.title));
    const local = Object.values(tracks)
      .filter((t) => t.hasVideo && t.source !== 'youtube' && t.mediaType === 'music')
      .sort((a, b) => compareTitles(a.title, b.title));
    return { movies, mv: [...mv, ...local], tv, yt };
  }, [tracks]);
}

function VideoRow({ t, onClick }: { t: Track; onClick: () => void }) {
  const progress = t.bookmark && t.duration ? t.bookmark / t.duration : 0;
  return (
    <div className="n7-row n7-tap n7-videorow" onClick={onClick}>
      <div className="n7-videothumb">
        <Artwork src={t.artwork} style={{ width: 64, height: 36 }} radius={2} />
        {progress > 0.02 && (
          <div className="n7-videoprog">
            <div style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>
      <div className="n7-row-text">
        <div className="n7-row-title">{t.title}</div>
        <div className="n7-row-sub">{[t.artist, formatTime(t.duration) !== '--:--' ? formatTime(t.duration) : ''].filter(Boolean).join(' · ')}</div>
      </div>
      {!t.playCount && !t.bookmark && <span className="n7-badge" style={{ position: 'static', marginLeft: 4 }} />}
    </div>
  );
}

function VideoList({ list }: { list: Track[] }) {
  const ids = list.map((t) => t.id);
  return (
    <Page>
      {list.map((t, i) => (
        <VideoRow key={t.id} t={t} onClick={() => playVideo(ids, i)} />
      ))}
    </Page>
  );
}

function ShowsPage({ list }: { list: Track[] }) {
  const nav = useNav();
  const shows = useMemo(() => {
    const m = new Map<string, Track[]>();
    for (const t of list) {
      const k = t.show || t.album || 'TV Show';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return [...m.entries()].sort((a, b) => compareTitles(a[0], b[0]));
  }, [list]);
  return (
    <Page>
      {shows.map(([name, eps]) => (
        <Row key={name} art={eps[0].artwork} artSize={40} tall title={name} subtitle={`${eps.length} episode${eps.length === 1 ? '' : 's'}`} chevron onClick={() => nav.push({ title: name, node: <VideoList list={eps} /> })} />
      ))}
    </Page>
  );
}

function VideosRoot() {
  const nav = useNav();
  const c = useCategories();
  const none = !c.movies.length && !c.mv.length && !c.tv.length && !c.yt.length;
  if (none) return <Empty icon={<Glyph.film size={48} color="#c7c7cc" />} title="No Videos" text="Add movies, TV shows and music videos in the Library panel." />;
  return (
    <Page>
      {c.movies.length > 0 && <Row icon={<Glyph.film size={20} />} title="Movies" detail={String(c.movies.length)} chevron onClick={() => nav.push({ title: 'Movies', node: <VideoList list={c.movies} /> })} />}
      {c.mv.length > 0 && <Row icon={<Glyph.mv size={20} />} title="Music Videos" detail={String(c.mv.length)} chevron onClick={() => nav.push({ title: 'Music Videos', node: <VideoList list={c.mv} /> })} />}
      {c.tv.length > 0 && <Row icon={<Glyph.tv size={20} />} title="TV Shows" detail={String(c.tv.length)} chevron onClick={() => nav.push({ title: 'TV Shows', node: <ShowsPage list={c.tv} /> })} />}
      {c.yt.length > 0 && <Row icon={<Glyph.youtube size={20} />} title="YouTube" detail={String(c.yt.length)} chevron onClick={() => nav.push({ title: 'YouTube', node: <VideoList list={c.yt} /> })} />}
    </Page>
  );
}

export function VideosApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('videos');
  return <NavStack root={{ title: 'Videos', node: <VideosRoot /> }} tint={TINT} active={active} apiRef={apiRef} />;
}

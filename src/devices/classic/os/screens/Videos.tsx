import { useMemo } from 'react';
import { allTracks, playlistTracks, usePlaylists, useTracks } from '../../../../core/library/selectors';
import { player, usePlayer } from '../../../../core/player/player';
import { useDeviceSetting } from '../../../../core/settings/store';
import type { Track } from '../../../../core/types';
import { compareTitles, formatTime } from '../../../../core/util/format';
import { useOS, type OSApi, type ScreenSpec } from '../core';
import { cycleRow, toggleRow } from '../common';
import { ListView, type Row } from '../ListView';
import { NowPlaying } from './NowPlaying';
import { t as tx } from '../i18n';

export function videoNowPlaying(): ScreenSpec {
  return { title: tx('Now Playing'), el: <NowPlaying video />, kind: 'nowplaying', header: 'hidden', landscape: true };
}

export function playVideos(os: OSApi, ids: string[], i: number) {
  if (!ids.length) return;
  player.playTracks(ids, i);
  os.nav.push(videoNowPlaying());
}

function videosOfKind(tracks: Record<string, Track>, kind: 'movie' | 'tvshow' | 'musicvideo'): Track[] {
  return allTracks(tracks)
    .filter((t) => t.mediaType === kind || (kind === 'musicvideo' && t.mediaType === 'music' && t.hasVideo && t.source === 'youtube'))
    .sort((a, b) => compareTitles(a.title, b.title));
}

export function VideosMenu() {
  const os = useOS();
  const rows = useMemo<Row[]>(
    () => [
      { key: 'movies', label: tx('Movies'), chevron: true, onSelect: () => os.nav.push({ title: tx('Movies'), el: <VideoList kind="movie" /> }) },
      { key: 'rentals', label: tx('Rentals'), chevron: true, onSelect: () => os.nav.push({ title: tx('Rentals'), el: <ListView rows={[]} empty={tx('No Rentals')} /> }) },
      { key: 'tv', label: tx('TV Shows'), chevron: true, onSelect: () => os.nav.push({ title: tx('TV Shows'), el: <TvShows /> }) },
      { key: 'vpod', label: tx('Video Podcasts'), chevron: true, onSelect: () => os.nav.push({ title: tx('Video Podcasts'), el: <VideoPodcasts /> }) },
      { key: 'mv', label: tx('Music Videos'), chevron: true, onSelect: () => os.nav.push({ title: tx('Music Videos'), el: <VideoList kind="musicvideo" /> }) },
      { key: 'vp', label: tx('Video Playlists'), chevron: true, onSelect: () => os.nav.push({ title: tx('Video Playlists'), el: <VideoPlaylists /> }) },
      { key: 'settings', label: tx('Settings'), chevron: true, onSelect: () => os.nav.push({ title: tx('Video Settings'), el: <VideoSettings /> }) },
    ],
    [os],
  );
  return <ListView rows={rows} />;
}

function VideoList({ kind, ids: given }: { kind?: 'movie' | 'tvshow' | 'musicvideo'; ids?: string[] }) {
  const os = useOS();
  const tracks = useTracks();
  const current = usePlayer((s) => s.currentId);
  const list = useMemo(() => (given ? given.map((id) => tracks[id]).filter(Boolean) : videosOfKind(tracks, kind ?? 'movie')), [tracks, kind, given]);
  const rows = useMemo<Row[]>(() => {
    const ids = list.map((t) => t.id);
    return list.map((t, i) => ({
      key: t.id,
      label: t.title,
      sub: kind === 'musicvideo' ? t.artist : t.duration ? formatTime(t.duration) : t.artist,
      art: t.artwork,
      speaker: t.id === current,
      dot: kind === 'movie' || kind === 'tvshow' ? !t.playCount : undefined,
      onSelect: () => playVideos(os, ids, i),
    }));
  }, [list, current, os, kind]);
  const empty = tx(kind === 'movie' ? 'No Movies' : kind === 'tvshow' ? 'No TV Shows' : 'No Videos');
  return <ListView rows={rows} variant="art" empty={empty} />;
}

function TvShows() {
  const os = useOS();
  const tracks = useTracks();
  const rows = useMemo<Row[]>(() => {
    const shows = new Map<string, Track[]>();
    for (const t of videosOfKind(tracks, 'tvshow')) {
      const k = t.show || t.album || tx('TV Show');
      if (!shows.has(k)) shows.set(k, []);
      shows.get(k)!.push(t);
    }
    return [...shows.entries()].map(([name, eps]) => ({
      key: name,
      label: name,
      dot: eps.some((t) => !t.playCount),
      chevron: true,
      onSelect: () => os.nav.push({ title: name, el: <VideoList kind="tvshow" ids={eps.map((t) => t.id)} /> }),
    }));
  }, [tracks, os]);
  return <ListView rows={rows} empty={tx('No TV Shows')} />;
}

function VideoPodcasts() {
  const os = useOS();
  const tracks = useTracks();
  const rows = useMemo<Row[]>(() => {
    const shows = new Map<string, Track[]>();
    for (const t of allTracks(tracks)) {
      if (t.mediaType !== 'podcast' || !t.hasVideo) continue;
      const k = t.show || t.album || tx('Podcast');
      if (!shows.has(k)) shows.set(k, []);
      shows.get(k)!.push(t);
    }
    return [...shows.entries()]
      .sort((a, b) => compareTitles(a[0], b[0]))
      .map(([name, eps]) => ({
        key: name,
        label: name,
        dot: eps.some((t) => !t.playCount),
        chevron: true,
        onSelect: () => os.nav.push({ title: name, el: <VideoList ids={eps.sort((a, b) => (b.pubDate ?? 0) - (a.pubDate ?? 0)).map((t) => t.id)} /> }),
      }));
  }, [tracks, os]);
  return <ListView rows={rows} empty={tx('No Video Podcasts')} />;
}

function VideoPlaylists() {
  const os = useOS();
  const tracks = useTracks();
  const lists = usePlaylists();
  const rows = useMemo<Row[]>(() => {
    const isVid = (id: string) => {
      const t = tracks[id];
      return !!t && (t.mediaType === 'movie' || t.mediaType === 'tvshow' || t.mediaType === 'musicvideo' || !!t.hasVideo);
    };
    return lists
      .map((p) => ({ p, ids: playlistTracks(tracks, p).filter(isVid) }))
      .filter((x) => x.ids.length)
      .map(({ p, ids }) => ({ key: p.id, label: p.name, chevron: true, onSelect: () => os.nav.push({ title: p.name, el: <VideoList ids={ids} /> }) }));
  }, [lists, tracks, os]);
  return <ListView rows={rows} empty={tx('No Video Playlists')} />;
}

function VideoSettings() {
  const os = useOS();
  const [tvOut, setTvOut] = useDeviceSetting<string>(os.modelId, 'tvOut', 'Ask');
  const [signal, setSignal] = useDeviceSetting<string>(os.modelId, 'tvSignal', 'NTSC');
  const [wide, setWide] = useDeviceSetting<boolean>(os.modelId, 'widescreen', false);
  const [fit, setFit] = useDeviceSetting<boolean>(os.modelId, 'fitToScreen', true);
  const [captions, setCaptions] = useDeviceSetting<boolean>(os.modelId, 'captions', false);
  const rows: Row[] = [
    cycleRow('TV Out', tvOut, ['Ask', 'Off', 'On'].map((v) => ({ value: v, label: v })), setTvOut),
    cycleRow('TV Signal', signal, ['NTSC', 'PAL'].map((v) => ({ value: v, label: v })), setSignal),
    toggleRow('Widescreen', wide, setWide),
    toggleRow('Fit to Screen', fit, setFit),
    toggleRow('Captions', captions, setCaptions),
  ];
  return <ListView rows={rows} />;
}

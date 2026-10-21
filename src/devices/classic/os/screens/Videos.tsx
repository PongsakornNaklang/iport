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

export function videoNowPlaying(): ScreenSpec {
  return { title: 'Now Playing', el: <NowPlaying video />, kind: 'nowplaying', header: 'hidden' };
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
      { key: 'movies', label: 'Movies', chevron: true, onSelect: () => os.nav.push({ title: 'Movies', el: <VideoList kind="movie" /> }) },
      { key: 'mv', label: 'Music Videos', chevron: true, onSelect: () => os.nav.push({ title: 'Music Videos', el: <VideoList kind="musicvideo" /> }) },
      { key: 'tv', label: 'TV Shows', chevron: true, onSelect: () => os.nav.push({ title: 'TV Shows', el: <TvShows /> }) },
      { key: 'vp', label: 'Video Playlists', chevron: true, onSelect: () => os.nav.push({ title: 'Video Playlists', el: <VideoPlaylists /> }) },
      { key: 'settings', label: 'Settings', chevron: true, onSelect: () => os.nav.push({ title: 'Video Settings', el: <VideoSettings /> }) },
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
  const empty = kind === 'movie' ? 'No Movies' : kind === 'tvshow' ? 'No TV Shows' : 'No Videos';
  return <ListView rows={rows} variant="art" empty={empty} />;
}

function TvShows() {
  const os = useOS();
  const tracks = useTracks();
  const rows = useMemo<Row[]>(() => {
    const shows = new Map<string, Track[]>();
    for (const t of videosOfKind(tracks, 'tvshow')) {
      const k = t.show || t.album || 'TV Show';
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
  return <ListView rows={rows} empty="No TV Shows" />;
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
  return <ListView rows={rows} empty="No Video Playlists" />;
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

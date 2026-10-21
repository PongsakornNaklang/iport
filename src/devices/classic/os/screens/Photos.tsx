import { useEffect, useMemo, useRef, useState } from 'react';
import { Artwork } from '../../../../core/library/Artwork';
import { useArtworkUrl } from '../../../../core/library/artwork';
import { playlistTracks, usePlaylists } from '../../../../core/library/selectors';
import { useLibrary } from '../../../../core/library/store';
import { player } from '../../../../core/player/player';
import { useDeviceSetting } from '../../../../core/settings/store';
import type { Photo } from '../../../../core/types';
import { shuffleArray } from '../../../../core/player/player';
import { clamp, useHeader, useInput, useOS, useScreen } from '../core';
import { ChoiceList, toggleRow } from '../common';
import { ListView, type Row } from '../ListView';

const TRANSITIONS = ['Random', 'Dissolve', 'Push Across', 'Wipe Across', 'Zoom Out', 'Ken Burns', 'Cube Across', 'Off'];
const TIMES: { value: number; label: string }[] = [
  { value: 2, label: '2 Seconds' },
  { value: 3, label: '3 Seconds' },
  { value: 5, label: '5 Seconds' },
  { value: 10, label: '10 Seconds' },
  { value: 20, label: '20 Seconds' },
  { value: 0, label: 'Manual' },
];

function useSlideSettings() {
  const os = useOS();
  const [time, setTime] = useDeviceSetting<number>(os.modelId, 'ssTime', 3);
  const [music, setMusic] = useDeviceSetting<string>(os.modelId, 'ssMusic', 'nowplaying');
  const [repeat, setRepeat] = useDeviceSetting<boolean>(os.modelId, 'ssRepeat', true);
  const [shuffle, setShuffle] = useDeviceSetting<boolean>(os.modelId, 'ssShuffle', false);
  const [transition, setTransition] = useDeviceSetting<string>(os.modelId, 'ssTransition', 'Random');
  return { time, setTime, music, setMusic, repeat, setRepeat, shuffle, setShuffle, transition, setTransition };
}

export function PhotosMenu() {
  const os = useOS();
  const photos = useLibrary((s) => s.photos);
  const rows = useMemo<Row[]>(() => {
    const albums = [...new Set(photos.map((p) => p.album).filter(Boolean) as string[])].sort();
    return [
      { key: '__settings', label: 'Slideshow Settings', chevron: true, onSelect: () => os.nav.push({ title: 'Slideshow Settings', el: <SlideshowSettings /> }) },
      { key: '__all', label: 'Photo Library', chevron: true, onSelect: () => os.nav.push({ title: 'Photo Library', el: <PhotoGrid /> }) },
      ...(photos.some((p) => p.favorite)
        ? [{ key: '__fav', label: 'Favorites', chevron: true, onSelect: () => os.nav.push({ title: 'Favorites', el: <PhotoGrid filter="__fav" /> }) }]
        : []),
      ...albums.map((a) => ({ key: a, label: a, chevron: true, onSelect: () => os.nav.push({ title: a, el: <PhotoGrid filter={a} /> }) })),
    ];
  }, [photos, os]);
  return <ListView rows={rows} />;
}

function SlideshowSettings() {
  const os = useOS();
  const s = useSlideSettings();
  const lists = usePlaylists();
  const musicLabel = s.music === 'off' ? 'Off' : s.music === 'nowplaying' ? 'Now Playing' : lists.find((p) => p.id === s.music)?.name ?? 'Now Playing';
  const timeLabel = TIMES.find((t) => t.value === s.time)?.label ?? `${s.time} Seconds`;
  const rows: Row[] = [
    {
      key: 'time',
      label: 'Time Per Slide',
      detail: timeLabel.replace(' Seconds', ' Secs'),
      chevron: true,
      onSelect: () => os.nav.push({ title: 'Time Per Slide', el: <ChoiceList choices={TIMES} value={s.time} onPick={s.setTime} /> }),
    },
    {
      key: 'music',
      label: 'Music',
      detail: musicLabel,
      chevron: true,
      onSelect: () =>
        os.nav.push({
          title: 'Music',
          el: (
            <ChoiceList
              choices={[{ value: 'nowplaying', label: 'Now Playing' }, { value: 'off', label: 'Off' }, ...lists.map((p) => ({ value: p.id, label: p.name }))]}
              value={s.music}
              onPick={s.setMusic}
            />
          ),
        }),
    },
    toggleRow('Repeat', s.repeat, s.setRepeat),
    toggleRow('Shuffle Photos', s.shuffle, s.setShuffle),
    {
      key: 'tr',
      label: 'Transitions',
      detail: s.transition,
      chevron: true,
      onSelect: () => os.nav.push({ title: 'Transitions', el: <ChoiceList choices={TRANSITIONS.map((v) => ({ value: v, label: v }))} value={s.transition} onPick={s.setTransition} /> }),
    },
  ];
  return <ListView rows={rows} />;
}

function usePhotos(filter?: string): Photo[] {
  const photos = useLibrary((s) => s.photos);
  return useMemo(() => (filter === '__fav' ? photos.filter((p) => p.favorite) : filter ? photos.filter((p) => p.album === filter) : photos), [photos, filter]);
}

const COLS = 5;

function PhotoGrid({ filter }: { filter?: string }) {
  const os = useOS();
  const photos = usePhotos(filter);
  const [sel, setSel] = useState(0);
  const [topRow, setTopRow] = useState(0);
  const gap = 6;
  const size = Math.floor((os.width - gap * (COLS + 1)) / COLS);
  const areaH = os.height - os.hdr;
  const visRows = Math.max(1, Math.floor((areaH - gap) / (size + gap)));
  const s = clamp(sel, 0, Math.max(0, photos.length - 1));
  const row = Math.floor(s / COLS);
  let top = topRow;
  if (row < top) top = row;
  if (row >= top + visRows) top = row - visRows + 1;

  useInput((e) => {
    if (!photos.length) return false;
    if (e.type === 'scroll') {
      const ns = clamp(s + e.steps, 0, photos.length - 1);
      const r = Math.floor(ns / COLS);
      setSel(ns);
      setTopRow((t) => (r < t ? r : r >= t + visRows ? r - visRows + 1 : t));
      return true;
    }
    if (e.type === 'click' && e.button === 'select') {
      os.nav.push({ title: 'Photo', el: <PhotoViewer photos={photos} start={s} />, header: 'hidden' });
      return true;
    }
    if (e.type === 'click' && e.button === 'play') {
      os.nav.push({ title: 'Slideshow', el: <Slideshow photos={photos} start={s} />, header: 'hidden' });
      return true;
    }
    return false;
  });

  if (!photos.length) return <ListView rows={[]} empty="No Photos" />;
  const cells = [];
  for (let i = top * COLS; i < Math.min(photos.length, (top + visRows + 1) * COLS); i++) {
    const r = Math.floor(i / COLS) - top;
    const c = i % COLS;
    cells.push(
      <div key={photos[i].id} className={`cl-thumb ${i === s ? 'cl-thumb-sel' : ''}`} style={{ left: gap + c * (size + gap), top: gap + r * (size + gap), width: size, height: size }}>
        <Artwork src={`idb:${photos[i].blobKey}`} size={size} />
      </div>,
    );
  }
  return (
    <div className="cl-grid">
      {cells}
      <div className="cl-grid-count">
        {s + 1} of {photos.length}
      </div>
    </div>
  );
}

function PhotoImg({ photo, className, style }: { photo: Photo; className?: string; style?: React.CSSProperties }) {
  const url = useArtworkUrl(`idb:${photo.blobKey}`);
  return <div className={`cl-photo ${className ?? ''}`} style={{ backgroundImage: url ? `url("${url}")` : undefined, ...style }} />;
}

function PhotoViewer({ photos, start }: { photos: Photo[]; start: number }) {
  const os = useOS();
  useHeader('hidden');
  const [i, setI] = useState(start);
  const [dir, setDir] = useState(1);
  const go = (d: number) => {
    setDir(Math.sign(d) || 1);
    setI((x) => clamp(x + d, 0, photos.length - 1));
  };
  useInput((e) => {
    if (e.type === 'scroll') {
      go(Math.sign(e.steps));
      return true;
    }
    if (e.type === 'click' && (e.button === 'next' || e.button === 'prev')) {
      go(e.button === 'next' ? 1 : -1);
      return true;
    }
    if (e.type === 'click' && e.button === 'play') {
      os.nav.push({ title: 'Slideshow', el: <Slideshow photos={photos} start={i} />, header: 'hidden' });
      return true;
    }
    if (e.type === 'click' && e.button === 'select') return true;
    return false;
  });
  const p = photos[i];
  if (!p) return null;
  return (
    <div className="cl-viewer">
      <PhotoImg key={p.id} photo={p} className={dir > 0 ? 'cl-tr-push-in' : 'cl-tr-push-in-rev'} />
    </div>
  );
}

function Slideshow({ photos, start }: { photos: Photo[]; start: number }) {
  const { active } = useScreen();
  useHeader('hidden');
  const s = useSlideSettings();
  const lists = usePlaylists();
  const tracks = useLibrary((st) => st.tracks);
  const order = useMemo(() => {
    const idx = photos.map((_, k) => k);
    if (!s.shuffle) return [...idx.slice(start), ...idx.slice(0, start)];
    return shuffleArray(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, start]);
  const [n, setN] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const transRef = useRef<string[]>([]);

  // music
  useEffect(() => {
    if (s.music === 'off') return;
    if (s.music === 'nowplaying') {
      player.play();
      return;
    }
    const pl = lists.find((p) => p.id === s.music);
    if (pl) player.playTracks(playlistTracks(tracks, pl), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advance = (d: number) => {
    setN((x) => {
      const nx = x + d;
      if (nx >= order.length) {
        if (s.repeat) return 0;
        setEnded(true);
        return x;
      }
      return Math.max(0, nx);
    });
  };

  useEffect(() => {
    if (!active || paused || ended || !s.time || order.length < 2) return;
    const t = window.setTimeout(() => advance(1), s.time * 1000 + 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, paused, ended, active, s.time, order.length]);

  useInput((e) => {
    if (e.type === 'click' && e.button === 'play') {
      setPaused((p) => {
        if (p) player.play();
        else player.pause();
        return !p;
      });
      return true;
    }
    if (e.type === 'click' && (e.button === 'next' || e.button === 'prev')) {
      advance(e.button === 'next' ? 1 : -1);
      return true;
    }
    if (e.type === 'scroll') {
      advance(Math.sign(e.steps));
      return true;
    }
    if (e.type === 'click' && e.button === 'select') return true;
    return false;
  });

  const kinds = ['dissolve', 'push', 'wipe', 'zoom', 'kenburns', 'cube'];
  const name = s.transition;
  if (!transRef.current[n]) {
    transRef.current[n] =
      name === 'Random'
        ? kinds[Math.floor(Math.random() * kinds.length)]
        : name === 'Off'
          ? 'none'
          : ({ Dissolve: 'dissolve', 'Push Across': 'push', 'Wipe Across': 'wipe', 'Zoom Out': 'zoom', 'Ken Burns': 'kenburns', 'Cube Across': 'cube' } as Record<string, string>)[name] ?? 'dissolve';
  }
  const cur = photos[order[n]];
  const prev = n > 0 ? photos[order[n - 1]] : null;
  const tr = transRef.current[n];
  return (
    <div className="cl-viewer cl-slideshow">
      {prev && tr !== 'none' && <PhotoImg key={`p${n}`} photo={prev} className={`cl-tr-out-${tr}`} />}
      {cur && <PhotoImg key={`c${n}`} photo={cur} className={n > 0 ? `cl-tr-in-${tr}` : ''} style={tr === 'kenburns' || n === 0 ? undefined : undefined} />}
      {paused && <div className="cl-ss-paused">❚❚</div>}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useArtworkUrls } from '../../../../core/library/artwork';
import { albums, podcasts, radioStations, songs, useTracks } from '../../../../core/library/selectors';
import { useLibrary } from '../../../../core/library/store';
import { useCurrentTrack, usePlayer } from '../../../../core/player/player';
import { useSettings } from '../../../../core/settings/store';
import { useOS } from '../core';
import { ListView, type Row } from '../ListView';
import { PanelIcon } from '../glyphs';
import { R } from '../routes';
import { EX } from './Extras';
import { startGenius, playList } from './Music';
import { t } from '../i18n';

interface Item {
  label: string;
  panel: string;
  chevron: boolean;
  go: () => void;
}

export function MainMenu() {
  const os = useOS();
  const { nav, caps } = os;
  const mm = useSettings((s) => s.mainMenu);
  const hasNP = usePlayer((s) => !!s.currentId);
  const [hl, setHl] = useState(0);

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];
    const add = (label: string, panel: string, go: () => void, chevron = true) => list.push({ label, panel, go, chevron });
    const on = (k: string, def = false) => (mm[k] === undefined ? def : mm[k]);
    if (on('Music', true)) add('Music', 'music', () => nav.push(R.music()));
    if (caps.coverFlow && on('Cover Flow')) add('Cover Flow', 'music', () => nav.push(R.coverFlow()));
    if (caps.genius && on('Genius'))
      add('Genius', 'music', () => {
        const id = usePlayer.getState().currentId;
        if (id) startGenius(os, id);
        else os.hud('Play a song to start Genius');
      });
    if (caps.genius && on('Genius Mixes')) add('Genius Mixes', 'music', () => nav.push(R.geniusMixes()));
    if (on('Playlists')) add('Playlists', 'music', () => nav.push(R.playlists()));
    if (on('Artists')) add('Artists', 'music', () => nav.push(R.artists()));
    if (on('Albums')) add('Albums', 'music', () => nav.push(R.albums()));
    if (on('Songs')) add('Songs', 'music', () => nav.push(R.songs()));
    if (on('Genres')) add('Genres', 'music', () => nav.push(R.genres()));
    if (on('Composers')) add('Composers', 'music', () => nav.push(R.composers()));
    if (on('Audiobooks')) add('Audiobooks', 'music', () => nav.push(R.audiobooks()));
    if (caps.search && on('Search')) add('Search', 'music', () => nav.push(R.search()));
    if (caps.video && on('Videos', true)) add('Videos', 'videos', () => nav.push(R.videos()));
    if (caps.photos && on('Photos', true)) add('Photos', 'photos', () => nav.push(R.photos()));
    // before the classic, Podcasts lived in the Music menu
    if (caps.podcasts && !caps.backlightItem && on('Podcasts', true)) add('Podcasts', 'podcasts', () => nav.push(R.podcasts()));
    if (on('iTunes U')) add('iTunes U', 'podcasts', () => nav.push({ title: 'iTunes U', el: <ListView rows={[]} empty={t('No iTunes U')} /> }));
    if (on('Radio')) add('Radio', 'music', () => nav.push({ title: t('Radio'), el: <RadioScreen /> }));
    if (on('Extras', true)) add('Extras', 'extras', () => nav.push(R.extras()));
    if (caps.games && on('Games')) add('Games', 'extras', () => nav.push(EX.games()));
    if (on('Clock')) add('Clock', 'extras', () => nav.push(EX.clocks()));
    if (on('Contacts')) add('Contacts', 'extras', () => nav.push(EX.contacts()));
    if (on('Calendar')) add('Calendar', 'extras', () => nav.push(EX.calendar()));
    if (on('Notes')) add('Notes', 'extras', () => nav.push(EX.notes()));
    add('Settings', 'settings', () => nav.push(R.settings()));
    if (on('Shuffle Songs', true))
      add(
        'Shuffle Songs',
        'music',
        () => {
          const ids = songs(useLibrary.getState().tracks).map((t) => t.id);
          if (ids.length) playList(os, ids, 0, { shuffle: true });
        },
        false,
      );
    if (caps.backlightItem) add('Backlight', 'settings', () => os.toggleBacklight(), false);
    if (hasNP && on('Now Playing', true)) add('Now Playing', 'nowplaying', () => nav.nowPlaying());
    return list;
  }, [mm, caps, nav, os, hasNP]);

  const rows = useMemo<Row[]>(() => items.map((it) => ({ key: it.label, label: t(it.label), chevron: it.chevron, onSelect: it.go })), [items]);
  const panel = items[Math.min(hl, items.length - 1)]?.panel ?? 'music';

  if (!caps.splitMenu) return <ListView rows={rows} />;
  return (
    <div className="cl-split">
      <div className="cl-split-list" style={{ width: os.width / 2 }}>
        <ListView rows={rows} onHighlight={setHl} />
      </div>
      <ArtPanel kind={panel} width={os.width / 2} height={os.height - os.hdr} />
    </div>
  );
}

function RadioScreen() {
  const os = useOS();
  const tracks = useTracks();
  const rows = useMemo<Row[]>(() => {
    const st = radioStations(tracks);
    return st.map((t, i) => ({ key: t.id, label: t.title, onSelect: () => playList(os, st.map((x) => x.id), i) }));
  }, [tracks, os]);
  return <ListView rows={rows} empty={t('No Radio Stations')} />;
}

// ------------------------------------------------------------------ artwork panel

/** Image URLs that actually load (broken thumbnails are skipped). */
function useLoadedUrls(urls: (string | null)[]): string[] {
  const [ok, setOk] = useState<Record<string, boolean>>({});
  const key = urls.join('|');
  useEffect(() => {
    let alive = true;
    for (const u of urls) {
      if (!u || u in ok) continue;
      const img = new Image();
      img.onload = () => alive && setOk((m) => ({ ...m, [u]: img.naturalWidth > 0 }));
      img.onerror = () => alive && setOk((m) => ({ ...m, [u]: false }));
      img.src = u;
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return useMemo(() => [...new Set(urls.filter((u): u is string => !!u && ok[u] === true))], [key, ok]); // eslint-disable-line react-hooks/exhaustive-deps
}

function usePanelRefs(kind: string): (string | undefined)[] {
  const tracks = useTracks();
  const photos = useLibrary((s) => s.photos);
  const current = useCurrentTrack();
  return useMemo(() => {
    switch (kind) {
      case 'photos':
        return photos.slice(0, 40).map((p) => `idb:${p.blobKey}`);
      case 'videos':
        return Object.values(tracks)
          .filter((t) => t.mediaType === 'movie' || t.mediaType === 'tvshow' || t.mediaType === 'musicvideo' || (t.hasVideo && t.source === 'youtube'))
          .map((t) => t.artwork)
          .slice(0, 30);
      case 'podcasts':
        return podcasts(tracks).map((s) => s.artwork);
      case 'nowplaying':
        return [current?.artwork];
      default:
        return albums(tracks)
          .map((a) => a.artwork)
          .slice(0, 60);
    }
  }, [kind, tracks, photos, current?.artwork]);
}

const KB_VARIANTS = 4;

function ArtPanel({ kind, width, height }: { kind: string; width: number; height: number }) {
  const refs = usePanelRefs(kind);
  const urls = useArtworkUrls(refs);
  const loaded = useLoadedUrls(urls);
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
  }, [kind]);
  useEffect(() => {
    if (loaded.length < 2) return;
    const t = window.setInterval(() => setN((x) => x + 1), 6500);
    return () => window.clearInterval(t);
  }, [loaded.length, kind]);
  const url = loaded.length ? loaded[n % loaded.length] : null;
  const slideKey = `${kind}|${url ?? 'icon'}|${n}`;
  const [layers, setLayers] = useState<{ key: string; url: string | null; kind: string; kb: number }[]>([]);
  useEffect(() => {
    setLayers((ls) => {
      if (ls[ls.length - 1]?.key === slideKey) return ls;
      const kb = ((ls[ls.length - 1]?.kb ?? -1) + 1) % KB_VARIANTS;
      return [...ls.slice(-1), { key: slideKey, url, kind, kb }];
    });
  }, [slideKey, url, kind]);

  const size = Math.round(Math.max(width, height) * 1.1);
  return (
    <div className="cl-art-panel" style={{ width, height }}>
      {layers.map((l, i) => (
        <div key={l.key} className={`cl-art-layer ${i === layers.length - 1 && layers.length > 1 ? 'cl-art-in' : ''}`}>
          {l.url ? (
            <img
              src={l.url}
              alt=""
              draggable={false}
              className={`cl-kb cl-kb-${l.kb}`}
              style={{ width: size, height: size, left: (width - size) / 2, top: (height - size) / 2 }}
            />
          ) : (
            <div className="cl-art-icon">
              <PanelIcon kind={l.kind} size={Math.round(width * 0.55)} />
            </div>
          )}
        </div>
      ))}
      <div className="cl-art-shade" />
    </div>
  );
}

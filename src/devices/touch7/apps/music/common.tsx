import { createContext, useContext, type ReactNode } from 'react';
import { Artwork } from '../../../../core/library/Artwork';
import { useLibrary, ON_THE_GO_ID } from '../../../../core/library/store';
import { player, usePlayer } from '../../../../core/player/player';
import type { Playlist, Track } from '../../../../core/types';
import { albumKey } from '../../../../core/library/selectors';
import { Glyph } from '../../os/glyphs';
import { suppressNextClick } from '../../os/gesture';
import { os, type MenuItem } from '../../os/store';
import { screenY } from '../../os/ui';
import { openVideo } from '../VideoPlayer';

export interface MusicApi {
  openNowPlaying(): void;
  goAlbum(key: string): void;
  goArtist(name: string): void;
  push(node: ReactNode, title: string): void;
}
export const MusicCtx = createContext<MusicApi>({
  openNowPlaying: () => {},
  goAlbum: () => {},
  goArtist: () => {},
  push: () => {},
});
export const useMusic = () => useContext(MusicCtx);

export const isVideo = (t: Track) => t.mediaType === 'movie' || t.mediaType === 'tvshow' || (t.mediaType === 'musicvideo' && t.source !== 'youtube');

/** Start a list; videos open the full-screen player. */
export function playList(ids: string[], index = 0, shuffle = false) {
  const t = useLibrary.getState().tracks[ids[index]];
  if (t && isVideo(t) && !shuffle) {
    openVideo(ids, index);
    return;
  }
  player.playTracks(ids, index, { shuffle });
}

export function newPlaylistPrompt(ids: string[] = [], then?: (id: string) => void) {
  os.alert({
    title: 'New Playlist',
    message: 'Enter a name for this playlist.',
    input: { placeholder: 'Playlist Name' },
    actions: [
      { label: 'Cancel', style: 'cancel' },
      {
        label: 'Create',
        onPress: (name) => {
          const id = useLibrary.getState().createPlaylist((name ?? '').trim() || 'New Playlist', ids);
          if (ids.length) os.toast('Added to Playlist');
          then?.(id);
        },
      },
    ],
  });
}

export function addToPlaylistSheet(ids: string[]) {
  const lib = useLibrary.getState();
  const pls = lib.playlistOrder.map((id) => lib.playlists[id]).filter((p): p is Playlist => !!p && !p.smart);
  os.alert({
    sheet: true,
    title: 'Add to a Playlist',
    actions: [
      { label: 'New Playlist…', onPress: () => window.setTimeout(() => newPlaylistPrompt(ids), 250) },
      ...pls.map((p) => ({
        label: p.name,
        onPress: () => {
          if (p.id === ON_THE_GO_ID) lib.addToOnTheGo(ids);
          else lib.addToPlaylist(p.id, ids);
          os.toast('Added to Playlist');
        },
      })),
      { label: 'Cancel', style: 'cancel' as const },
    ],
  });
}

export function trackMenu(
  t: Track,
  y: number,
  api: MusicApi,
  extra: { playlist?: { id: string; index: number }; noAlbum?: boolean } = {},
) {
  const loved = (t.rating ?? 0) >= 5;
  const lib = useLibrary.getState();
  const items: MenuItem[] = [
    { label: 'Play Next', glyph: 'text.insert', onPress: () => (player.enqueueNext([t.id]), os.toast('Playing Next', 'text.insert')) },
    { label: 'Play Last', glyph: 'text.append', onPress: () => (player.enqueue([t.id]), os.toast('Playing Last', 'text.append')) },
    { label: 'Add to a Playlist…', glyph: 'text.badge.plus', onPress: () => addToPlaylistSheet([t.id]) },
    {
      label: loved ? 'Undo Love' : 'Love',
      glyph: loved ? 'heart.fill' : 'heart',
      onPress: () => {
        lib.setRating(t.id, loved ? 0 : 5);
        if (!loved) os.toast('Loved', 'heart.fill');
      },
    },
    { label: 'Suggest Less', glyph: 'hand.thumbsdown', onPress: () => lib.setRating(t.id, 1) },
  ];
  if (!extra.noAlbum && t.mediaType === 'music') {
    items.push({ label: 'Show Album', glyph: 'square.stack', onPress: () => api.goAlbum(albumKeyOf(t)) });
    items.push({ label: 'Go to Artist', glyph: 'music.mic', onPress: () => api.goArtist(t.artist) });
  }
  if (extra.playlist) {
    const pl = extra.playlist;
    items.push({ label: 'Delete from Playlist', glyph: 'minus', destructive: true, onPress: () => lib.removeFromPlaylist(pl.id, pl.index) });
  } else {
    items.push({
      label: 'Delete from Library',
      glyph: 'trash',
      destructive: true,
      onPress: () =>
        os.alert({
          sheet: true,
          message: 'Are you sure you want to delete this song from your library?',
          actions: [
            { label: 'Delete Song', style: 'destructive', onPress: () => lib.removeTracks([t.id]) },
            { label: 'Cancel', style: 'cancel' },
          ],
        }),
    });
  }
  os.showMenu(items, y, `${t.title} — ${t.artist}`);
}

export const albumKeyOf = (t: Track) => albumKey(t);

/** Animated "now playing" bars shown instead of a track number. */
export function Bars({ playing }: { playing: boolean }) {
  return (
    <span className={`t7m-bars ${playing ? 'on' : ''}`}>
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function useIsCurrent(id: string): { current: boolean; playing: boolean } {
  const cur = usePlayer((s) => s.currentId === id);
  const playing = usePlayer((s) => s.currentId === id && (s.status === 'playing' || s.status === 'loading'));
  return { current: cur, playing };
}

/** A song row with artwork (Songs lists, playlists, search). */
export function SongRow({
  t,
  onPress,
  playlist,
  showArt = true,
  number,
  sub,
}: {
  t: Track;
  onPress: () => void;
  playlist?: { id: string; index: number };
  showArt?: boolean;
  number?: number;
  sub?: string;
}) {
  const api = useMusic();
  const { current, playing } = useIsCurrent(t.id);
  const menu = (y: number) => trackMenu(t, y, api, { playlist, noAlbum: false });
  const lp = makeLP(menu);
  return (
    <div className={`t7m-row ${current ? 'current' : ''}`} onClick={onPress} {...lp}>
      {showArt ? (
        <div className="t7m-row-art">
          <Artwork src={t.artwork} size={48} radius={4} />
          {current && (
            <div className="t7m-row-art-over">
              <Bars playing={playing} />
            </div>
          )}
        </div>
      ) : (
        <div className="t7m-row-num">{current ? <Bars playing={playing} /> : number ?? ''}</div>
      )}
      <div className="t7m-row-main">
        <div className="t7m-row-text">
          <div className="t7m-row-title">
            {t.title}
            {(t.rating ?? 0) >= 5 && <Glyph name="heart.fill" size={10} className="t7m-loved" />}
          </div>
          {sub !== '' && <div className="t7m-row-sub">{sub ?? t.artist}</div>}
        </div>
        <button
          className="t7m-more"
          onClick={(e) => {
            e.stopPropagation();
            menu(screenY(e.currentTarget as HTMLElement));
          }}
          aria-label="More"
        >
          <Glyph name="ellipsis" size={18} />
        </button>
      </div>
    </div>
  );
}

/** long-press / right-click handlers */
export function makeLP(onLong: (y: number) => void) {
  let timer: number | undefined;
  let sx = 0;
  let sy = 0;
  return {
    onPointerDown(e: React.PointerEvent) {
      if (e.button !== 0) return;
      const el = e.currentTarget as HTMLElement;
      sx = e.clientX;
      sy = e.clientY;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        el.classList.add('t7-lifted');
        window.setTimeout(() => el.classList.remove('t7-lifted'), 300);
        suppressNextClick(700);
        onLong(screenY(el));
      }, 500);
    },
    onPointerMove(e: React.PointerEvent) {
      if (Math.hypot(e.clientX - sx, e.clientY - sy) > 8) window.clearTimeout(timer);
    },
    onPointerUp() {
      window.clearTimeout(timer);
    },
    onPointerCancel() {
      window.clearTimeout(timer);
    },
    onContextMenu(e: React.MouseEvent) {
      e.preventDefault();
      window.clearTimeout(timer);
      onLong(screenY(e.currentTarget as HTMLElement));
    },
  };
}

export function AlbumTile({ art, title, sub, onPress, size = 138, onLong }: { art?: string; title: string; sub?: string; onPress: () => void; size?: number; onLong?: (y: number) => void }) {
  const lp = onLong ? makeLP(onLong) : {};
  return (
    <div className="t7m-tile" style={{ width: size }} onClick={onPress} {...lp}>
      <Artwork src={art} size={size} radius={6} className="t7m-tile-art" />
      <div className="t7m-tile-title">{title}</div>
      {sub && <div className="t7m-tile-sub">{sub}</div>}
    </div>
  );
}

/** 2×2 artwork collage for playlists. */
export function Mosaic({ arts, size, radius = 6 }: { arts: (string | undefined)[]; size: number; radius?: number }) {
  const uniq = [...new Set(arts.filter(Boolean))] as string[];
  if (uniq.length < 4) return <Artwork src={uniq[0]} size={size} radius={radius} />;
  return (
    <div className="t7m-mosaic" style={{ width: size, height: size, borderRadius: radius }}>
      {uniq.slice(0, 4).map((a, i) => (
        <Artwork key={i} src={a} size={size / 2} />
      ))}
    </div>
  );
}

export function PlayShuffle({ ids, disabled }: { ids: string[]; disabled?: boolean }) {
  return (
    <div className="t7m-ps">
      <button className="t7m-psb" disabled={disabled || !ids.length} onClick={() => playList(ids, 0)}>
        <Glyph name="play.fill" size={15} /> Play
      </button>
      <button className="t7m-psb" disabled={disabled || !ids.length} onClick={() => playList(ids, 0, true)}>
        <Glyph name="shuffle" size={16} /> Shuffle
      </button>
    </div>
  );
}

export function minutes(sec: number): string {
  const m = Math.round(sec / 60);
  if (m >= 60) return `${Math.floor(m / 60)} hour${Math.floor(m / 60) === 1 ? '' : 's'}, ${m % 60} minutes`;
  return `${m} minute${m === 1 ? '' : 's'}`;
}

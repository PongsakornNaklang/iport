import { useMemo, useState } from 'react';
import { Artwork } from '../../../../core/library/Artwork';
import {
  albumKey,
  albums,
  albumsByKey,
  albumsOfArtist,
  artists,
  audiobooks,
  compilations,
  composers,
  geniusMixes,
  geniusPlaylist,
  genres,
  playlistTracks,
  songs,
  tracksOfArtist,
  usePlaylists,
  useTracks,
} from '../../../../core/library/selectors';
import { ON_THE_GO_ID, useLibrary } from '../../../../core/library/store';
import { player, usePlayer } from '../../../../core/player/player';
import { useSettings } from '../../../../core/settings/store';
import { clamp, useInput, useOS, type OSApi, type MenuOption } from '../core';
import { ListView, type Row } from '../ListView';
import { R } from '../routes';

// ------------------------------------------------------------------ shared helpers

/** Play `ids` from `index` and show Now Playing. */
export function playList(os: OSApi, ids: string[], index: number, opts: { shuffle?: boolean } = {}) {
  if (!ids.length) return;
  player.playTracks(ids, index, opts);
  os.nav.nowPlaying();
}

export function startGenius(os: OSApi, seedId: string) {
  const ids = geniusPlaylist(useLibrary.getState().tracks, seedId);
  if (ids.length < 3) {
    os.hud('Genius is not available for this song');
    return;
  }
  os.nav.push(R.genius(seedId));
}

/** Hold-center menu for a song. */
export function songMenu(os: OSApi, id: string, from: 'list' | 'nowplaying' = 'list') {
  const t = useLibrary.getState().tracks[id];
  if (!t) return;
  const addOTG: MenuOption = {
    label: 'Add to On-The-Go',
    action: () => {
      useLibrary.getState().addToOnTheGo([id]);
      os.hud('Added to On-The-Go');
    },
  };
  const genius: MenuOption[] = os.caps.genius ? [{ label: 'Start Genius', action: () => startGenius(os, id) }] : [];
  const album: MenuOption = { label: 'Browse Album', action: () => os.nav.push(R.album(albumKey(t), t.album || 'Unknown Album')) };
  const options: MenuOption[] =
    from === 'nowplaying'
      ? [...genius, addOTG, album, { label: 'Browse Artist', action: () => os.nav.push(R.artist(t.artist || 'Unknown Artist')) }, { label: 'Cancel' }]
      : [
          {
            label: 'Play Next',
            action: () => {
              player.enqueueNext([id]);
              os.hud('Play Next');
            },
          },
          addOTG,
          ...genius,
          album,
          { label: 'Cancel' },
        ];
  os.menu({ title: t.title, options });
}

/** A list of songs: select plays the list from that song, hold opens the song menu. */
const NO_ROWS: Row[] = [];

export function SongList({ ids, indexed, before = NO_ROWS, after = NO_ROWS, empty = 'No Songs' }: { ids: string[]; indexed?: boolean; before?: Row[]; after?: Row[]; empty?: string }) {
  const os = useOS();
  const tracks = useTracks();
  const current = usePlayer((s) => s.currentId);
  const rows = useMemo<Row[]>(
    () => [
      ...before,
      ...ids.map((id, i) => {
        const t = tracks[id];
        return {
          key: `${i}:${id}`,
          label: t?.title || 'Untitled',
          speaker: id === current,
          onSelect: () => playList(os, ids, i),
          onHold: () => songMenu(os, id),
        };
      }),
      ...after,
    ],
    [ids, tracks, current, os, before, after],
  );
  return <ListView rows={rows} indexed={indexed} empty={before.length || after.length ? undefined : empty} />;
}

// ------------------------------------------------------------------ Music menu

export function MusicMenu() {
  const os = useOS();
  const mm = useSettings((s) => s.musicMenu);
  const rows = useMemo(() => {
    const all: { label: string; go: () => void; cap?: boolean }[] = [
      { label: 'Cover Flow', go: () => os.nav.push(R.coverFlow()), cap: os.caps.coverFlow },
      { label: 'Genius Mixes', go: () => os.nav.push(R.geniusMixes()), cap: os.caps.genius },
      { label: 'Playlists', go: () => os.nav.push(R.playlists()) },
      { label: 'Artists', go: () => os.nav.push(R.artists()) },
      { label: 'Albums', go: () => os.nav.push(R.albums()) },
      { label: 'Compilations', go: () => os.nav.push(R.compilations()) },
      { label: 'Songs', go: () => os.nav.push(R.songs()) },
      { label: 'Genres', go: () => os.nav.push(R.genres()) },
      { label: 'Composers', go: () => os.nav.push(R.composers()) },
      { label: 'Audiobooks', go: () => os.nav.push(R.audiobooks()) },
      { label: 'Search', go: () => os.nav.push(R.search()), cap: os.caps.search },
    ];
    return all
      .filter((x) => x.cap !== false && mm[x.label] !== false)
      .map<Row>((x) => ({ key: x.label, label: x.label, chevron: true, onSelect: x.go }));
  }, [mm, os]);
  return <ListView rows={rows} />;
}

// ------------------------------------------------------------------ Playlists

export function PlaylistsScreen() {
  const os = useOS();
  const lists = usePlaylists();
  const rows = useMemo<Row[]>(
    () =>
      lists.map((p) => ({
        key: p.id,
        label: p.name,
        chevron: true,
        onSelect: () => os.nav.push(R.playlist(p.id, p.name)),
      })),
    [lists, os],
  );
  return <ListView rows={rows} empty="No Playlists" />;
}

export function PlaylistScreen({ id }: { id: string }) {
  const os = useOS();
  const tracks = useTracks();
  const p = useLibrary((s) => s.playlists[id]);
  const ids = useMemo(() => (p ? playlistTracks(tracks, p) : []), [tracks, p]);
  const after = useMemo<Row[]>(() => {
    if (!p?.onTheGo || !ids.length) return [];
    return [
      {
        key: '__save',
        label: 'Save Playlist',
        onSelect: () =>
          os.menu({
            title: 'Save On-The-Go?',
            options: [
              {
                label: 'Save Playlist',
                action: () => {
                  useLibrary.getState().saveOnTheGo();
                  os.hud('Playlist Saved');
                },
              },
              { label: 'Cancel' },
            ],
          }),
      },
      {
        key: '__clear',
        label: 'Clear Playlist',
        onSelect: () =>
          os.menu({
            title: 'Clear On-The-Go?',
            options: [{ label: 'Clear Playlist', action: () => useLibrary.getState().clearOnTheGo() }, { label: 'Cancel' }],
          }),
      },
    ];
  }, [p, ids.length, os]);
  if (!p) return <ListView rows={[]} empty="Playlist not found" />;
  return <SongList ids={ids} after={after} empty={id === ON_THE_GO_ID ? 'No Songs' : 'No Songs'} />;
}

// ------------------------------------------------------------------ Artists / Albums

export function ArtistsScreen() {
  const os = useOS();
  const tracks = useTracks();
  const rows = useMemo<Row[]>(
    () => artists(tracks).map((a) => ({ key: a.name, label: a.name, chevron: true, onSelect: () => os.nav.push(R.artist(a.name)) })),
    [tracks, os],
  );
  return <ListView rows={rows} indexed empty="No Artists" />;
}

export function ArtistScreen({ name }: { name: string }) {
  const os = useOS();
  const tracks = useTracks();
  const rows = useMemo<Row[]>(() => {
    const al = albumsOfArtist(tracks, name);
    return [
      { key: '__all', label: 'All Albums', chevron: true, onSelect: () => os.nav.push(R.artistSongs(name)) },
      ...al.map((a) => ({ key: a.key, label: a.title, chevron: true, onSelect: () => os.nav.push(R.album(a.key, a.title)) })),
    ];
  }, [tracks, name, os]);
  return <ListView rows={rows} />;
}

export function ArtistSongs({ name }: { name: string }) {
  const tracks = useTracks();
  const ids = useMemo(() => tracksOfArtist(tracks, name), [tracks, name]);
  return <SongList ids={ids} />;
}

export function AlbumsScreen() {
  const os = useOS();
  const tracks = useTracks();
  const rows = useMemo<Row[]>(
    () =>
      albums(tracks).map((a) => ({
        key: a.key,
        label: a.title,
        sub: a.artist,
        art: a.artwork,
        sort: a.title,
        chevron: true,
        onSelect: () => os.nav.push(R.album(a.key, a.title)),
      })),
    [tracks, os],
  );
  return <ListView rows={rows} variant="art" indexed empty="No Albums" />;
}

export function CompilationsScreen() {
  const os = useOS();
  const tracks = useTracks();
  const rows = useMemo<Row[]>(
    () =>
      compilations(tracks).map((a) => ({
        key: a.key,
        label: a.title,
        sub: a.artist,
        art: a.artwork,
        chevron: true,
        onSelect: () => os.nav.push(R.album(a.key, a.title)),
      })),
    [tracks, os],
  );
  return <ListView rows={rows} variant="art" empty="No Compilations" />;
}

export function AlbumScreen({ albumKey: key }: { albumKey: string }) {
  const tracks = useTracks();
  const ids = useMemo(() => albumsByKey(tracks).get(key)?.trackIds ?? [], [tracks, key]);
  return <SongList ids={ids} />;
}

// ------------------------------------------------------------------ Songs, Genres, Composers, Audiobooks

export function SongsScreen() {
  const tracks = useTracks();
  const ids = useMemo(() => songs(tracks).map((t) => t.id), [tracks]);
  return <SongList ids={ids} indexed />;
}

export function GenresScreen() {
  const os = useOS();
  const tracks = useTracks();
  const rows = useMemo<Row[]>(
    () => genres(tracks).map((g) => ({ key: g.name, label: g.name, chevron: true, onSelect: () => os.nav.push(R.genre(g.name)) })),
    [tracks, os],
  );
  return <ListView rows={rows} indexed empty="No Genres" />;
}

export function GenreScreen({ name }: { name: string }) {
  const os = useOS();
  const tracks = useTracks();
  const rows = useMemo<Row[]>(() => {
    const g = genres(tracks).find((x) => x.name === name);
    const ids = g?.trackIds ?? [];
    const names = [...new Set(ids.map((id) => tracks[id]?.artist || 'Unknown Artist'))].sort((a, b) => a.localeCompare(b));
    return [
      { key: '__all', label: 'All Songs', chevron: true, onSelect: () => os.nav.push({ title: name, el: <SongList ids={ids} /> }) },
      ...names.map((n) => ({ key: n, label: n, chevron: true, onSelect: () => os.nav.push(R.artist(n)) })),
    ];
  }, [tracks, name, os]);
  return <ListView rows={rows} />;
}

export function ComposersScreen() {
  const os = useOS();
  const tracks = useTracks();
  const rows = useMemo<Row[]>(
    () => composers(tracks).map((g) => ({ key: g.name, label: g.name, chevron: true, onSelect: () => os.nav.push(R.composer(g.name)) })),
    [tracks, os],
  );
  return <ListView rows={rows} indexed empty="No Composers" />;
}

export function ComposerScreen({ name }: { name: string }) {
  const tracks = useTracks();
  const ids = useMemo(() => composers(tracks).find((x) => x.name === name)?.trackIds ?? [], [tracks, name]);
  return <SongList ids={ids} />;
}

export function AudiobooksScreen() {
  const os = useOS();
  const tracks = useTracks();
  const current = usePlayer((s) => s.currentId);
  const rows = useMemo<Row[]>(
    () =>
      audiobooks(tracks).map((t) => ({
        key: t.id,
        label: t.title,
        speaker: t.id === current,
        onSelect: () => playList(os, [t.id], 0),
      })),
    [tracks, os, current],
  );
  return <ListView rows={rows} empty="No Audiobooks" />;
}

// ------------------------------------------------------------------ Genius

export function GeniusScreen({ seedId }: { seedId: string }) {
  const os = useOS();
  const [ids, setIds] = useState(() => geniusPlaylist(useLibrary.getState().tracks, seedId));
  const before = useMemo<Row[]>(
    () => [
      { key: '__refresh', label: 'Refresh', onSelect: () => setIds(geniusPlaylist(useLibrary.getState().tracks, seedId)) },
      {
        key: '__save',
        label: 'Save Playlist',
        onSelect: () => {
          useLibrary.getState().saveGenius(seedId, ids);
          os.hud('Playlist Saved');
        },
      },
    ],
    [seedId, ids, os],
  );
  return <SongList ids={ids} before={before} />;
}

/** Genius Mixes: a carousel of 2×2 artwork collages, like the classic. */
export function GeniusMixesScreen() {
  const os = useOS();
  const tracks = useTracks();
  const mixes = useMemo(() => geniusMixes(tracks), [tracks]);
  const [i, setI] = useState(0);
  useInput((e) => {
    if (e.type === 'scroll') {
      setI((x) => clamp(x + e.steps, 0, Math.max(0, mixes.length - 1)));
      return true;
    }
    if (e.type === 'click' && (e.button === 'select' || e.button === 'play')) {
      const m = mixes[i];
      if (m) playList(os, m.trackIds, 0, { shuffle: true });
      return true;
    }
    return false;
  });
  if (!mixes.length)
    return (
      <div className="cl-message">
        <b>No Genius Mixes</b>
        <span>Genius Mixes are created from your library when you have enough songs in a genre.</span>
      </div>
    );
  return (
    <div className="cl-mixes">
      <div className="cl-mixes-track" style={{ transform: `translateX(${-i * os.width}px)` }}>
        {mixes.map((m) => (
          <div key={m.name} className="cl-mix" style={{ width: os.width }}>
            <div className="cl-mix-art">
              {[0, 1, 2, 3].map((k) => (
                <Artwork key={k} src={m.artwork[k % Math.max(1, m.artwork.length)]} size={62} />
              ))}
              <div className="cl-mix-badge">Genius</div>
            </div>
            <div className="cl-mix-name">{m.name}</div>
          </div>
        ))}
      </div>
      <div className="cl-dots">
        {mixes.map((m, k) => (
          <span key={m.name} className={k === i ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}

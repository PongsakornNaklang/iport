import { useEffect, useMemo } from 'react';
import {
  albums,
  albumsOfArtist,
  artists,
  audiobooks,
  compilations,
  composers,
  geniusMixes,
  genres,
  playlistTracks,
  songs,
  tracksOfArtist,
  usePlaylists,
  type AlbumInfo,
} from '../../../core/library/selectors';
import { ON_THE_GO_ID, useLibrary } from '../../../core/library/store';
import { compareTitles, formatTime, indexLetter } from '../../../core/util/format';
import type { Playlist, Track } from '../../../core/types';
import { nano, useNano, useNanoData } from '../state';
import { Glyph } from '../os/icons';
import { NavStack, useNav, type PageSpec } from '../os/Nav';
import { Empty, Page, Row } from '../os/ui';
import { AlbumHeader, minutes, MUSIC_TINT, nowPlayingSpec, NowPlayingButton, ShuffleRow, TrackList, usePlayList } from './common';
import { useAppNav } from './registry';

let consumedNp = 0;

export function MusicApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('music');
  const npRequest = useNano((s) => s.npRequest);
  useEffect(() => {
    if (npRequest > consumedNp) {
      consumedNp = npRequest;
      const api = apiRef.current;
      if (api && api.topKind !== 'nowplaying') api.push(nowPlayingSpec());
    }
  }, [npRequest, apiRef]);
  return <NavStack root={{ title: 'Music', node: <MusicRoot />, right: <NowPlayingButton /> }} tint={MUSIC_TINT} active={active} apiRef={apiRef} />;
}

const page = (title: string, node: React.ReactNode, extra?: Partial<PageSpec>): PageSpec => ({ title, node, right: <NowPlayingButton />, ...extra });

function MusicRoot() {
  const nav = useNav();
  const tracks = useLibrary((s) => s.tracks);
  const group = useNanoData((s) => s.groupCompilations);
  const all = songs(tracks);
  const play = usePlayList();
  const mixes = useMemo(() => geniusMixes(tracks), [tracks]);
  const hasComp = compilations(tracks).length > 0;
  const books = audiobooks(tracks).length > 0;
  return (
    <Page>
      <Row icon={<Glyph.shuffle size={20} />} title="Shuffle" onClick={() => all.length && play(all.map((t) => t.id), 0, { shuffle: true })} />
      {mixes.length > 0 && <Row icon={<GeniusGlyph />} title="Genius Mixes" chevron onClick={() => nav.push(page('Genius Mixes', <GeniusMixesPage />))} />}
      <Row icon={<Glyph.playlists size={20} />} title="Playlists" chevron onClick={() => nav.push(page('Playlists', <PlaylistsPage />))} />
      <Row icon={<Glyph.artists size={20} />} title="Artists" chevron onClick={() => nav.push(page('Artists', <ArtistsPage />))} />
      <Row icon={<Glyph.albums size={20} />} title="Albums" chevron onClick={() => nav.push(page('Albums', <AlbumsPage />))} />
      <Row icon={<Glyph.songs size={20} />} title="Songs" chevron onClick={() => nav.push(page('Songs', <SongsPage />))} />
      <Row icon={<Glyph.genres size={20} />} title="Genres" chevron onClick={() => nav.push(page('Genres', <GroupsPage kind="genre" />))} />
      <Row icon={<Glyph.composers size={20} />} title="Composers" chevron onClick={() => nav.push(page('Composers', <GroupsPage kind="composer" />))} />
      {group && hasComp && <Row icon={<Glyph.compilations size={20} />} title="Compilations" chevron onClick={() => nav.push(page('Compilations', <AlbumsPage compilationsOnly />))} />}
      {books && <Row icon={<Glyph.audiobooks size={20} />} title="Audiobooks" chevron onClick={() => nav.push(page('Audiobooks', <AudiobooksList />))} />}
    </Page>
  );
}

function GeniusGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M12 2.5l2.4 6.1 6.6.4-5.1 4.2 1.7 6.4L12 16l-5.6 3.6 1.7-6.4L3 9l6.6-.4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------- playlists

function PlaylistsPage() {
  const lists = usePlaylists();
  const tracks = useLibrary((s) => s.tracks);
  const nav = useNav();
  return (
    <Page>
      {lists.map((p) => {
        const n = playlistTracks(tracks, p).length;
        return (
          <Row
            key={p.id}
            icon={p.smart ? <SmartGlyph /> : <Glyph.playlists size={20} />}
            title={p.name}
            detail={n ? String(n) : undefined}
            chevron
            onClick={() => nav.push(page(p.name, <PlaylistPage id={p.id} />))}
          />
        );
      })}
    </Page>
  );
}

function SmartGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PlaylistPage({ id }: { id: string }) {
  const p = useLibrary((s) => s.playlists[id]) as Playlist | undefined;
  const tracks = useLibrary((s) => s.tracks);
  const ids = p ? playlistTracks(tracks, p) : [];
  if (!p) return <Empty title="Playlist Deleted" />;
  return (
    <Page>
      {ids.length > 0 && <ShuffleRow ids={ids} />}
      <TrackList ids={ids} mode="art" />
      {ids.length === 0 && <Empty icon={<Glyph.playlists size={42} color="#c7c7cc" />} title="No Songs" text={p.onTheGo ? 'Add songs from Now Playing ▸ More ▸ Add to On-The-Go.' : undefined} />}
      {p.onTheGo && ids.length > 0 && (
        <div className="n7-btnrow">
          <button onClick={() => nano.sheet([{ label: 'Clear Playlist', destructive: true, onSelect: () => useLibrary.getState().clearOnTheGo() }])}>Clear</button>
          <button
            onClick={() => {
              const nid = useLibrary.getState().saveOnTheGo();
              if (nid) nano.toast('Playlist Saved');
            }}
          >
            Save
          </button>
        </div>
      )}
      {!p.smart && !p.onTheGo && id !== ON_THE_GO_ID && (
        <div className="n7-btnrow">
          <button className="destructive" onClick={() => nano.sheet([{ label: 'Delete Playlist', destructive: true, onSelect: () => useLibrary.getState().deletePlaylist(id) }])}>
            Delete Playlist
          </button>
        </div>
      )}
    </Page>
  );
}

function GeniusMixesPage() {
  const tracks = useLibrary((s) => s.tracks);
  const mixes = useMemo(() => geniusMixes(tracks), [tracks]);
  const play = usePlayList();
  return (
    <Page>
      {mixes.map((m) => (
        <Row key={m.name} art={m.artwork[0]} title={m.name} subtitle={`${m.trackIds.length} songs`} onClick={() => play(m.trackIds, 0)} />
      ))}
    </Page>
  );
}

// ---------------------------------------------------------------- artists / albums

function useArtists() {
  const tracks = useLibrary((s) => s.tracks);
  const group = useNanoData((s) => s.groupCompilations);
  return useMemo(() => {
    if (group) return artists(tracks).map((a) => ({ name: a.name, trackIds: a.trackIds }));
    // without grouping, compilation tracks are listed under their own artists
    const m = new Map<string, { name: string; trackIds: string[] }>();
    for (const t of songs(tracks)) {
      const name = (t.artist || 'Unknown Artist').trim() || 'Unknown Artist';
      let a = m.get(name.toLowerCase());
      if (!a) m.set(name.toLowerCase(), (a = { name, trackIds: [] }));
      a.trackIds.push(t.id);
    }
    return [...m.values()].sort((a, b) => compareTitles(a.name, b.name));
  }, [tracks, group]);
}

function ArtistsPage() {
  const list = useArtists();
  const tracks = useLibrary((s) => s.tracks);
  const nav = useNav();
  if (!list.length) return <Empty icon={<Glyph.artists size={42} color="#c7c7cc" />} title="No Artists" />;
  let last = '';
  return (
    <Page>
      {list.map((a) => {
        const L = indexLetter(a.name);
        const head = list.length > 10 && L !== last ? ((last = L), <div key={`L${L}`} className="n7-letter">{L}</div>) : null;
        const art = tracks[a.trackIds[0]]?.artwork;
        return [
          head,
          <Row
            key={a.name}
            art={art}
            artSize={32}
            title={a.name}
            subtitle={`${a.trackIds.length} song${a.trackIds.length === 1 ? '' : 's'}`}
            chevron
            onClick={() => nav.push(page(a.name, <ArtistPage name={a.name} ids={a.trackIds} />))}
          />,
        ];
      })}
    </Page>
  );
}

function ArtistPage({ name, ids }: { name: string; ids: string[] }) {
  const tracks = useLibrary((s) => s.tracks);
  const nav = useNav();
  const play = usePlayList();
  const albs = albumsOfArtist(tracks, name);
  const all = tracksOfArtist(tracks, name);
  const list = all.length ? all : ids;
  return (
    <Page>
      <Row icon={<Glyph.songs size={20} />} title="All Songs" detail={String(list.length)} chevron onClick={() => nav.push(page(name, <SongListPage ids={list} />, { backLabel: name }))} />
      <Row icon={<Glyph.shuffle size={20} />} title="Shuffle" onClick={() => play(list, 0, { shuffle: true })} />
      {albs.map((al) => (
        <AlbumRow key={al.key} al={al} />
      ))}
    </Page>
  );
}

function AlbumRow({ al }: { al: AlbumInfo }) {
  const nav = useNav();
  return (
    <Row
      art={al.artwork}
      artSize={40}
      title={al.title}
      subtitle={[al.artist, al.year].filter(Boolean).join(' · ')}
      chevron
      tall
      onClick={() => nav.push(page(al.title, <AlbumPage albumKey={al.key} />))}
    />
  );
}

function AlbumsPage({ compilationsOnly }: { compilationsOnly?: boolean }) {
  const tracks = useLibrary((s) => s.tracks);
  const group = useNanoData((s) => s.groupCompilations);
  let list = compilationsOnly ? compilations(tracks) : albums(tracks);
  if (!compilationsOnly && group) list = list.filter((a) => !a.compilation);
  if (!list.length) return <Empty icon={<Glyph.albums size={42} color="#c7c7cc" />} title="No Albums" />;
  return (
    <Page>
      {list.map((al) => (
        <AlbumRow key={al.key} al={al} />
      ))}
    </Page>
  );
}

function AlbumPage({ albumKey }: { albumKey: string }) {
  const tracks = useLibrary((s) => s.tracks);
  const al = albums(tracks).find((a) => a.key === albumKey);
  if (!al) return <Empty title="No Songs" />;
  const meta = [al.year, `${al.trackIds.length} Song${al.trackIds.length === 1 ? '' : 's'}`, al.duration ? minutes(al.duration) : ''].filter(Boolean).join(', ');
  return (
    <Page>
      <AlbumHeader art={al.artwork} title={al.title} artist={al.artist} meta={meta} />
      <ShuffleRow ids={al.trackIds} />
      <TrackList ids={al.trackIds} mode="album" />
    </Page>
  );
}

// ---------------------------------------------------------------- songs / genres / composers

function SongsPage() {
  const tracks = useLibrary((s) => s.tracks);
  const ids = songs(tracks).map((t) => t.id);
  if (!ids.length) return <Empty icon={<Glyph.songs size={42} color="#c7c7cc" />} title="No Songs" text="Add music in the Library panel." />;
  return (
    <Page>
      <ShuffleRow ids={ids} />
      <TrackList ids={ids} mode="song" letters={ids.length > 12} />
    </Page>
  );
}

function SongListPage({ ids }: { ids: string[] }) {
  return (
    <Page>
      <ShuffleRow ids={ids} />
      <TrackList ids={ids} mode="art" />
    </Page>
  );
}

function GroupsPage({ kind }: { kind: 'genre' | 'composer' }) {
  const tracks = useLibrary((s) => s.tracks);
  const nav = useNav();
  const list = kind === 'genre' ? genres(tracks) : composers(tracks);
  if (!list.length) return <Empty icon={kind === 'genre' ? <Glyph.genres size={42} color="#c7c7cc" /> : <Glyph.composers size={42} color="#c7c7cc" />} title={kind === 'genre' ? 'No Genres' : 'No Composers'} />;
  return (
    <Page>
      {list.map((g) => (
        <Row
          key={g.name}
          art={tracks[g.trackIds[0]]?.artwork}
          artSize={32}
          title={g.name}
          subtitle={`${g.trackIds.length} song${g.trackIds.length === 1 ? '' : 's'}`}
          chevron
          onClick={() => nav.push(page(g.name, <SongListPage ids={g.trackIds} />))}
        />
      ))}
    </Page>
  );
}

export function AudiobooksList() {
  const tracks = useLibrary((s) => s.tracks);
  const list = audiobooks(tracks);
  const play = usePlayList();
  if (!list.length) return <Empty icon={<Glyph.audiobooks size={42} color="#c7c7cc" />} title="No Audiobooks" text="Audiobooks you add appear here." />;
  const ids = list.map((t) => t.id);
  return (
    <Page>
      {list.map((t: Track, i) => (
        <Row
          key={t.id}
          art={t.artwork}
          title={t.title}
          subtitle={[t.artist, t.bookmark ? `${formatTime(t.bookmark)} played` : formatTime(t.duration)].filter(Boolean).join(' · ')}
          onClick={() => play(ids, i)}
        />
      ))}
    </Page>
  );
}

export function AudiobooksApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('audiobooks');
  return <NavStack root={{ title: 'Audiobooks', node: <AudiobooksList />, right: <NowPlayingButton /> }} tint="#ff9500" active={active} apiRef={apiRef} />;
}

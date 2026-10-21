import { useMemo, useRef } from 'react';
import { Artwork } from '../../../../core/library/Artwork';
import { useLibrary } from '../../../../core/library/store';
import {
  albums,
  albumsByKey,
  albumsOfArtist,
  artists,
  compilations,
  composers,
  genres,
  geniusMixes,
  playlistTracks,
  songs,
  usePlaylists,
  useTracks,
  videosOf,
  type AlbumInfo,
} from '../../../../core/library/selectors';
import type { Playlist } from '../../../../core/types';
import { player } from '../../../../core/player/player';
import { indexLetter } from '../../../../core/util/format';
import { Glyph } from '../../os/glyphs';
import { os } from '../../os/store';
import { Empty, Page, useNav, GlyphButton, screenY } from '../../os/ui';
import { openVideo } from '../VideoPlayer';
import { AlbumTile, Bars, Mosaic, PlayShuffle, SongRow, minutes, newPlaylistPrompt, playList, trackMenu, useIsCurrent, useMusic, makeLP } from './common';

const ROWS: { id: string; label: string; glyph: string }[] = [
  { id: 'playlists', label: 'Playlists', glyph: 'music.note.list' },
  { id: 'artists', label: 'Artists', glyph: 'music.mic' },
  { id: 'albums', label: 'Albums', glyph: 'square.stack' },
  { id: 'songs', label: 'Songs', glyph: 'music.note' },
  { id: 'madeforyou', label: 'Made For You', glyph: 'person.crop.square' },
  { id: 'videos', label: 'Music Videos', glyph: 'tv' },
  { id: 'genres', label: 'Genres', glyph: 'guitars' },
  { id: 'compilations', label: 'Compilations', glyph: 'person.2.square.stack' },
  { id: 'composers', label: 'Composers', glyph: 'music.quarternote.3' },
];

export function openLibrarySection(id: string, push: (n: React.ReactNode, t: string) => void) {
  const r = ROWS.find((x) => x.id === id);
  const title = r?.label ?? id;
  switch (id) {
    case 'playlists':
      return push(<PlaylistsPage />, title);
    case 'artists':
      return push(<ArtistsPage />, title);
    case 'albums':
      return push(<AlbumsPage />, title);
    case 'songs':
      return push(<SongsPage />, title);
    case 'madeforyou':
      return push(<MadeForYouPage />, title);
    case 'videos':
      return push(<VideosPage />, title);
    case 'genres':
      return push(<GenresPage />, title);
    case 'compilations':
      return push(<CompilationsPage />, title);
    case 'composers':
      return push(<ComposersPage />, title);
  }
}

export function LibraryRoot() {
  const nav = useNav()!;
  const tracks = useTracks();
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: AlbumInfo[] = [];
    const all = albums(tracks);
    const byKey = new Map(all.map((a) => [a.key, a]));
    const sorted = songs(tracks)
      .slice()
      .sort((a, b) => b.addedAt - a.addedAt);
    for (const t of sorted) {
      const k = all.find((a) => a.trackIds.includes(t.id))?.key;
      if (!k || seen.has(k)) continue;
      seen.add(k);
      const a = byKey.get(k);
      if (a) out.push(a);
      if (out.length >= 12) break;
    }
    return out;
  }, [tracks]);
  return (
    <Page title="Library" right={<button className="t7-tbtn">Edit</button>}>
      <div className="t7m-libmenu">
        {ROWS.map((r) => (
          <div key={r.id} className="t7m-librow" onClick={() => openLibrarySection(r.id, nav.push)}>
            <Glyph name={r.glyph} size={24} className="t7m-librow-g" />
            <div className="t7m-librow-main">
              <span>{r.label}</span>
              <Glyph name="chevron.right" size={14} className="t7-cell-chev" />
            </div>
          </div>
        ))}
      </div>
      <h2 className="t7m-h2">Recently Added</h2>
      {recent.length ? (
        <div className="t7m-grid">
          {recent.map((a) => (
            <AlbumTile key={a.key} art={a.artwork} title={a.title} sub={a.artist} onPress={() => nav.push(<AlbumPage albumKey={a.key} />, a.title)} />
          ))}
        </div>
      ) : (
        <Empty glyph="music.note" title="Add Music to Your Library" text="Use the Library button above the iPod to import files, YouTube, SoundCloud or free music." />
      )}
    </Page>
  );
}

// ------------------------------------------------------------------ playlists

export function PlaylistsPage() {
  const nav = useNav()!;
  const tracks = useTracks();
  const pls = usePlaylists();
  return (
    <Page title="Playlists">
      <div className="t7m-list">
        <div className="t7m-plrow" onClick={() => newPlaylistPrompt([], (id) => nav.push(<PlaylistPage id={id} />, 'Playlist'))}>
          <div className="t7m-plnew">
            <Glyph name="plus" size={26} />
          </div>
          <div className="t7m-plrow-main">
            <span className="tint">New Playlist…</span>
          </div>
        </div>
        {pls.map((p) => {
          const ids = playlistTracks(tracks, p);
          return (
            <div
              key={p.id}
              className="t7m-plrow"
              onClick={() => nav.push(<PlaylistPage id={p.id} />, p.name)}
              {...makeLP((y) => playlistMenu(p, ids, y))}
            >
              <Mosaic arts={ids.map((id) => tracks[id]?.artwork)} size={56} radius={5} />
              <div className="t7m-plrow-main">
                <div>
                  <div className="t7m-plrow-t">{p.name}</div>
                  <div className="t7m-plrow-s">{p.smart ? 'Smart Playlist' : `${ids.length} song${ids.length === 1 ? '' : 's'}`}</div>
                </div>
                <Glyph name="chevron.right" size={14} className="t7-cell-chev" />
              </div>
            </div>
          );
        })}
      </div>
    </Page>
  );
}

function playlistMenu(p: Playlist, ids: string[], y: number) {
  const lib = useLibrary.getState();
  os.showMenu(
    [
      { label: 'Play', glyph: 'play.fill', onPress: () => playList(ids, 0) },
      { label: 'Shuffle', glyph: 'shuffle', onPress: () => playList(ids, 0, true) },
      ...(p.smart || p.onTheGo
        ? p.onTheGo
          ? [{ label: 'Clear Playlist', glyph: 'trash', destructive: true, onPress: () => lib.clearOnTheGo() }]
          : []
        : [
            {
              label: 'Rename',
              glyph: 'pencil',
              onPress: () =>
                os.alert({
                  title: 'Rename Playlist',
                  input: { value: p.name },
                  actions: [
                    { label: 'Cancel', style: 'cancel' },
                    { label: 'Save', onPress: (v) => v?.trim() && lib.renamePlaylist(p.id, v.trim()) },
                  ],
                }),
            },
            { label: 'Delete from Library', glyph: 'trash', destructive: true, onPress: () => lib.deletePlaylist(p.id) },
          ]),
    ],
    y,
    p.name,
  );
}

export function PlaylistPage({ id }: { id: string }) {
  const tracks = useTracks();
  const p = useLibrary((s) => s.playlists[id]);
  const ids = useMemo(() => (p ? playlistTracks(tracks, p) : []), [tracks, p]);
  if (!p) return <Page title="Playlist" large={false} />;
  const dur = ids.reduce((s, i) => s + (tracks[i]?.duration ?? 0), 0);
  return (
    <Page
      title={p.name}
      large={false}
      right={<GlyphButton glyph="ellipsis" onPress={() => playlistMenu(p, ids, 70)} />}
    >
      <div className="t7m-albhead">
        <Mosaic arts={ids.map((x) => tracks[x]?.artwork)} size={220} radius={8} />
        <div className="t7m-albtitle">{p.name}</div>
        <div className="t7m-albsub">{p.smart ? 'Smart Playlist · updated automatically' : p.onTheGo ? 'On-The-Go' : 'Playlist'}</div>
        <PlayShuffle ids={ids} />
      </div>
      {ids.length ? (
        <div className="t7m-list">
          {ids.map((tid, i) =>
            tracks[tid] ? (
              <SongRow key={`${tid}-${i}`} t={tracks[tid]} onPress={() => playList(ids, i)} playlist={!p.smart ? { id: p.id, index: i } : undefined} />
            ) : null,
          )}
          <div className="t7m-foot">
            {ids.length} song{ids.length === 1 ? '' : 's'}, {minutes(dur)}
          </div>
        </div>
      ) : (
        <Empty title={p.smart ? 'Nothing Here Yet' : 'Empty Playlist'} text={p.smart ? 'This smart playlist fills itself as you listen.' : 'Long-press any song and choose “Add to a Playlist…”.'} />
      )}
    </Page>
  );
}

// ------------------------------------------------------------------ artists

export function ArtistsPage() {
  const nav = useNav()!;
  const tracks = useTracks();
  const list = artists(tracks);
  const byKey = albumsByKey(tracks);
  return (
    <Page title="Artists">
      {list.length ? (
        <div className="t7m-list">
          {list.map((a) => {
            const art = a.albumKeys.map((k) => byKey.get(k)?.artwork).find(Boolean);
            return (
              <div key={a.name} className="t7m-artrow" onClick={() => nav.push(<ArtistPage name={a.name} />, a.name)}>
                <Artwork src={art} size={44} radius={22} />
                <div className="t7m-artrow-main">
                  <span>{a.name}</span>
                  <Glyph name="chevron.right" size={14} className="t7-cell-chev" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty glyph="music.mic" title="No Artists" />
      )}
    </Page>
  );
}

export function ArtistPage({ name }: { name: string }) {
  const nav = useNav()!;
  const tracks = useTracks();
  const als = albumsOfArtist(tracks, name);
  const all = als.flatMap((a) => a.trackIds.filter((id) => tracks[id] && (tracks[id].artist || '').toLowerCase() === name.toLowerCase()));
  const top = [...all].sort((a, b) => (tracks[b].playCount ?? 0) - (tracks[a].playCount ?? 0)).slice(0, 5);
  return (
    <Page title={name}>
      <div className="t7m-artist-actions">
        <PlayShuffle ids={all} />
      </div>
      {top.length > 0 && (
        <>
          <h2 className="t7m-h2">Top Songs</h2>
          <div className="t7m-list">
            {top.map((id) => (
              <SongRow key={id} t={tracks[id]} sub={tracks[id].album} onPress={() => playList(all, all.indexOf(id))} />
            ))}
          </div>
        </>
      )}
      <h2 className="t7m-h2">Albums</h2>
      <div className="t7m-grid">
        {als.map((a) => (
          <AlbumTile key={a.key} art={a.artwork} title={a.title} sub={a.year ? String(a.year) : undefined} onPress={() => nav.push(<AlbumPage albumKey={a.key} />, a.title)} />
        ))}
      </div>
    </Page>
  );
}

// ------------------------------------------------------------------ albums

export function AlbumsPage() {
  const nav = useNav()!;
  const tracks = useTracks();
  const list = albums(tracks);
  return (
    <Page title="Albums">
      {list.length ? (
        <div className="t7m-grid">
          {list.map((a) => (
            <AlbumTile
              key={a.key}
              art={a.artwork}
              title={a.title}
              sub={a.artist}
              onPress={() => nav.push(<AlbumPage albumKey={a.key} />, a.title)}
              onLong={(y) =>
                os.showMenu(
                  [
                    { label: 'Play', glyph: 'play.fill', onPress: () => playList(a.trackIds, 0) },
                    { label: 'Shuffle', glyph: 'shuffle', onPress: () => playList(a.trackIds, 0, true) },
                    { label: 'Play Next', glyph: 'text.insert', onPress: () => player.enqueueNext(a.trackIds) },
                    { label: 'Delete from Library', glyph: 'trash', destructive: true, onPress: () => useLibrary.getState().removeTracks(a.trackIds) },
                  ],
                  y,
                  a.title,
                )
              }
            />
          ))}
        </div>
      ) : (
        <Empty glyph="square.stack" title="No Albums" />
      )}
    </Page>
  );
}

export function AlbumPage({ albumKey }: { albumKey: string }) {
  const tracks = useTracks();
  const a = albumsByKey(tracks).get(albumKey);
  const api = useMusic();
  if (!a) return <Page title="Album" large={false} />;
  const multiDisc = new Set(a.trackIds.map((id) => tracks[id]?.discNo ?? 1)).size > 1;
  return (
    <Page title={a.title} large={false} right={<GlyphButton glyph="ellipsis" onPress={() => os.showMenu([{ label: 'Add to Library', glyph: 'plus', disabled: true }, { label: 'Play Next', glyph: 'text.insert', onPress: () => player.enqueueNext(a.trackIds) }], 70, a.title)} />}>
      <div className="t7m-albhead">
        <Artwork src={a.artwork} size={220} radius={8} className="t7m-albart" />
        <div className="t7m-albtitle">{a.title}</div>
        <div className="t7m-albartist" onClick={() => !a.compilation && api.goArtist(a.artist)}>
          {a.artist}
        </div>
        <div className="t7m-albsub">{[a.genre, a.year].filter(Boolean).join(' · ')}</div>
        <PlayShuffle ids={a.trackIds} />
      </div>
      <div className="t7m-list t7m-tracks">
        {a.trackIds.map((id, i) => {
          const t = tracks[id];
          if (!t) return null;
          return <AlbumTrackRow key={id} id={id} i={i} n={t.trackNo ?? i + 1} ids={a.trackIds} sub={a.compilation ? t.artist : undefined} disc={multiDisc ? t.discNo : undefined} />;
        })}
        <div className="t7m-foot">
          {a.trackIds.length} song{a.trackIds.length === 1 ? '' : 's'}, {minutes(a.duration)}
        </div>
      </div>
    </Page>
  );
}

function AlbumTrackRow({ id, i, n, ids, sub }: { id: string; i: number; n: number; ids: string[]; sub?: string; disc?: number }) {
  const t = useLibrary((s) => s.tracks[id]);
  const api = useMusic();
  const { current, playing } = useIsCurrent(id);
  const menu = (y: number) => trackMenu(t, y, api, { noAlbum: true });
  return (
    <div className={`t7m-trow ${current ? 'current' : ''}`} onClick={() => playList(ids, i)} {...makeLP(menu)}>
      <div className="t7m-trow-n">{current ? <Bars playing={playing} /> : n}</div>
      <div className="t7m-trow-main">
        <div className="t7m-trow-text">
          <div className="t7m-trow-t">
            {t.title}
            {(t.rating ?? 0) >= 5 && <Glyph name="heart.fill" size={10} className="t7m-loved" />}
          </div>
          {sub && <div className="t7m-row-sub">{sub}</div>}
        </div>
        <button
          className="t7m-more"
          onClick={(e) => {
            e.stopPropagation();
            menu(screenY(e.currentTarget as HTMLElement));
          }}
        >
          <Glyph name="ellipsis" size={18} />
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ songs

export function SongsPage() {
  const tracks = useTracks();
  const list = songs(tracks);
  const ids = useMemo(() => list.map((t) => t.id), [list]);
  const letters = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach((t, i) => {
      const l = indexLetter(t.title);
      if (!m.has(l)) m.set(l, i);
    });
    return m;
  }, [list]);
  const host = useRef<HTMLDivElement>(null);
  const jump = (l: string) => {
    const i = letters.get(l);
    if (i == null) return;
    const scroller = host.current?.closest('.t7-scroll') as HTMLElement | null;
    const row = host.current?.children[i] as HTMLElement | undefined;
    if (scroller && row) scroller.scrollTop = row.offsetTop + (host.current?.offsetTop ?? 0) - 70;
  };
  return (
    <div className="t7m-songs-wrap">
      <Page title="Songs">
        <PlayShuffle ids={ids} />
        <div className="t7m-list" ref={host}>
          {list.map((t, i) => (
            <SongRow key={t.id} t={t} onPress={() => playList(ids, i)} />
          ))}
        </div>
        {!list.length && <Empty glyph="music.note" title="No Songs" />}
      </Page>
      {list.length > 12 && (
        <div className="t7m-index">
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('').map((l) => (
            <span key={l} onClick={() => jump(l)}>
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ genres / composers / compilations / videos / made for you

export function GenresPage() {
  const nav = useNav()!;
  const tracks = useTracks();
  const list = genres(tracks);
  return (
    <Page title="Genres">
      <div className="t7m-list">
        {list.map((g) => (
          <div key={g.name} className="t7m-plainrow" onClick={() => nav.push(<TrackListPage title={g.name} ids={g.trackIds} />, g.name)}>
            <span>{g.name}</span>
            <Glyph name="chevron.right" size={14} className="t7-cell-chev" />
          </div>
        ))}
      </div>
      {!list.length && <Empty glyph="guitars" title="No Genres" />}
    </Page>
  );
}

export function ComposersPage() {
  const nav = useNav()!;
  const tracks = useTracks();
  const list = composers(tracks);
  return (
    <Page title="Composers">
      <div className="t7m-list">
        {list.map((g) => (
          <div key={g.name} className="t7m-plainrow" onClick={() => nav.push(<TrackListPage title={g.name} ids={g.trackIds} />, g.name)}>
            <span>{g.name}</span>
            <Glyph name="chevron.right" size={14} className="t7-cell-chev" />
          </div>
        ))}
      </div>
      {!list.length && <Empty glyph="music.quarternote.3" title="No Composers" text="Songs with composer tags appear here." />}
    </Page>
  );
}

export function TrackListPage({ title, ids }: { title: string; ids: string[] }) {
  const tracks = useTracks();
  const live = ids.filter((id) => tracks[id]);
  return (
    <Page title={title}>
      <PlayShuffle ids={live} />
      <div className="t7m-list">
        {live.map((id, i) => (
          <SongRow key={id} t={tracks[id]} onPress={() => playList(live, i)} />
        ))}
      </div>
    </Page>
  );
}

export function CompilationsPage() {
  const nav = useNav()!;
  const tracks = useTracks();
  const list = compilations(tracks);
  return (
    <Page title="Compilations">
      {list.length ? (
        <div className="t7m-grid">
          {list.map((a) => (
            <AlbumTile key={a.key} art={a.artwork} title={a.title} sub="Various Artists" onPress={() => nav.push(<AlbumPage albumKey={a.key} />, a.title)} />
          ))}
        </div>
      ) : (
        <Empty glyph="person.2.square.stack" title="No Compilations" />
      )}
    </Page>
  );
}

export function VideosPage() {
  const tracks = useTracks();
  const list = videosOf(tracks, 'musicvideo');
  const ids = list.map((t) => t.id);
  return (
    <Page title="Music Videos">
      {list.length ? (
        <div className="t7m-vgrid">
          {list.map((t, i) => (
            <div key={t.id} className="t7m-vtile" onClick={() => openVideo(ids, i)}>
              <div className="t7m-vthumb">
                <Artwork src={t.artwork} radius={6} />
                <Glyph name="play.circle.fill" size={30} className="t7m-vplay" />
              </div>
              <div className="t7m-tile-title">{t.title}</div>
              <div className="t7m-tile-sub">{t.artist}</div>
            </div>
          ))}
        </div>
      ) : (
        <Empty glyph="tv" title="No Music Videos" />
      )}
    </Page>
  );
}

export function MadeForYouPage() {
  const nav = useNav()!;
  const tracks = useTracks();
  const mixes = useMemo(() => geniusMixes(tracks), [tracks]);
  return (
    <Page title="Made For You">
      {mixes.length ? (
        <div className="t7m-grid">
          {mixes.map((m) => (
            <AlbumTile key={m.name} art={m.artwork[0]} title={m.name} sub="Genius Mix" onPress={() => nav.push(<TrackListPage title={m.name} ids={m.trackIds} />, m.name)} />
          ))}
        </div>
      ) : (
        <Empty glyph="person.crop.square" title="Keep Listening" text="Mixes appear when you have at least three songs in a genre." />
      )}
    </Page>
  );
}

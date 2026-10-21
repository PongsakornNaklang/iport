import { useEffect, useMemo, useState } from 'react';
import { Artwork } from '../../../../core/library/Artwork';
import { useLibrary } from '../../../../core/library/store';
import { albums, artists, genres, geniusMixes, radioStations, searchLibrary, songs, useTracks, type AlbumInfo } from '../../../../core/library/selectors';
import { player } from '../../../../core/player/player';
import { audiusSearch, audiusTrending } from '../../../../core/sources/audius';
import { stationTrack, topStations, type Station } from '../../../../core/sources/radio';
import { youtubeSearch, youtubeTrack } from '../../../../core/sources/youtube';
import type { Track } from '../../../../core/types';
import { Glyph } from '../../os/glyphs';
import { os } from '../../os/store';
import { Scroller } from '../../os/Scroller';
import { Empty, Page, SearchField, Segmented, useNav } from '../../os/ui';
import { AlbumTile, playList, SongRow, useMusic } from './common';
import { AlbumPage, ArtistPage, TrackListPage, openLibrarySection } from './library';

/** Add a remote track to the library and play it. */
export function playRemote(t: Track, list?: Track[]) {
  const lib = useLibrary.getState();
  if (list && list.length > 1) {
    const added = lib.addTracks(list);
    const i = list.indexOf(t);
    player.playTracks(
      added.map((x) => x.id),
      Math.max(0, i),
    );
    return;
  }
  const [added] = lib.addTracks([t]);
  if (added) player.playTracks([added.id], 0);
}

function useRemote<T>(key: string, fn: () => Promise<T>): { data: T | null; error: boolean; loading: boolean } {
  const [st, setSt] = useState<{ data: T | null; error: boolean; loading: boolean }>(() => {
    const c = remoteCache.get(key) as T | undefined;
    return { data: c ?? null, error: false, loading: !c };
  });
  useEffect(() => {
    if (remoteCache.has(key)) return;
    let alive = true;
    setSt({ data: null, error: false, loading: true });
    fn()
      .then((d) => {
        remoteCache.set(key, d);
        if (alive) setSt({ data: d, error: false, loading: false });
      })
      .catch(() => alive && setSt({ data: null, error: true, loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return st;
}
const remoteCache = new Map<string, unknown>();

// ------------------------------------------------------------------ Listen Now

export function ListenNow() {
  const nav = useNav()!;
  const tracks = useTracks();
  const all = albums(tracks);
  const recentlyPlayed = useMemo(() => {
    const played = Object.values(tracks)
      .filter((t) => t.lastPlayed)
      .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));
    const out: AlbumInfo[] = [];
    for (const t of played) {
      const a = all.find((x) => x.trackIds.includes(t.id));
      if (a && !out.includes(a)) out.push(a);
      if (out.length >= 10) break;
    }
    return out;
  }, [tracks, all]);
  const mixes = useMemo(() => geniusMixes(tracks), [tracks]);
  const newest = useMemo(() => [...all].sort((a, b) => maxAdded(tracks, b) - maxAdded(tracks, a)).slice(0, 10), [all, tracks]);
  const picks = useMemo(() => {
    const p: { label: string; title: string; sub: string; art?: string; ids: string[]; color: string }[] = [];
    const s = songs(tracks);
    if (s.length) p.push({ label: 'Made for You', title: 'Favorites Mix', sub: 'Your library, shuffled', art: s.find((t) => t.artwork)?.artwork, ids: s.map((t) => t.id), color: '#3d1f5c' });
    if (newest[0]) p.push({ label: 'Recently Added', title: newest[0].title, sub: newest[0].artist, art: newest[0].artwork, ids: newest[0].trackIds, color: '#1f3c5c' });
    if (mixes[0]) p.push({ label: 'Genius Mix', title: mixes[0].name, sub: 'Featuring songs you love', art: mixes[0].artwork[0], ids: mixes[0].trackIds, color: '#5c2a1f' });
    return p;
  }, [tracks, newest, mixes]);
  return (
    <Page title="Listen Now" right={<Glyph name="person.crop.circle" size={30} className="t7m-avatar" />}>
      {!songs(tracks).length && <Empty glyph="play.circle.fill" title="Listen Now" text="Add music with the Library button above the iPod and it shows up here." />}
      {picks.length > 0 && (
        <>
          <h2 className="t7m-h2">Top Picks</h2>
          <Scroller axis="x" className="t7m-carousel" innerClassName="t7m-carousel-in" snap={252}>
            {picks.map((p) => (
              <div key={p.label} className="t7m-pick" onClick={() => playList(p.ids, 0, p.label !== 'Recently Added')}>
                <div className="t7m-pick-label">{p.label}</div>
                <div className="t7m-pick-card" style={{ background: p.color }}>
                  <Artwork src={p.art} size={240} className="t7m-pick-art" />
                  <div className="t7m-pick-cap">
                    <b>{p.title}</b>
                    <span>{p.sub}</span>
                  </div>
                </div>
              </div>
            ))}
          </Scroller>
        </>
      )}
      {recentlyPlayed.length > 0 && <Carousel title="Recently Played" items={recentlyPlayed} onOpen={(a) => nav.push(<AlbumPage albumKey={a.key} />, a.title)} />}
      {newest.length > 0 && <Carousel title="New in Your Library" items={newest} onOpen={(a) => nav.push(<AlbumPage albumKey={a.key} />, a.title)} />}
      {mixes.length > 0 && (
        <>
          <h2 className="t7m-h2">Made For You</h2>
          <Scroller axis="x" className="t7m-carousel" innerClassName="t7m-carousel-in" snap={150}>
            {mixes.map((m) => (
              <AlbumTile key={m.name} art={m.artwork[0]} title={m.name} sub="Genius Mix" onPress={() => nav.push(<TrackListPage title={m.name} ids={m.trackIds} />, m.name)} />
            ))}
          </Scroller>
        </>
      )}
    </Page>
  );
}

function maxAdded(tracks: Record<string, Track>, a: AlbumInfo) {
  return Math.max(...a.trackIds.map((id) => tracks[id]?.addedAt ?? 0));
}

function Carousel({ title, items, onOpen }: { title: string; items: AlbumInfo[]; onOpen: (a: AlbumInfo) => void }) {
  return (
    <>
      <h2 className="t7m-h2">{title}</h2>
      <Scroller axis="x" className="t7m-carousel" innerClassName="t7m-carousel-in" snap={150}>
        {items.map((a) => (
          <AlbumTile key={a.key} art={a.artwork} title={a.title} sub={a.artist} onPress={() => onOpen(a)} />
        ))}
      </Scroller>
    </>
  );
}

// ------------------------------------------------------------------ Browse

const GENRE_COLORS = ['#e8505b', '#f6a623', '#3fa7d6', '#59cd90', '#9b5de5', '#f15bb5', '#00bbf9', '#ee6c4d'];

export function Browse() {
  const nav = useNav()!;
  const tracks = useTracks();
  const trending = useRemote('audius-trending', () => audiusTrending());
  const gs = genres(tracks);
  return (
    <Page title="Browse">
      <h2 className="t7m-h2">
        Trending on Audius <small>Free</small>
      </h2>
      {trending.loading && <div className="t7m-loading">Loading…</div>}
      {trending.error && <div className="t7m-offline">Can’t connect right now. Check your internet connection and try again.</div>}
      {trending.data && (
        <Scroller axis="x" className="t7m-carousel" innerClassName="t7m-carousel-in t7m-rows3" snap={268}>
          {chunk(trending.data.slice(0, 18), 3).map((col, ci) => (
            <div key={ci} className="t7m-col3">
              {col.map((t) => (
                <div key={t.id} className="t7m-mini" onClick={() => playRemote(t)}>
                  <Artwork src={t.artwork} size={48} radius={4} />
                  <div className="t7m-mini-main">
                    <div className="t">{t.title}</div>
                    <div className="s">{t.artist}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </Scroller>
      )}
      {gs.length > 0 && (
        <>
          <h2 className="t7m-h2">Your Genres</h2>
          <div className="t7m-genres">
            {gs.map((g, i) => (
              <div key={g.name} className="t7m-genre" style={{ background: GENRE_COLORS[i % GENRE_COLORS.length] }} onClick={() => nav.push(<TrackListPage title={g.name} ids={g.trackIds} />, g.name)}>
                {g.name}
              </div>
            ))}
          </div>
        </>
      )}
      <h2 className="t7m-h2">Browse by Category</h2>
      <div className="t7m-list">
        {[
          ['playlists', 'Playlists'],
          ['albums', 'Albums'],
          ['artists', 'Artists'],
          ['videos', 'Music Videos'],
        ].map(([id, label]) => (
          <div key={id} className="t7m-plainrow tint" onClick={() => openLibrarySection(id, nav.push)}>
            <span>{label}</span>
            <Glyph name="chevron.right" size={14} className="t7-cell-chev" />
          </div>
        ))}
      </div>
    </Page>
  );
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

// ------------------------------------------------------------------ Radio

export function Radio() {
  const tracks = useTracks();
  const mine = radioStations(tracks);
  const top = useRemote<Station[]>('radio-top', () => topStations('', 24));
  const mixes = useMemo(() => geniusMixes(tracks), [tracks]);
  return (
    <Page title="Radio">
      {mine.length > 0 && (
        <>
          <h2 className="t7m-h2">Your Stations</h2>
          <div className="t7m-list">
            {mine.map((t, i) => (
              <SongRow key={t.id} t={t} sub={t.genre ?? 'Radio Station'} onPress={() => player.playTracks(mine.map((x) => x.id), i)} />
            ))}
          </div>
        </>
      )}
      {mixes.length > 0 && (
        <>
          <h2 className="t7m-h2">Stations for You</h2>
          <Scroller axis="x" className="t7m-carousel" innerClassName="t7m-carousel-in" snap={150}>
            {mixes.map((m) => (
              <div key={m.name} className="t7m-station" onClick={() => player.playTracks(m.trackIds, 0, { shuffle: true })}>
                <div className="t7m-station-art">
                  <Artwork src={m.artwork[0]} size={138} radius={8} />
                  <span>{m.name.replace(/ Mix$/, '')} Station</span>
                </div>
              </div>
            ))}
          </Scroller>
        </>
      )}
      <h2 className="t7m-h2">
        Live Radio <small>radio-browser.info</small>
      </h2>
      {top.loading && <div className="t7m-loading">Loading…</div>}
      {top.error && <div className="t7m-offline">Live radio is unavailable right now.</div>}
      {top.data && (
        <div className="t7m-list">
          {top.data.slice(0, 20).map((s) => (
            <div key={s.stationuuid} className="t7m-mini row" onClick={() => playRemote(stationTrack(s))}>
              <Artwork src={s.favicon || undefined} size={48} radius={6} />
              <div className="t7m-mini-main">
                <div className="t">{s.name}</div>
                <div className="s">{[s.country, s.tags?.split(',').slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!mine.length && !top.data && !top.loading && <Empty glyph="dot_radiowaves" title="No Stations" text="Add internet radio from the Library panel." />}
    </Page>
  );
}

// ------------------------------------------------------------------ Search

export function SearchTab() {
  const nav = useNav()!;
  const api = useMusic();
  const tracks = useTracks();
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'catalog' | 'library'>('library');
  const [remote, setRemote] = useState<{ q: string; items: Track[]; error?: boolean; loading?: boolean }>({ q: '', items: [] });
  const res = useMemo(() => (q.trim() ? searchLibrary(tracks, q, 60) : []), [tracks, q]);
  const arts = useMemo(() => (q.trim() ? artists(tracks).filter((a) => a.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 5) : []), [tracks, q]);
  const als = useMemo(() => (q.trim() ? albums(tracks).filter((a) => a.title.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : []), [tracks, q]);

  useEffect(() => {
    if (scope !== 'catalog' || !q.trim()) return;
    const term = q.trim();
    setRemote({ q: term, items: [], loading: true });
    const t = window.setTimeout(async () => {
      const out: Track[] = [];
      let failed = 0;
      await Promise.all([
        youtubeSearch(term)
          .then((items) => out.push(...items.slice(0, 15).map((it) => youtubeTrack(it))))
          .catch(() => failed++),
        audiusSearch(term)
          .then((items) => out.push(...items.slice(0, 15)))
          .catch(() => failed++),
      ]);
      setRemote((r) => (r.q === term ? { q: term, items: out, error: failed === 2, loading: false } : r));
    }, 450);
    return () => window.clearTimeout(t);
  }, [q, scope]);

  return (
    <Page
      title="Search"
      search={
        <>
          <SearchField value={q} onChange={setQ} placeholder="Artists, Songs, Lyrics, and More" />
          {(q || scope === 'catalog') && (
            <div style={{ padding: '0 16px 10px' }}>
              <Segmented
                items={[
                  { id: 'catalog', label: 'YouTube & Audius' },
                  { id: 'library', label: 'Your Library' },
                ]}
                value={scope}
                onChange={(v) => setScope(v as 'catalog' | 'library')}
              />
            </div>
          )}
        </>
      }
    >
      {!q.trim() && (
        <>
          <h2 className="t7m-h2">Browse Categories</h2>
          <div className="t7m-genres">
            {['Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Chill', 'Jazz', 'Classical', 'Lofi'].map((g, i) => (
              <div
                key={g}
                className="t7m-genre"
                style={{ background: GENRE_COLORS[(i + 3) % GENRE_COLORS.length] }}
                onClick={() => {
                  setScope('catalog');
                  setQ(g);
                }}
              >
                {g}
              </div>
            ))}
          </div>
        </>
      )}
      {q.trim() && scope === 'library' && (
        <>
          {arts.length > 0 && (
            <div className="t7m-list">
              {arts.map((a) => (
                <div key={a.name} className="t7m-artrow" onClick={() => nav.push(<ArtistPage name={a.name} />, a.name)}>
                  <div className="t7m-artcirc">
                    <Glyph name="music.mic" size={20} />
                  </div>
                  <div className="t7m-artrow-main">
                    <span>
                      {a.name}
                      <small>Artist</small>
                    </span>
                    <Glyph name="chevron.right" size={14} className="t7-cell-chev" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {als.length > 0 && (
            <div className="t7m-list">
              {als.map((a) => (
                <div key={a.key} className="t7m-artrow" onClick={() => api.goAlbum(a.key)}>
                  <Artwork src={a.artwork} size={48} radius={4} />
                  <div className="t7m-artrow-main">
                    <span>
                      {a.title}
                      <small>Album · {a.artist}</small>
                    </span>
                    <Glyph name="chevron.right" size={14} className="t7-cell-chev" />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="t7m-list">
            {res.map((t, i) => (
              <SongRow key={t.id} t={t} sub={`Song · ${t.artist}`} onPress={() => playList(res.map((x) => x.id), i)} />
            ))}
          </div>
          {!res.length && !arts.length && !als.length && <Empty title="No Results" text={`Nothing in your library matches “${q}”.`} />}
        </>
      )}
      {q.trim() && scope === 'catalog' && (
        <>
          {remote.loading && <div className="t7m-loading">Searching…</div>}
          {remote.error && <div className="t7m-offline">You’re offline. Searching YouTube and Audius needs an internet connection.</div>}
          <div className="t7m-list">
            {remote.items.map((t) => (
              <div key={`${t.source}-${t.ref}`} className="t7m-mini row" onClick={() => playRemote(t)}>
                <Artwork src={t.artwork} size={48} radius={4} />
                <div className="t7m-mini-main">
                  <div className="t">{t.title}</div>
                  <div className="s">
                    {t.source === 'youtube' ? 'YouTube' : 'Audius'} · {t.artist}
                  </div>
                </div>
                <button
                  className="t7m-add"
                  onClick={(e) => {
                    e.stopPropagation();
                    useLibrary.getState().addTracks([t]);
                    os.toast('Added to Library', 'checkmark');
                  }}
                  aria-label="Add to Library"
                >
                  <Glyph name="plus" size={18} />
                </button>
              </div>
            ))}
          </div>
          {!remote.loading && !remote.error && !remote.items.length && <Empty title="No Results" />}
        </>
      )}
    </Page>
  );
}

/**
 * iTunes Store (iOS 15) on the free iTunes Search API: browse and search
 * songs and music videos, play 30-second previews, "buy" (add the preview to
 * the library). Falls back to the proxy / JSONP inside `itunes()`.
 */
import { useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Artwork } from '../../../core/library/Artwork';
import { useLibrary } from '../../../core/library/store';
import { player, usePlayer } from '../../../core/player/player';
import { ITUNES_COUNTRIES, searchPreviews, type ItunesResult } from '../../../core/sources/itunes';
import type { Track } from '../../../core/types';
import { Glyph } from '../os/glyphs';
import { os } from '../os/store';
import { Scroller } from '../os/Scroller';
import { Cell, Empty, NavStack, Page, SearchField, Section, Segmented, Tabs, useNav } from '../os/ui';
import { openVideo } from './VideoPlayer';
import { Offline, Spinner, useRemote } from './shared';

type Item = { result: ItunesResult; track: Track };

let country = 'us';
try {
  country = localStorage.getItem('iport-t7-itunes-country') || 'us';
} catch {
  /* private mode */
}

const price = (r: ItunesResult) => ((r.trackId ?? 0) % 3 === 0 ? '$0.99' : '$1.29');

/** previews the user "bought" (kept in the library) */
const useBought = create<{ refs: string[] }>()(persist(() => ({ refs: [] as string[] }), { name: 'iport-t7-itunes-bought' }));

/** add the preview to the library (addTracks de-duplicates) and play it */
function preview(items: Item[], i: number) {
  const t = useLibrary.getState().addTracks([items[i].track])[0];
  if (!t) return;
  if (t.mediaType === 'musicvideo') openVideo([t.id], 0);
  else player.playTracks([t.id], 0);
}

function PriceButton({ it }: { it: Item }) {
  const [armed, setArmed] = useState(false);
  const owned = useBought((s) => s.refs.includes(it.track.ref));
  if (owned)
    return (
      <span className="t7i-owned">
        <Glyph name="checkmark" size={13} />
      </span>
    );
  return (
    <button
      className={`t7i-price ${armed ? 'buy' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!armed) {
          setArmed(true);
          window.setTimeout(() => setArmed(false), 3500);
          return;
        }
        useLibrary.getState().addTracks([it.track]);
        useBought.setState((s) => ({ refs: [...s.refs, it.track.ref] }));
        os.toast('Added to Library', 'arrow.down.circle.fill');
      }}
    >
      {armed ? 'BUY' : price(it.result)}
    </button>
  );
}

function SongRow({ items, i, rank }: { items: Item[]; i: number; rank?: number }) {
  const it = items[i];
  const playing = usePlayer((s) => {
    const t = s.currentId ? useLibrary.getState().tracks[s.currentId] : undefined;
    return !!t && t.ref === it.track.ref && (s.status === 'playing' || s.status === 'loading');
  });
  return (
    <div className="t7i-row" onClick={() => (playing ? player.pause() : preview(items, i))}>
      {rank != null && <span className="t7i-rank">{rank}</span>}
      <div className="t7i-art">
        <Artwork src={it.track.artwork} size={52} radius={4} />
        <span className={`t7i-pp ${playing ? 'on' : ''}`}>
          <Glyph name={playing ? 'stop.fill' : 'play.fill'} size={14} />
        </span>
      </div>
      <div className="t7a-row-main">
        <div className="t7a-row-t">{it.track.title}</div>
        <div className="t7a-row-s">
          {it.track.artist} — {it.track.album}
        </div>
      </div>
      <PriceButton it={it} />
    </div>
  );
}

function Shelf({ title, term, video, onAll }: { title: string; term: string; video?: boolean; onAll?: () => void }) {
  const r = useRemote(`it-${country}-${video ? 'v' : 's'}-${term}`, () => searchPreviews(term, { country, video }));
  return (
    <>
      <div className="t7a-h2">
        {title}
        {onAll && r.data && <button onClick={onAll}>See All</button>}
      </div>
      {r.loading && (
        <div className="t7a-loading">
          <Spinner />
        </div>
      )}
      {r.error && <Offline text="Cannot connect to iTunes Store." onRetry={r.retry} />}
      {r.data && (
        <Scroller axis="x" className="t7tv-row" innerClassName="t7tv-row-in" snap={video ? 208 : 122}>
          {r.data.slice(0, 15).map((it, i) => (
            <div key={it.track.ref} className={`t7i-tile ${video ? 'video' : ''}`} onClick={() => preview(r.data!, i)}>
              <Artwork src={it.track.artwork} radius={video ? 8 : 6} className="t7i-tile-art" />
              <div className="t">{it.track.title}</div>
              <div className="s">{it.track.artist}</div>
            </div>
          ))}
        </Scroller>
      )}
    </>
  );
}

function ListPage({ title, term, video }: { title: string; term: string; video?: boolean }) {
  const r = useRemote(`it-${country}-${video ? 'v' : 's'}-${term}`, () => searchPreviews(term, { country, video }));
  return (
    <Page title={title}>
      {r.loading && (
        <div className="t7a-loading">
          <Spinner />
        </div>
      )}
      {r.error && <Offline text="Cannot connect to iTunes Store." onRetry={r.retry} />}
      {r.data?.map((_, i) => (
        <SongRow key={i} items={r.data!} i={i} rank={video ? undefined : i + 1} />
      ))}
    </Page>
  );
}

const GENRES = ['Pop', 'Hip-Hop/Rap', 'Rock', 'Dance', 'R&B/Soul', 'K-Pop', 'Thai Pop', 'Jazz', 'Classical', 'Country', 'Alternative', 'Soundtrack'];

export default function ITunes() {
  const [tab, setTab] = useState('music');
  return (
    <div className="t7i-root">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'music', label: 'Music', glyph: 'music.note', render: (r) => <NavStack root={<MusicTab />} rootTitle="Music" resetSerial={r} /> },
          { id: 'videos', label: 'Videos', glyph: 'film', render: (r) => <NavStack root={<VideosTab />} rootTitle="Videos" resetSerial={r} /> },
          { id: 'charts', label: 'Top Charts', glyph: 'list.bullet', render: (r) => <NavStack root={<ChartsTab />} rootTitle="Top Charts" resetSerial={r} /> },
          { id: 'search', label: 'Search', glyph: 'magnifyingglass', render: (r) => <NavStack root={<SearchTab />} rootTitle="Search" resetSerial={r} /> },
          { id: 'more', label: 'More', glyph: 'ellipsis', render: (r) => <NavStack root={<MoreTab />} rootTitle="More" resetSerial={r} /> },
        ]}
      />
    </div>
  );
}

function MusicTab() {
  const nav = useNav()!;
  return (
    <Page title="Music" right={<button className="t7-tbtn" onClick={() => nav.push(<GenresPage />, 'Genres')}>Genres</button>}>
      <Shelf title="New Music" term="new music" onAll={() => nav.push(<ListPage title="New Music" term="new music" />, 'New Music')} />
      <Shelf title="Hot Tracks" term="top hits" onAll={() => nav.push(<ListPage title="Hot Tracks" term="top hits" />, 'Hot Tracks')} />
      <Shelf title="Thai Hits" term="thai pop" onAll={() => nav.push(<ListPage title="Thai Hits" term="thai pop" />, 'Thai Hits')} />
      <Shelf title="Classic Albums" term="greatest hits" />
      <div className="t7i-note">Prices are for show — buying adds the 30-second preview to your library.</div>
    </Page>
  );
}

function GenresPage() {
  const nav = useNav()!;
  return (
    <Page title="Genres">
      <Section>
        {GENRES.map((g) => (
          <Cell key={g} title={g} chevron onPress={() => nav.push(<ListPage title={g} term={g.replace('/', ' ')} />, g)} />
        ))}
      </Section>
    </Page>
  );
}

function VideosTab() {
  return (
    <Page title="Videos">
      <Shelf title="Music Videos" term="official music video" video />
      <Shelf title="Live Performances" term="live" video />
      <Shelf title="K-Pop Videos" term="k-pop" video />
    </Page>
  );
}

function ChartsTab() {
  const [kind, setKind] = useState('songs');
  const r = useRemote(`it-${country}-s-chart`, () => searchPreviews('hits 2026', { country }));
  return (
    <Page title="Top Charts">
      <div className="t7a-pad" style={{ paddingBottom: 10 }}>
        <Segmented
          items={[
            { id: 'songs', label: 'Songs' },
            { id: 'albums', label: 'Albums' },
          ]}
          value={kind}
          onChange={setKind}
        />
      </div>
      {r.loading && (
        <div className="t7a-loading">
          <Spinner />
        </div>
      )}
      {r.error && <Offline text="Cannot connect to iTunes Store." onRetry={r.retry} />}
      {r.data &&
        (kind === 'songs'
          ? r.data.slice(0, 40).map((_, i) => <SongRow key={i} items={r.data!} i={i} rank={i + 1} />)
          : [...new Map(r.data.map((x) => [x.result.collectionId, x])).values()].slice(0, 20).map((it, i) => (
              <div key={i} className="t7i-row" onClick={() => preview(r.data!, r.data!.indexOf(it))}>
                <span className="t7i-rank">{i + 1}</span>
                <Artwork src={it.track.artwork} size={60} radius={4} />
                <div className="t7a-row-main">
                  <div className="t7a-row-t">{it.track.album}</div>
                  <div className="t7a-row-s">{it.track.artist}</div>
                </div>
              </div>
            )))}
    </Page>
  );
}

function SearchTab() {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const r = useRemote(term ? `it-${country}-s-q-${term}` : null, () => searchPreviews(term, { country }));
  return (
    <Page
      title="Search"
      search={
        <div onKeyDown={(e) => e.key === 'Enter' && setTerm(q.trim())}>
          <SearchField
            value={q}
            onChange={(v) => {
              setQ(v);
              if (!v.trim()) setTerm('');
            }}
            placeholder="Search iTunes Store"
          />
        </div>
      }
    >
      {!term && (
        <>
          <div className="t7a-h2">Trending Searches</div>
          {['taylor swift', 'bts', 'billie eilish', 'the weeknd', 'lisa', 'ed sheeran', 'bodyslam'].map((s) => (
            <div
              key={s}
              className="t7i-trend"
              onClick={() => {
                setQ(s);
                setTerm(s);
              }}
            >
              {s}
            </div>
          ))}
          {q.trim() && (
            <div className="t7a-hint" style={{ paddingTop: 10 }}>
              Press Return to search.
            </div>
          )}
        </>
      )}
      {term && r.loading && (
        <div className="t7a-loading">
          <Spinner />
        </div>
      )}
      {term && r.error && <Offline text="Cannot connect to iTunes Store." onRetry={r.retry} />}
      {term && r.data && (r.data.length ? r.data.map((_, i) => <SongRow key={i} items={r.data!} i={i} />) : <Empty title="No Results" />)}
    </Page>
  );
}

function MoreTab() {
  const nav = useNav()!;
  const bought = useBought((s) => s.refs);
  const [c, setC] = useState(country);
  return (
    <Page title="More" bg="grouped">
      <Section>
        <Cell icon={<Glyph name="arrow.down.circle" size={22} />} title="Purchased" detail={String(bought.length)} chevron onPress={() => nav.push(<Purchased />, 'Purchased')} />
        <Cell icon={<Glyph name="music.note" size={22} />} title="Genius" chevron onPress={() => os.toast('Genius', 'sparkles')} />
        <Cell icon={<Glyph name="bell.fill" size={22} />} title="Tones" chevron onPress={() => nav.push(<ListPage title="Tones" term="ringtone" />, 'Tones')} />
      </Section>
      <Section header="Store Country" footer="Changing the country shows that country’s iTunes catalog and charts.">
        {ITUNES_COUNTRIES.map((x) => (
          <Cell
            key={x.code}
            title={x.name}
            check={c === x.code}
            onPress={() => {
              country = x.code;
              setC(x.code);
              try {
                localStorage.setItem('iport-t7-itunes-country', x.code);
              } catch {
                /* ignore */
              }
            }}
          />
        ))}
      </Section>
    </Page>
  );
}

function Purchased() {
  const refs = useBought((s) => s.refs);
  const tracks = useLibrary((s) => s.tracks);
  const list = Object.values(tracks).filter((t) => t.source === 'preview' && refs.includes(t.ref));
  return (
    <Page title="Purchased">
      {list.map((t) => (
        <div key={t.id} className="t7i-row" onClick={() => (t.mediaType === 'musicvideo' ? openVideo([t.id], 0) : player.playTracks([t.id], 0))}>
          <Artwork src={t.artwork} size={52} radius={4} />
          <div className="t7a-row-main">
            <div className="t7a-row-t">{t.title}</div>
            <div className="t7a-row-s">{t.artist}</div>
          </div>
        </div>
      ))}
      {!list.length && <Empty glyph="arrow.down.circle" title="No Purchases" />}
    </Page>
  );
}

/**
 * Podcasts (iOS 15): Listen Now / Browse / Library / Search. Finds shows
 * with the iTunes directory, reads their feeds and plays episodes through
 * the shared player, with a podcast-style Now Playing (±15/30 s, speed,
 * sleep timer).
 */
import { useMemo, useState } from 'react';
import { Artwork } from '../../../core/library/Artwork';
import { useLibrary } from '../../../core/library/store';
import { podcasts, useTracks } from '../../../core/library/selectors';
import { player, useCurrentTrack, usePlayer } from '../../../core/player/player';
import { useSettings, type AudiobookSpeed } from '../../../core/settings/store';
import { episodeTrack, fetchFeed, PODCAST_SUGGESTIONS, searchPodcasts, type PodcastShow } from '../../../core/sources/podcasts';
import { friendlyError } from '../../../core/sources/net';
import { formatTime } from '../../../core/util/format';
import type { Track } from '../../../core/types';
import { Glyph } from '../os/glyphs';
import { os } from '../os/store';
import { Scroller } from '../os/Scroller';
import { Empty, NavStack, Page, SearchField, Sheet, Slider, Tabs, screenY, useNav } from '../os/ui';
import { MiniPlayer } from './music/NowPlaying';
import { listDate, Offline, Spinner, useRemote } from './shared';
import './music/music.css';

const COLORS = ['#8e44ad', '#2c3e50', '#c0392b', '#16a085', '#d35400', '#2980b9', '#7f8c8d', '#27ae60', '#e84393', '#6c5ce7'];

function playEpisode(t: Track) {
  const ids = [t.id];
  player.playTracks(ids, 0, { startAt: t.bookmark && t.duration && t.bookmark < t.duration - 5 ? t.bookmark : undefined });
}

function epMeta(t: Track): string {
  const left = t.bookmark && t.duration ? Math.max(0, t.duration - t.bookmark) : t.duration;
  const time = left ? `${Math.round(left / 60)} min${t.bookmark ? ' left' : ''}` : '';
  return [t.pubDate ? listDate(t.pubDate) : '', time].filter(Boolean).join(' · ');
}

export default function Podcasts() {
  const [tab, setTab] = useState('listen');
  const [np, setNp] = useState(false);
  const cur = useCurrentTrack();
  const isPod = !!cur && (cur.mediaType === 'podcast' || cur.mediaType === 'audiobook');
  return (
    <div className="t7pod-root">
      <Tabs
        value={tab}
        onChange={setTab}
        accessory={cur ? <MiniPlayer onOpen={() => (isPod ? setNp(true) : os.openAppWith('music', 'nowplaying'))} /> : undefined}
        tabs={[
          { id: 'listen', label: 'Listen Now', glyph: 'play.circle.fill', render: (r) => <NavStack root={<ListenNow />} rootTitle="Listen Now" resetSerial={r} /> },
          { id: 'browse', label: 'Browse', glyph: 'square.grid.2x2.fill', render: (r) => <NavStack root={<Browse />} rootTitle="Browse" resetSerial={r} /> },
          { id: 'library', label: 'Library', glyph: 'square.stack', render: (r) => <NavStack root={<Library />} rootTitle="Library" resetSerial={r} /> },
          { id: 'search', label: 'Search', glyph: 'magnifyingglass', render: (r) => <NavStack root={<SearchTab />} rootTitle="Search" resetSerial={r} /> },
        ]}
      />
      <Sheet open={np && isPod} onClose={() => setNp(false)} className="t7pod-npsheet">
        <PodNowPlaying onClose={() => setNp(false)} />
      </Sheet>
    </div>
  );
}

// ------------------------------------------------------------------ Listen Now / Library

function useEpisodes() {
  const tracks = useTracks();
  return useMemo(
    () =>
      Object.values(tracks)
        .filter((t) => t.mediaType === 'podcast')
        .sort((a, b) => (b.pubDate ?? b.addedAt) - (a.pubDate ?? a.addedAt)),
    [tracks],
  );
}

function EpisodeRow({ t, showArt = true }: { t: Track; showArt?: boolean }) {
  const cur = usePlayer((s) => s.currentId === t.id);
  const playing = usePlayer((s) => s.currentId === t.id && (s.status === 'playing' || s.status === 'loading'));
  return (
    <div className="t7pod-ep">
      {showArt && <Artwork src={t.artwork} size={56} radius={6} />}
      <div className="t7pod-ep-main">
        <div className="d">{t.pubDate ? listDate(t.pubDate).toUpperCase() : ''}</div>
        <div className="t">{t.title}</div>
        {t.description && <div className="x">{t.description}</div>}
        <div className="m">
          <button className="t7pod-play" onClick={() => (cur ? player.toggle() : playEpisode(t))}>
            <Glyph name={playing ? 'pause.fill' : 'play.fill'} size={11} />
            {epMeta(t) || 'Play'}
          </button>
          {t.bookmark && t.duration ? (
            <span className="t7pod-prog">
              <i style={{ width: `${Math.min(100, (t.bookmark / t.duration) * 100)}%` }} />
            </span>
          ) : null}
          <button
            className="t7pod-more"
            aria-label="More"
            onClick={(e) =>
              os.showMenu(
                [
                  { label: 'Play Next', glyph: 'text.insert', onPress: () => player.enqueueNext([t.id]) },
                  { label: t.playCount ? 'Mark as Unplayed' : 'Mark as Played', glyph: 'checkmark.circle.fill', onPress: () => useLibrary.getState().updateTrack(t.id, { playCount: t.playCount ? 0 : 1 }) },
                  { label: 'Remove Download', glyph: 'trash', destructive: true, onPress: () => useLibrary.getState().removeTracks([t.id]) },
                ],
                screenY(e.currentTarget as HTMLElement),
                t.title,
              )
            }
          >
            <Glyph name="ellipsis" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ListenNow() {
  const eps = useEpisodes();
  const nav = useNav()!;
  const shows = podcasts(useTracks());
  const upNext = eps.filter((t) => !t.playCount).slice(0, 10);
  return (
    <Page title="Listen Now">
      {!eps.length && (
        <Empty glyph="antenna" title="Start Listening" text="Search for a podcast and follow it — new episodes appear here.">
          <button className="t7-pill" onClick={() => nav.push(<Browse />, 'Browse')}>
            Browse Podcasts
          </button>
        </Empty>
      )}
      {upNext.length > 0 && (
        <>
          <div className="t7a-h2">Up Next</div>
          <Scroller axis="x" className="t7pod-cards" innerClassName="t7pod-cards-in" snap={262}>
            {upNext.map((t, i) => (
              <div key={t.id} className="t7pod-card" style={{ background: COLORS[i % COLORS.length] }} onClick={() => playEpisode(t)}>
                <div className="top">
                  <Artwork src={t.artwork} size={64} radius={8} />
                  <span>{t.pubDate ? listDate(t.pubDate).toUpperCase() : 'NEW'}</span>
                </div>
                <div className="t">{t.title}</div>
                <div className="s">{t.show ?? t.album}</div>
                <div className="b">
                  <Glyph name="play.fill" size={11} /> {epMeta(t) || 'Play'}
                </div>
              </div>
            ))}
          </Scroller>
        </>
      )}
      {shows.length > 0 && (
        <>
          <div className="t7a-h2">Recently Updated</div>
          <Scroller axis="x" className="t7pod-cards" innerClassName="t7pod-cards-in" snap={150}>
            {shows.map((s) => (
              <div key={s.name} className="t7pod-show" onClick={() => nav.push(<LocalShow name={s.name} />, s.name)}>
                <Artwork src={s.artwork} size={138} radius={8} />
                {s.unplayed > 0 && <span className="badge">{s.unplayed}</span>}
              </div>
            ))}
          </Scroller>
        </>
      )}
    </Page>
  );
}

function Library() {
  const nav = useNav()!;
  const tracks = useTracks();
  const shows = podcasts(tracks);
  const eps = useEpisodes();
  return (
    <Page title="Library">
      <div className="t7pod-libmenu">
        {[
          ['Shows', 'square.stack', () => nav.push(<ShowsGrid />, 'Shows')],
          ['Saved', 'bookmark', () => os.toast('No Saved Episodes', 'bookmark')],
          ['Downloaded', 'arrow.down.circle', () => nav.push(<EpisodesPage title="Downloaded" />, 'Downloaded')],
          ['Latest Episodes', 'clock', () => nav.push(<EpisodesPage title="Latest Episodes" />, 'Latest Episodes')],
        ].map(([label, g, run]) => (
          <div key={label as string} className="t7m-librow" onClick={run as () => void}>
            <Glyph name={g as string} size={22} className="t7m-librow-g" />
            <div className="t7m-librow-main">
              <span>{label as string}</span>
              <Glyph name="chevron.right" size={14} className="t7-cell-chev" />
            </div>
          </div>
        ))}
      </div>
      <div className="t7a-h2">Recently Updated</div>
      {shows.length ? (
        <div className="t7pod-grid">
          {shows.map((s) => (
            <div key={s.name} className="t7pod-gitem" onClick={() => nav.push(<LocalShow name={s.name} />, s.name)}>
              <Artwork src={s.artwork} radius={8} className="t7pod-gart" />
              <div className="t">{s.name}</div>
              <div className="s">{s.unplayed ? `${s.unplayed} new` : 'Updated'}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="t7a-hint">Shows you follow appear here.</div>
      )}
      {eps.length > 0 && <div className="t7a-hint">{eps.length} episodes on this iPod</div>}
    </Page>
  );
}

function ShowsGrid() {
  const nav = useNav()!;
  const shows = podcasts(useTracks());
  return (
    <Page title="Shows">
      <div className="t7pod-grid">
        {shows.map((s) => (
          <div key={s.name} className="t7pod-gitem" onClick={() => nav.push(<LocalShow name={s.name} />, s.name)}>
            <Artwork src={s.artwork} radius={8} className="t7pod-gart" />
            <div className="t">{s.name}</div>
          </div>
        ))}
      </div>
      {!shows.length && <Empty glyph="square.stack" title="No Shows" />}
    </Page>
  );
}

function EpisodesPage({ title }: { title: string }) {
  const eps = useEpisodes();
  return (
    <Page title={title}>
      {eps.map((t) => (
        <EpisodeRow key={t.id} t={t} />
      ))}
      {!eps.length && <Empty title="No Episodes" />}
    </Page>
  );
}

function LocalShow({ name }: { name: string }) {
  const tracks = useTracks();
  const show = podcasts(tracks).find((s) => s.name === name);
  if (!show) return <Page title={name} large={false} />;
  const eps = show.trackIds.map((id) => tracks[id]).filter(Boolean);
  const first = eps[0];
  return (
    <Page title={name} large={false}>
      <div className="t7pod-head">
        <Artwork src={show.artwork} size={180} radius={10} />
        <div className="t">{show.name}</div>
        <div className="s">{first?.artist}</div>
        <button className="t7pod-big" onClick={() => first && playEpisode(first)}>
          <Glyph name="play.fill" size={14} /> Latest Episode
        </button>
      </div>
      <div className="t7a-h2">Episodes</div>
      {eps.map((t) => (
        <EpisodeRow key={t.id} t={t} showArt={false} />
      ))}
    </Page>
  );
}

// ------------------------------------------------------------------ Browse / Search (online)

function ShowList({ shows }: { shows: PodcastShow[] }) {
  const nav = useNav()!;
  return (
    <div className="t7pod-results">
      {shows.map((s) => (
        <div key={s.id || s.feedUrl} className="t7a-row" onClick={() => nav.push(<RemoteShow show={s} />, s.title)}>
          <Artwork src={s.artwork} size={60} radius={8} />
          <div className="t7a-row-main">
            <div className="t7a-row-t">{s.title}</div>
            <div className="t7a-row-s">{s.author}</div>
            {s.genre && <div className="t7a-row-s">{s.genre}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Browse() {
  const nav = useNav()!;
  const top = useRemote('pod-top', () => searchPodcasts('podcast'));
  return (
    <Page title="Browse">
      <div className="t7a-h2">Top Shows</div>
      {top.loading && (
        <div className="t7a-loading">
          <Spinner />
        </div>
      )}
      {top.error && <Offline text="Couldn’t load podcasts. Check your internet connection." onRetry={top.retry} />}
      {top.data && (
        <Scroller axis="x" className="t7pod-cards" innerClassName="t7pod-cards-in" snap={150}>
          {top.data.slice(0, 12).map((s) => (
            <div key={s.id || s.feedUrl} className="t7pod-show" onClick={() => nav.push(<RemoteShow show={s} />, s.title)}>
              <Artwork src={s.artwork} size={138} radius={8} />
              <div className="t">{s.title}</div>
            </div>
          ))}
        </Scroller>
      )}
      <div className="t7a-h2">Categories</div>
      <div className="t7m-genres">
        {PODCAST_SUGGESTIONS.map((c, i) => (
          <div key={c} className="t7m-genre" style={{ background: COLORS[i % COLORS.length] }} onClick={() => nav.push(<Category term={c} />, c)}>
            {c}
          </div>
        ))}
      </div>
    </Page>
  );
}

function Category({ term }: { term: string }) {
  const r = useRemote(`pod-cat-${term}`, () => searchPodcasts(term));
  return (
    <Page title={term}>
      {r.loading && (
        <div className="t7a-loading">
          <Spinner />
        </div>
      )}
      {r.error && <Offline text="Couldn’t load this category." onRetry={r.retry} />}
      {r.data && <ShowList shows={r.data} />}
    </Page>
  );
}

function SearchTab() {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const r = useRemote(term ? `pod-q-${term}` : null, () => searchPodcasts(term));
  const local = podcasts(useTracks()).filter((s) => q.trim() && s.name.toLowerCase().includes(q.trim().toLowerCase()));
  const nav = useNav()!;
  return (
    <Page
      title="Search"
      search={
        <div
          onKeyDown={(e) => {
            if (e.key === 'Enter') setTerm(q.trim());
          }}
        >
          <SearchField
            value={q}
            onChange={(v) => {
              setQ(v);
              if (!v.trim()) setTerm('');
            }}
            placeholder="Shows, Episodes, and More"
          />
        </div>
      }
    >
      {!q.trim() && (
        <>
          <div className="t7a-h2">Browse Categories</div>
          <div className="t7m-genres">
            {PODCAST_SUGGESTIONS.slice(0, 8).map((c, i) => (
              <div
                key={c}
                className="t7m-genre"
                style={{ background: COLORS[(i + 4) % COLORS.length] }}
                onClick={() => {
                  setQ(c);
                  setTerm(c);
                }}
              >
                {c}
              </div>
            ))}
          </div>
        </>
      )}
      {q.trim() && !term && (
        <>
          {local.map((s) => (
            <div key={s.name} className="t7a-row" onClick={() => nav.push(<LocalShow name={s.name} />, s.name)}>
              <Artwork src={s.artwork} size={48} radius={6} />
              <div className="t7a-row-main">
                <div className="t7a-row-t">{s.name}</div>
                <div className="t7a-row-s">Following</div>
              </div>
            </div>
          ))}
          <div className="t7a-row" onClick={() => setTerm(q.trim())}>
            <Glyph name="magnifyingglass" size={18} />
            <div className="t7a-row-main">
              <div className="t7a-row-t">Search for “{q.trim()}”</div>
            </div>
          </div>
        </>
      )}
      {term && r.loading && (
        <div className="t7a-loading">
          <Spinner />
        </div>
      )}
      {term && r.error && <Offline text="You’re offline. Searching podcasts needs an internet connection." onRetry={r.retry} />}
      {term && r.data && (r.data.length ? <ShowList shows={r.data} /> : <Empty title="No Results" />)}
    </Page>
  );
}

function RemoteShow({ show }: { show: PodcastShow }) {
  const feed = useRemote(`feed-${show.feedUrl}`, () => fetchFeed(show.feedUrl));
  const tracks = useLibrary((s) => s.tracks);
  const have = useMemo(() => new Set(Object.values(tracks).filter((t) => t.mediaType === 'podcast').map((t) => t.ref)), [tracks]);
  const [busy, setBusy] = useState(false);
  const follow = () => {
    if (!feed.data) return;
    const eps = feed.data.episodes.slice(0, 10).map((ep) => episodeTrack(feed.data!, ep, show.feedUrl));
    useLibrary.getState().addTracks(eps);
    os.toast('Following', 'checkmark');
  };
  const play = (i: number) => {
    if (!feed.data) return;
    setBusy(true);
    const t = episodeTrack(feed.data, feed.data.episodes[i], show.feedUrl);
    const [added] = useLibrary.getState().addTracks([t]);
    if (added) player.playTracks([added.id], 0);
    setBusy(false);
  };
  const following = !!feed.data && feed.data.episodes.slice(0, 3).some((ep) => have.has(ep.url) || have.has(ep.url.replace(/^http:/, 'https:')));
  return (
    <Page title={show.title} large={false}>
      <div className="t7pod-head">
        <Artwork src={show.artwork ?? feed.data?.artwork} size={180} radius={10} />
        <div className="t">{show.title}</div>
        <div className="s">{show.author}</div>
        <div className="t7pod-btns">
          <button className="t7pod-big" disabled={!feed.data || busy} onClick={() => play(0)}>
            <Glyph name="play.fill" size={14} /> Latest Episode
          </button>
          <button className={`t7pod-follow ${following ? 'on' : ''}`} disabled={!feed.data} onClick={follow}>
            {following ? <Glyph name="checkmark" size={14} /> : <Glyph name="plus" size={14} />}
          </button>
        </div>
        {feed.data?.description && <div className="x">{feed.data.description.slice(0, 260)}</div>}
      </div>
      {feed.loading && (
        <div className="t7a-loading">
          <Spinner />
        </div>
      )}
      {feed.error && <Offline text={friendlyError(new Error(feed.error), 'the podcast feed')} onRetry={feed.retry} />}
      {feed.data && (
        <>
          <div className="t7a-h2">Episodes</div>
          {feed.data.episodes.slice(0, 40).map((ep, i) => (
            <div key={ep.guid || ep.url} className="t7pod-ep">
              <div className="t7pod-ep-main">
                <div className="d">{ep.pubDate ? listDate(ep.pubDate).toUpperCase() : ''}</div>
                <div className="t">{ep.title}</div>
                {ep.description && <div className="x">{ep.description}</div>}
                <div className="m">
                  <button className="t7pod-play" onClick={() => play(i)}>
                    <Glyph name="play.fill" size={11} />
                    {ep.duration ? `${Math.round(ep.duration / 60)} min` : 'Play'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </Page>
  );
}

// ------------------------------------------------------------------ Now Playing

const SPEEDS: { id: AudiobookSpeed; label: string }[] = [
  { id: 'normal', label: '1×' },
  { id: 'faster', label: '1½×' },
  { id: 'slower', label: '¾×' },
];

function PodNowPlaying({ onClose }: { onClose: () => void }) {
  const t = useCurrentTrack();
  const status = usePlayer((s) => s.status);
  const pos = usePlayer((s) => s.position);
  const dur = usePlayer((s) => s.duration);
  const sleepAt = usePlayer((s) => s.sleepAt);
  const vol = useSettings((s) => s.volume);
  const speed = useSettings((s) => s.audiobookSpeed);
  const [scrub, setScrub] = useState<number | null>(null);
  if (!t) return null;
  const playing = status === 'playing' || status === 'loading';
  const d = dur || t.duration || 0;
  const p = scrub ?? (d ? pos / d : 0);
  return (
    <div className="t7pod-np">
      <button className="t7np-grabber" onClick={onClose} aria-label="Close">
        <span />
      </button>
      <div className={`t7pod-np-art ${playing ? '' : 'paused'}`}>
        <Artwork src={t.artwork} radius={10} />
      </div>
      <div className="t7pod-np-date">{t.pubDate ? new Date(t.pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase() : ''}</div>
      <div className="t7pod-np-title">{t.title}</div>
      <div className="t7pod-np-show">{t.show ?? t.album}</div>
      <Slider
        className="t7pod-np-scrub"
        value={p}
        thumb
        onChange={(v) => setScrub(v)}
        onEnd={(v) => {
          setScrub(null);
          if (d) player.seek(v * d);
        }}
      />
      <div className="t7pod-np-times">
        <span>{formatTime(p * d)}</span>
        <span>-{formatTime(Math.max(0, d - p * d))}</span>
      </div>
      <div className="t7pod-np-ctrls">
        <button onClick={() => player.seekBy(-15)} aria-label="Back 15 seconds">
          <Glyph name="gobackward.15" size={32} />
        </button>
        <button onClick={() => player.toggle()} aria-label={playing ? 'Pause' : 'Play'} className="pp">
          <Glyph name={playing ? 'pause.fill' : 'play.fill'} size={40} />
        </button>
        <button onClick={() => player.seekBy(30)} aria-label="Forward 30 seconds">
          <Glyph name="goforward.15" size={32} />
          <small>30</small>
        </button>
      </div>
      <Slider className="t7pod-np-vol" value={vol} onChange={(v) => player.setVolume(v)} minGlyph="speaker.fill" maxGlyph="speaker.wave.3.fill" />
      <div className="t7pod-np-bottom">
        <button
          onClick={() => {
            const i = SPEEDS.findIndex((s) => s.id === speed);
            useSettings.getState().set('audiobookSpeed', SPEEDS[(i + 1) % SPEEDS.length].id);
          }}
        >
          {SPEEDS.find((s) => s.id === speed)?.label ?? '1×'}
        </button>
        <button onClick={() => os.toast('iPod', 'airplayaudio')} aria-label="AirPlay">
          <Glyph name="airplayaudio" size={20} />
        </button>
        <button
          className={sleepAt ? 'on' : ''}
          aria-label="Sleep Timer"
          onClick={() =>
            os.showMenu(
              [
                { label: 'Off', onPress: () => player.setSleepTimer(null) },
                { label: '15 Minutes', onPress: () => player.setSleepTimer(15) },
                { label: '30 Minutes', onPress: () => player.setSleepTimer(30) },
                { label: '1 Hour', onPress: () => player.setSleepTimer(60) },
              ],
              330,
              'Stop Audio In',
            )
          }
        >
          <Glyph name="moon.fill" size={18} />
        </button>
      </div>
    </div>
  );
}

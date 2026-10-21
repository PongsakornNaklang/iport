import { useEffect, useState } from 'react';
import { Artwork } from '@/core/library/Artwork';
import { ITUNES_COUNTRIES } from '@/core/sources/itunes';
import { friendlyError, normalizeUrl } from '@/core/sources/net';
import { episodeTrack, fetchFeed, PODCAST_SUGGESTIONS, searchPodcasts, type Feed, type PodcastShow } from '@/core/sources/podcasts';
import { formatTime } from '@/core/util/format';
import { IconLink, IconPlus } from '../../icons';
import type { Intent } from '../AddMusicTab';
import { IconBackArrow, IconPodcast } from '../icons';
import { addToLibrary, isInLibrary, togglePreview, useLibraryKeys, useSticky } from '../state';
import { Chips, Empty, InlineForm, LoadingRows, Notice, ResultRow, SearchField, Spinner, useTask } from '../ui';

function fmtDate(ms?: number): string {
  return ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

export function PodcastSource({ intent }: { intent: Extract<Intent, { kind: 'feed' }> | null }) {
  const [q, setQ] = useSticky('pc.q', '');
  const [country, setCountry] = useSticky('pc.country', 'th', true);
  const [shows, setShows] = useSticky<PodcastShow[] | null>('pc.shows', null);
  const [feed, setFeed] = useSticky<{ feed: Feed; url: string } | null>('pc.feed', null);
  const [feedUrl, setFeedUrl] = useState('');
  const [shown, setShown] = useState(30);
  const task = useTask();
  const feedTask = useTask();
  const keys = useLibraryKeys();

  const search = (v: string) => {
    if (!v) return;
    setQ(v);
    void task.run(async () => setShows(await searchPodcasts(v, country)), (e) => friendlyError(e, 'the podcast directory'));
  };

  const openFeed = (url: string) => {
    setShown(30);
    void feedTask.run(async () => setFeed({ feed: await fetchFeed(url), url }), (e) => friendlyError(e, 'the podcast'));
  };

  useEffect(() => {
    if (intent) openFeed(intent.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.seq]);

  if (feed || feedTask.busy || (feedTask.error && intent)) {
    const f = feed?.feed;
    const tracksOf = (n: number) => (f ? f.episodes.slice(0, n).map((ep) => episodeTrack(f, ep, feed!.url)) : []);
    return (
      <>
        <button className="lib-back" onClick={() => (setFeed(null), feedTask.setError(null))}>
          <IconBackArrow /> Podcasts
        </button>
        <Notice error={feedTask.error} />
        {feedTask.busy || !f ? (
          feedTask.busy && (
            <div style={{ padding: 30, textAlign: 'center' }}>
              <Spinner size={22} />
            </div>
          )
        ) : (
          <>
            <div className="lib-detail">
              <Artwork src={f.artwork} size={88} radius={10} />
              <div className="txt">
                <div className="ttl">{f.title}</div>
                {f.author && <div className="sub">{f.author}</div>}
                {f.description && <div className="desc">{f.description}</div>}
              </div>
            </div>
            <div className="lib-row-flex" style={{ marginBottom: 10 }}>
              <span className="tiny grow">
                {f.episodes.length} episode{f.episodes.length === 1 ? '' : 's'}
              </span>
              {f.episodes.length > 5 && (
                <button className="btn small" onClick={() => addToLibrary(tracksOf(5), { label: 'the latest 5 episodes' })}>
                  Add latest 5
                </button>
              )}
              <button className="btn small primary" disabled={!f.episodes.length} onClick={() => addToLibrary(tracksOf(Math.min(f.episodes.length, 200)), { label: `${Math.min(f.episodes.length, 200)} episodes` })}>
                <IconPlus /> Add {f.episodes.length > 200 ? 'latest 200' : 'all'}
              </button>
            </div>
            {f.episodes.length === 0 ? (
              <Empty title="No playable episodes">This feed has no audio or video files.</Empty>
            ) : (
              <div className="list">
                {f.episodes.slice(0, shown).map((ep) => {
                  const t = episodeTrack(f, ep, feed!.url);
                  return (
                    <ResultRow
                      key={ep.guid + ep.url}
                      art={ep.artwork ?? f.artwork}
                      title={ep.title}
                      sub={[fmtDate(ep.pubDate), ep.duration ? formatTime(ep.duration) : '', ep.video ? 'Video' : ''].filter(Boolean).join(' · ')}
                      meta={ep.description ? <span>{ep.description.slice(0, 220)}</span> : undefined}
                      previewKey={`pc:${ep.url}`}
                      onPreview={() => void togglePreview(`pc:${ep.url}`, t.ref)}
                      added={isInLibrary(keys, t)}
                      onAdd={() => addToLibrary([t])}
                    />
                  );
                })}
              </div>
            )}
            {shown < f.episodes.length && (
              <div className="lib-more">
                <button className="btn small" onClick={() => setShown((n) => n + 50)}>
                  Show more episodes
                </button>
              </div>
            )}
          </>
        )}
      </>
    );
  }

  return (
    <>
      <div className="lib-row-flex">
        <div className="grow">
          <SearchField value={q} onChange={setQ} onSubmit={search} busy={task.busy} placeholder="Search podcasts" />
        </div>
        <select className="select" style={{ width: 'auto', flex: 'none' }} value={country} aria-label="Store country" onChange={(e) => setCountry(e.target.value)}>
          {ITUNES_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
      <Notice error={task.error} />
      {task.busy ? (
        <div style={{ marginTop: 10 }}>
          <LoadingRows n={6} />
        </div>
      ) : shows && shows.length ? (
        <div className="list" style={{ marginTop: 10 }}>
          {shows.map((s) => (
            <ResultRow
              key={s.id || s.feedUrl}
              art={s.artwork}
              title={s.title}
              sub={[s.author, s.genre].filter(Boolean).join(' · ')}
              meta={s.episodeCount ? `${s.episodeCount} episodes` : undefined}
              onClick={() => openFeed(s.feedUrl)}
              chevron
            />
          ))}
        </div>
      ) : shows ? (
        <Empty icon={<IconPodcast />} title="No shows found" />
      ) : (
        <div style={{ marginTop: 12 }}>
          <div className="section-title">Browse</div>
          <Chips wrap value={'' as string} onChange={search} options={PODCAST_SUGGESTIONS.map((s) => ({ value: s, label: s }))} />
        </div>
      )}
      <div className="section-title" style={{ marginTop: 18 }}>
        Have a feed address?
      </div>
      <InlineForm
        value={feedUrl}
        onChange={setFeedUrl}
        onSubmit={(v) => {
          const u = normalizeUrl(v);
          if (u) openFeed(u);
        }}
        icon={<IconLink />}
        button="Open"
        placeholder="https://…/podcast.rss"
      />
      <p className="lib-hint">Episodes appear under Podcasts on every iPod and remember where you stopped. Video podcasts play on iPods with a screen.</p>
    </>
  );
}

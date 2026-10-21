/**
 * Podcasts: shows (with unplayed counts) ▸ episodes (blue dot = unplayed,
 * resume position, publish date) ▸ Now Playing with 15 s back / 30 s skip.
 */
import { useMemo } from 'react';
import { Artwork } from '../../../core/library/Artwork';
import { podcasts } from '../../../core/library/selectors';
import { useLibrary } from '../../../core/library/store';
import { usePlayer } from '../../../core/player/player';
import { formatTime } from '../../../core/util/format';
import type { Track } from '../../../core/types';
import { Glyph } from '../os/icons';
import { NavStack, useNav } from '../os/Nav';
import { Empty, Page, Row } from '../os/ui';
import { NowPlayingButton, usePlayList } from './common';
import { useAppNav } from './registry';

const TINT = '#a33ad0';

export function PodcastsApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('podcasts');
  return <NavStack root={{ title: 'Podcasts', node: <ShowsList />, right: <NowPlayingButton /> }} tint={TINT} active={active} apiRef={apiRef} />;
}

function ShowsList() {
  const tracks = useLibrary((s) => s.tracks);
  const nav = useNav();
  const shows = podcasts(tracks);
  if (!shows.length)
    return (
      <Empty
        icon={<Glyph.podcast size={52} color="#c7c7cc" />}
        title="No Podcasts"
        text="Subscribe to podcasts in the Library panel (search or paste a feed URL) — new episodes appear here."
      />
    );
  return (
    <Page>
      {shows.map((s) => (
        <Row
          key={s.name}
          art={s.artwork ?? null}
          artSize={44}
          tall
          title={s.name}
          subtitle={`${s.trackIds.length} episode${s.trackIds.length === 1 ? '' : 's'}${s.unplayed ? ` · ${s.unplayed} unplayed` : ''}`}
          right={s.unplayed ? <span className="n7-pod-count">{s.unplayed}</span> : undefined}
          chevron
          onClick={() => nav.push({ title: s.name, node: <ShowPage name={s.name} />, right: <NowPlayingButton /> })}
        />
      ))}
    </Page>
  );
}

function when(t: Track): string {
  const d = t.pubDate ?? t.addedAt;
  const days = Math.floor((Date.now() - d) / 86_400_000);
  if (days < 1) return 'Today';
  if (days < 2) return 'Yesterday';
  if (days < 7) return new Date(d).toLocaleDateString(undefined, { weekday: 'long' });
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: days > 300 ? 'numeric' : undefined });
}

function ShowPage({ name }: { name: string }) {
  const tracks = useLibrary((s) => s.tracks);
  const current = usePlayer((s) => s.currentId);
  const play = usePlayList();
  const show = useMemo(() => podcasts(tracks).find((s) => s.name === name), [tracks, name]);
  if (!show) return <Empty title="No Episodes" />;
  const eps = show.trackIds.map((id) => tracks[id]).filter(Boolean);
  const first = eps[0];
  return (
    <Page>
      <div className="n7-albumhead">
        <Artwork src={show.artwork} size={76} radius={3} />
        <div className="n7-albumhead-text">
          <div className="n7-albumhead-title">{show.name}</div>
          {first?.artist && <div className="n7-albumhead-artist">{first.artist}</div>}
          <div className="n7-albumhead-meta">
            {eps.length} episode{eps.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>
      {eps.map((t, i) => {
        const left = t.bookmark && t.duration ? Math.max(0, t.duration - t.bookmark) : 0;
        return (
          <div key={t.id} className={`n7-row n7-tap n7-podrow ${current === t.id ? 'n7-row-current' : ''}`} onClick={() => play(show.trackIds, i)}>
            <span className="n7-badge" style={{ opacity: !t.playCount && !t.bookmark ? 1 : 0 }} />
            <div className="n7-row-text">
              <div className="n7-pod-date">{when(t)}</div>
              <div className="n7-pod-title">{t.title}</div>
              {t.description && <div className="n7-pod-desc">{t.description.replace(/<[^>]+>/g, ' ')}</div>}
              <div className="n7-pod-meta">
                {current === t.id ? <Glyph.volHigh size={11} color={TINT} /> : null}
                {left > 5 ? `${formatTime(left)} left` : t.duration ? formatTime(t.duration) : 'Stream'}
                {t.bookmark && t.duration ? (
                  <span className="n7-pod-bar">
                    <span style={{ width: `${Math.min(100, (t.bookmark / t.duration) * 100)}%` }} />
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </Page>
  );
}

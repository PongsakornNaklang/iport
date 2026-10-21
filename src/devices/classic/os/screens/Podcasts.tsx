import { useMemo } from 'react';
import { podcasts, useTracks } from '../../../../core/library/selectors';
import { usePlayer } from '../../../../core/player/player';
import { formatTime } from '../../../../core/util/format';
import { useOS } from '../core';
import { ListView, type Row } from '../ListView';
import { playList, songMenu } from './Music';

export function PodcastsScreen() {
  const os = useOS();
  const tracks = useTracks();
  const rows = useMemo<Row[]>(
    () =>
      podcasts(tracks).map((s) => ({
        key: s.name,
        label: s.name,
        dot: s.unplayed > 0,
        chevron: true,
        onSelect: () => os.nav.push({ title: s.name, el: <EpisodesScreen show={s.name} /> }),
      })),
    [tracks, os],
  );
  return <ListView rows={rows} empty="No Podcasts" />;
}

function EpisodesScreen({ show }: { show: string }) {
  const os = useOS();
  const tracks = useTracks();
  const current = usePlayer((s) => s.currentId);
  const rows = useMemo<Row[]>(() => {
    const s = podcasts(tracks).find((x) => x.name === show);
    const ids = s?.trackIds ?? [];
    return ids.map((id, i) => {
      const t = tracks[id];
      const left = t.duration ? Math.max(0, t.duration - (t.bookmark ?? 0)) : 0;
      const date = t.pubDate ? new Date(t.pubDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
      return {
        key: id,
        label: t.title,
        dot: !t.playCount,
        speaker: id === current,
        detail: t.bookmark && left ? `${formatTime(left)} left` : date,
        onSelect: () => playList(os, ids, i),
        onHold: () => songMenu(os, id),
      };
    });
  }, [tracks, show, current, os]);
  return <ListView rows={rows} empty="No Episodes" />;
}

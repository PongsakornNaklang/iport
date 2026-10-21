/**
 * The apps that appear on page two once you have that kind of content:
 * iTunes U (lecture collections) and Voice Memos (playback — the nano has
 * no microphone of its own).
 */
import { useMemo } from 'react';
import { voiceMemoTracks } from '../../../core/library/selectors';
import { useLibrary } from '../../../core/library/store';
import { usePlayer } from '../../../core/player/player';
import { formatTime } from '../../../core/util/format';
import type { Track, VoiceMemo } from '../../../core/types';
import { Glyph } from '../os/icons';
import { NavStack, useNav } from '../os/Nav';
import { Empty, Page, Row } from '../os/ui';
import { NowPlayingButton, usePlayList } from './common';
import { useAppNav } from './registry';

const EDU = /itunes ?u|education|lecture|course|university|college|class\b/i;

function isCourse(t: Track): boolean {
  return (t.mediaType === 'podcast' || t.mediaType === 'movie' || t.mediaType === 'tvshow') && EDU.test(`${t.genre ?? ''} ${t.show ?? ''} ${t.album}`);
}

export function ITunesUApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('itunesu');
  return <NavStack root={{ title: 'iTunes U', node: <Collections />, right: <NowPlayingButton /> }} tint="#ff9500" active={active} apiRef={apiRef} />;
}

function Collections() {
  const tracks = useLibrary((s) => s.tracks);
  const nav = useNav();
  const cols = useMemo(() => {
    const m = new Map<string, Track[]>();
    for (const t of Object.values(tracks)) {
      if (!isCourse(t)) continue;
      const k = t.show || t.album || 'Collection';
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks]);
  if (!cols.length)
    return <Empty icon={<Glyph.cap size={52} color="#c7c7cc" />} title="No Collections" text="Lectures and courses (podcasts in the Education genre) appear here." />;
  return (
    <Page>
      {cols.map(([name, list]) => (
        <Row
          key={name}
          art={list[0].artwork}
          artSize={44}
          tall
          title={name}
          subtitle={`${list.length} item${list.length === 1 ? '' : 's'}`}
          chevron
          onClick={() => nav.push({ title: name, node: <CollectionPage ids={list.map((t) => t.id)} />, right: <NowPlayingButton /> })}
        />
      ))}
    </Page>
  );
}

function CollectionPage({ ids }: { ids: string[] }) {
  const tracks = useLibrary((s) => s.tracks);
  const play = usePlayList();
  return (
    <Page>
      {ids.map((id, i) => {
        const t = tracks[id];
        if (!t) return null;
        return <Row key={id} title={t.title} subtitle={[t.artist, t.duration ? formatTime(t.duration) : ''].filter(Boolean).join(' · ')} badge={!t.playCount} onClick={() => play(ids, i)} />;
      })}
    </Page>
  );
}

// ---------------------------------------------------------------- voice memos

/** A library voice memo as a playable track (created on first play). */
function memoTrackId(m: VoiceMemo): string {
  const lib = useLibrary.getState();
  const [t] = lib.addTracks([
    {
      id: `vm_${m.id}`,
      source: 'local',
      ref: m.blobKey,
      mediaType: 'voicememo',
      title: m.name,
      artist: 'Voice Memo',
      album: 'Voice Memos',
      duration: m.duration,
      addedAt: m.createdAt,
      playCount: 0,
      skipCount: 0,
    },
  ]);
  return t.id;
}

export function VoiceMemosApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('voicememos');
  return <NavStack root={{ title: 'Voice Memos', node: <Memos />, right: <NowPlayingButton /> }} tint="#ff3b30" active={active} apiRef={apiRef} />;
}

function Memos() {
  const memos = useLibrary((s) => s.voiceMemos);
  const tracks = useLibrary((s) => s.tracks);
  const current = usePlayer((s) => s.currentId);
  const play = usePlayList();
  const items = useMemo(() => {
    const vt = voiceMemoTracks(tracks);
    const refs = new Set(vt.map((t) => t.ref));
    const list: { key: string; name: string; date: number; duration?: number; trackId?: string; memo?: VoiceMemo }[] = vt.map((t) => ({ key: t.id, name: t.title, date: t.addedAt, duration: t.duration, trackId: t.id }));
    for (const m of memos) if (!refs.has(m.blobKey)) list.push({ key: m.id, name: m.name, date: m.createdAt, duration: m.duration, memo: m });
    return list.sort((a, b) => b.date - a.date);
  }, [memos, tracks]);
  if (!items.length) return <Empty icon={<Glyph.mic size={48} color="#c7c7cc" />} title="No Voice Memos" text="Voice memos recorded on another iPod (or imported) play here." />;
  return (
    <Page>
      {items.map((it) => (
        <Row
          key={it.key}
          title={it.name}
          subtitle={new Date(it.date).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
          detail={formatTime(it.duration)}
          left={current && current === it.trackId ? <Glyph.volHigh size={12} color="#ff3b30" /> : undefined}
          onClick={() => {
            const ids = items.map((x) => x.trackId ?? memoTrackId(x.memo!));
            play(ids, items.indexOf(it));
          }}
        />
      ))}
    </Page>
  );
}

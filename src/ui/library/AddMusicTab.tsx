/** Add Music tab: "paste any link" + one section per source. */
import { useState, type ReactNode } from 'react';
import { classifyLink, directTrack } from '@/core/sources/links';
import { friendlyError } from '@/core/sources/net';
import { lookupPodcast } from '@/core/sources/podcasts';
import { soundcloudTracks } from '@/core/sources/soundcloud';
import { isExpandableList, youtubeTrackFromId } from '@/core/sources/youtube';
import { player } from '@/core/player/player';
import { IconLink, IconRadio } from '../icons';
import { IconArchive, IconAudius, IconComputer, IconPodcast, IconSoundCloud, IconStore, IconYouTube } from './icons';
import { addToLibrary, useSticky } from './state';
import { InlineForm } from './ui';
import { ComputerSource } from './sources/ComputerSource';
import { YouTubeSource } from './sources/YouTubeSource';
import { SoundCloudSource } from './sources/SoundCloudSource';
import { AudiusSource } from './sources/AudiusSource';
import { ArchiveSource } from './sources/ArchiveSource';
import { RadioSource } from './sources/RadioSource';
import { PodcastSource } from './sources/PodcastSource';
import { PreviewSource } from './sources/PreviewSource';
import { LinkSource } from './sources/LinkSource';

export type SourceId = 'computer' | 'youtube' | 'soundcloud' | 'audius' | 'archive' | 'radio' | 'podcasts' | 'previews' | 'link';

/** Something another part of the tab asks a source to open (e.g. a pasted playlist link). */
export type Intent =
  | { kind: 'yt-list'; listId: string; seq: number }
  | { kind: 'archive-item'; id: string; seq: number }
  | { kind: 'feed'; url: string; seq: number }
  | { kind: 'link'; url: string; seq: number };

type IntentInput = Intent extends infer I ? (I extends Intent ? Omit<I, 'seq'> : never) : never;

export const SOURCES: { id: SourceId; label: string; title: string; color: string; icon: ReactNode; blurb: string }[] = [
  { id: 'computer', label: 'Computer', title: 'From your computer', color: '#8e8e93', icon: <IconComputer />, blurb: 'Your own songs, videos and folders. They stay private in this browser.' },
  { id: 'youtube', label: 'YouTube', title: 'YouTube', color: '#ff0033', icon: <IconYouTube />, blurb: 'Search, or paste any video, Short, YouTube Music or playlist link.' },
  { id: 'soundcloud', label: 'SoundCloud', title: 'SoundCloud', color: '#ff5500', icon: <IconSoundCloud />, blurb: 'Paste a track or playlist link from soundcloud.com, or search.' },
  { id: 'audius', label: 'Audius', title: 'Audius', color: '#a845ff', icon: <IconAudius />, blurb: 'Free, full-length songs from independent artists. No account needed.' },
  { id: 'archive', label: 'Archive', title: 'Internet Archive', color: '#8a7650', icon: <IconArchive />, blurb: 'Live concerts, netlabels, 78s, old radio, audiobooks and public-domain films.' },
  { id: 'radio', label: 'Radio', title: 'Radio', color: '#30b158', icon: <IconRadio />, blurb: 'Thousands of free internet radio stations, from Thailand and worldwide.' },
  { id: 'podcasts', label: 'Podcasts', title: 'Podcasts', color: '#9b5cf6', icon: <IconPodcast />, blurb: 'Find any show in the Apple Podcasts directory and add episodes.' },
  { id: 'previews', label: 'Previews', title: 'iTunes Previews', color: '#fc3c6c', icon: <IconStore />, blurb: '30-second song and music video previews from the iTunes Store.' },
  { id: 'link', label: 'Link', title: 'Direct link', color: '#0a84ff', icon: <IconLink />, blurb: 'Any direct link to an audio or video file, or a radio stream.' },
];

export function AddMusicTab() {
  const [source, setSource] = useSticky<SourceId>('add.source', 'computer', true);
  const [intent, setIntent] = useState<Intent | null>(null);
  const meta = SOURCES.find((s) => s.id === source) ?? SOURCES[0];

  const open = (id: SourceId, it?: IntentInput) => {
    setSource(id);
    if (it) setIntent({ ...it, seq: Date.now() } as Intent);
  };

  const body = (() => {
    switch (source) {
      case 'computer':
        return <ComputerSource />;
      case 'youtube':
        return <YouTubeSource intent={intent?.kind === 'yt-list' ? intent : null} />;
      case 'soundcloud':
        return <SoundCloudSource />;
      case 'audius':
        return <AudiusSource />;
      case 'archive':
        return <ArchiveSource intent={intent?.kind === 'archive-item' ? intent : null} />;
      case 'radio':
        return <RadioSource />;
      case 'podcasts':
        return <PodcastSource intent={intent?.kind === 'feed' ? intent : null} />;
      case 'previews':
        return <PreviewSource />;
      case 'link':
        return <LinkSource intent={intent?.kind === 'link' ? intent : null} />;
    }
  })();

  return (
    <>
      <PasteBar open={open} />
      <div className="lib-sources" role="tablist" aria-label="Where to add music from" style={{ marginTop: 16 }}>
        {SOURCES.map((s) => (
          <button key={s.id} role="tab" aria-selected={s.id === source} className={`lib-src ${s.id === source ? 'on' : ''}`} onClick={() => open(s.id)} title={s.title}>
            <span className="lib-src-ico" style={{ backgroundColor: s.color }}>
              {s.icon}
            </span>
            <span className="lib-src-lbl">{s.label}</span>
          </button>
        ))}
      </div>
      <div className="lib-src-head">
        <h3>{meta.title}</h3>
        <p>{meta.blurb}</p>
      </div>
      <div key={source}>{body}</div>
    </>
  );
}

// ------------------------------------------------------------------ paste any link

type PasteResult = { tone: 'ok' | 'err' | 'info'; text: string; actions?: { label: string; run: () => void; primary?: boolean }[] };

function PasteBar({ open }: { open: (id: SourceId, it?: IntentInput) => void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<PasteResult | null>(null);

  const playAction = (ids: string[]) => ({ label: 'Play', primary: true, run: () => player.playTracks(ids, 0) });

  const go = async (input: string) => {
    const link = classifyLink(input);
    if (!link) {
      setRes({ tone: 'err', text: 'That doesn’t look like a link. Copy the address from your browser and paste it here.' });
      return;
    }
    setBusy(true);
    setRes(null);
    try {
      switch (link.kind) {
        case 'youtube': {
          const { videoId, listId } = link.ref;
          if (!videoId && listId) {
            open('youtube', { kind: 'yt-list', listId });
            setRes({ tone: 'info', text: 'Opened the playlist below.' });
            break;
          }
          const t = await youtubeTrackFromId(videoId!);
          const [added] = addToLibrary([t], { quiet: true });
          const actions = [playAction([added.id])];
          if (listId && isExpandableList(listId))
            actions.push({ label: 'Show whole playlist', primary: false, run: () => open('youtube', { kind: 'yt-list', listId }) });
          setRes({ tone: 'ok', text: `Added “${added.title}”`, actions });
          break;
        }
        case 'soundcloud': {
          const r = await soundcloudTracks(link.url);
          const added = addToLibrary(r.tracks, { quiet: true });
          setRes({
            tone: 'ok',
            text: added.length === 1 ? `Added “${added[0].title}”` : `Added ${added.length} tracks from “${r.title}”${r.note ? ` — ${r.note}` : ''}`,
            actions: [playAction(added.map((t) => t.id))],
          });
          break;
        }
        case 'archive':
          open('archive', { kind: 'archive-item', id: link.id });
          setRes({ tone: 'info', text: 'Opened the archive.org item below.' });
          break;
        case 'apple-podcast': {
          const show = await lookupPodcast(link.id);
          if (!show) throw new Error('Couldn’t find that show’s feed.');
          open('podcasts', { kind: 'feed', url: show.feedUrl });
          setRes({ tone: 'info', text: `Opened “${show.title}” below.` });
          break;
        }
        case 'feed':
          open('podcasts', { kind: 'feed', url: link.url });
          setRes({ tone: 'info', text: 'Opened the podcast feed below.' });
          break;
        case 'media': {
          const [added] = addToLibrary([directTrack(link.url, { video: link.video })], { quiet: true });
          setRes({ tone: 'ok', text: `Added “${added.title}”`, actions: [playAction([added.id])] });
          break;
        }
        case 'unknown':
          setRes({
            tone: 'info',
            text: 'What is this link?',
            actions: [
              {
                label: 'Audio stream',
                primary: true,
                run: () => {
                  const [a] = addToLibrary([directTrack(link.url, { video: false })]);
                  setRes({ tone: 'ok', text: `Added “${a.title}”`, actions: [playAction([a.id])] });
                },
              },
              {
                label: 'Radio station',
                run: () => {
                  const [a] = addToLibrary([directTrack(link.url, { mediaType: 'radio' })]);
                  setRes({ tone: 'ok', text: `Added station “${a.title}”`, actions: [playAction([a.id])] });
                },
              },
              { label: 'Podcast feed', run: () => open('podcasts', { kind: 'feed', url: link.url }) },
              { label: 'More options…', run: () => open('link', { kind: 'link', url: link.url }) },
            ],
          });
          break;
      }
      if (link.kind !== 'unknown') setUrl('');
    } catch (e) {
      setRes({ tone: 'err', text: friendlyError(e, 'that site') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lib-card lib-paste" style={{ marginTop: 4 }}>
      <InlineForm value={url} onChange={setUrl} onSubmit={(v) => void go(v)} busy={busy} button="Add" icon={<IconLink />} placeholder="Paste any link — YouTube, SoundCloud, MP3…" />
      {res && (
        <div className="lib-paste-result">
          <span className={`msg ${res.tone === 'ok' ? 'ok' : res.tone === 'err' ? 'err' : ''}`}>{res.text}</span>
          {res.actions?.map((a) => (
            <button key={a.label} className={`btn small ${a.primary ? 'primary' : ''}`} onClick={a.run}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

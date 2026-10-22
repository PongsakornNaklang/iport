import { useEffect, useMemo, useState } from 'react';
import { allTracks, songs, useTracks } from '../../../../core/library/selectors';
import { useLibrary } from '../../../../core/library/store';
import { EQ_PRESET_NAMES } from '../../../../core/player/eq';
import { player } from '../../../../core/player/player';
import { DEFAULT_MAIN_MENU, DEFAULT_MUSIC_MENU, useDeviceSetting, useSettings, type AudiobookSpeed, type ClickerMode } from '../../../../core/settings/store';
import type { RepeatMode, ShuffleMode } from '../../../../core/types';
import { formatBytes, formatClock } from '../../../../core/util/format';
import { useNow } from '../../../../core/util/hooks';
import { clamp, CONTRAST_DEFAULT, useInput, useOS } from '../core';
import { ChoiceList, cycleRow, TextScreen, toggleRow } from '../common';
import { LockGlyph } from '../glyphs';
import { ListView, type Row } from '../ListView';

const SHUFFLE: { value: ShuffleMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'songs', label: 'Songs' },
  { value: 'albums', label: 'Albums' },
];
const REPEAT: { value: RepeatMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'one', label: 'One' },
  { value: 'all', label: 'All' },
];
const BACKLIGHT = [
  { value: 2, label: '2 Seconds' },
  { value: 5, label: '5 Seconds' },
  { value: 10, label: '10 Seconds' },
  { value: 15, label: '15 Seconds' },
  { value: 20, label: '20 Seconds' },
  { value: 30, label: '30 Seconds' },
  { value: 0, label: 'Always On' },
];
const CLICKER: { value: ClickerMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'speaker', label: 'Speaker' },
  { value: 'headphones', label: 'Headphones' },
  { value: 'both', label: 'Both' },
];
const AUDIOBOOKS: { value: AudiobookSpeed; label: string }[] = [
  { value: 'slower', label: 'Slower' },
  { value: 'normal', label: 'Normal' },
  { value: 'faster', label: 'Faster' },
];
const SHAKE = [
  { value: 'shuffle', label: 'Shuffle' },
  { value: 'off', label: 'Off' },
];
const LANGUAGES = ['English', 'ไทย', 'Deutsch', 'Español', 'Français', 'Italiano', '日本語', '한국어', 'Nederlands', 'Português', 'Русский', '简体中文', '繁體中文', 'Svenska', 'Türkçe'];

export function SettingsMenu() {
  const os = useOS();
  const s = useSettings();
  const push = (title: string, el: React.ReactElement) => os.nav.push({ title, el });
  const [shake, setShake] = useDeviceSetting<string>(os.modelId, 'shake', 'shuffle');
  const rows: Row[] = [
    { key: 'about', label: 'About', chevron: true, onSelect: () => push('About', <AboutScreen />) },
    cycleRow('Shuffle', s.shuffle, SHUFFLE, (v) => player.setShuffle(v)),
    cycleRow('Repeat', s.repeat, REPEAT, (v) => player.setRepeat(v)),
    // the nano 4G's motion sensor: shake to shuffle
    ...(os.caps.motion ? [cycleRow('Shake', shake, SHAKE, setShake)] : []),
    { key: 'mainmenu', label: 'Main Menu', chevron: true, onSelect: () => push('Main Menu', <MenuToggles which="mainMenu" />) },
    // the Music menu became customisable with the classic
    ...(os.caps.backlightItem ? [] : [{ key: 'musicmenu', label: 'Music Menu', chevron: true, onSelect: () => push('Music Menu', <MenuToggles which="musicMenu" />) }]),
    { key: 'vlimit', label: 'Volume Limit', chevron: true, onSelect: () => push('Volume Limit', <LevelScreen kind="limit" />) },
    {
      key: 'backlight',
      label: 'Backlight',
      detail: BACKLIGHT.find((b) => b.value === s.backlight)?.label.replace(' Seconds', ' Secs') ?? `${s.backlight}s`,
      chevron: true,
      onSelect: () => push('Backlight', <ChoiceList choices={BACKLIGHT} value={s.backlight} onPick={(v) => s.set('backlight', v)} />),
    },
    os.caps.contrast
      ? { key: 'contrast', label: 'Contrast', chevron: true, onSelect: () => push('Contrast', <LevelScreen kind="contrast" />) }
      : { key: 'brightness', label: 'Brightness', chevron: true, onSelect: () => push('Brightness', <LevelScreen kind="brightness" />) },
    ...(os.caps.backlightItem ? [] : [toggleRow('Audio Crossfade', s.crossfade, (v) => s.set('crossfade', v))]),
    toggleRow('Sound Check', s.soundCheck, (v) => s.set('soundCheck', v)),
    {
      key: 'eq',
      label: 'EQ',
      detail: s.eq,
      chevron: true,
      onSelect: () => push('EQ', <ChoiceList choices={EQ_PRESET_NAMES.map((n) => ({ value: n, label: n }))} value={s.eq} onPick={(v) => s.set('eq', v)} />),
    },
    {
      key: 'audiobooks',
      label: 'Audiobooks',
      detail: AUDIOBOOKS.find((a) => a.value === s.audiobookSpeed)?.label,
      chevron: true,
      onSelect: () => push('Audiobooks', <ChoiceList choices={AUDIOBOOKS} value={s.audiobookSpeed} onPick={(v) => s.set('audiobookSpeed', v)} />),
    },
    {
      key: 'clicker',
      label: 'Clicker',
      detail: CLICKER.find((c) => c.value === s.clicker)?.label,
      chevron: true,
      onSelect: () => push('Clicker', <ChoiceList choices={CLICKER} value={s.clicker} onPick={(v) => s.set('clicker', v)} />),
    },
    { key: 'datetime', label: 'Date & Time', chevron: true, onSelect: () => push('Date & Time', <DateTimeScreen />) },
    cycleRow(
      'Sort By',
      s.contactsSortBy,
      [
        { value: 'first' as const, label: 'First' },
        { value: 'last' as const, label: 'Last' },
      ],
      (v) => s.set('contactsSortBy', v),
    ),
    {
      key: 'language',
      label: 'Language',
      chevron: true,
      onSelect: () => push('Language', <ChoiceList choices={LANGUAGES.map((l) => ({ value: l, label: l }))} value={s.language} onPick={(v) => s.set('language', v)} />),
    },
    { key: 'legal', label: 'Legal', chevron: true, onSelect: () => push('Legal', <TextScreen text={LEGAL} />) },
    {
      key: 'reset',
      label: 'Reset Settings',
      chevron: true,
      onSelect: () =>
        push(
          'Reset Settings',
          <ListView
            rows={[
              { key: 'cancel', label: 'Cancel', onSelect: () => os.nav.pop() },
              {
                key: 'reset',
                label: 'Reset',
                onSelect: () => {
                  useSettings.getState().reset();
                  os.nav.root();
                },
              },
            ]}
          />,
        ),
    },
  ];
  return <ListView rows={rows} />;
}

function MenuToggles({ which }: { which: 'mainMenu' | 'musicMenu' }) {
  const menu = useSettings((s) => s[which]);
  const os = useOS();
  const defaults = which === 'mainMenu' ? DEFAULT_MAIN_MENU : DEFAULT_MUSIC_MENU;
  const rows = useMemo<Row[]>(() => {
    const keys = Object.keys(defaults).filter((k) => {
      if (which !== 'mainMenu') return k !== 'Cover Flow' || os.caps.coverFlow;
      if (k === 'Settings') return false;
      if ((k === 'Videos' && !os.caps.video) || (k === 'Photos' && !os.caps.photos)) return false;
      return true;
    });
    const set = (k: string, v: boolean) => useSettings.getState().set(which, { ...useSettings.getState()[which], [k]: v });
    return [
      ...keys.sort((a, b) => a.localeCompare(b)).map((k) => toggleRow(k, menu[k] ?? defaults[k], (v) => set(k, v))),
      { key: '__reset', label: which === 'mainMenu' ? 'Reset Main Menu' : 'Reset Music Menu', onSelect: () => useSettings.getState().set(which, { ...defaults }) },
    ];
  }, [menu, defaults, which, os]);
  return <ListView rows={rows} />;
}

/** Volume Limit / Brightness / Contrast (the mini's grey LCD): a bar adjusted with the wheel. */
function LevelScreen({ kind }: { kind: 'limit' | 'brightness' | 'contrast' }) {
  const os = useOS();
  const shared = useSettings((s) => (kind === 'limit' ? s.volumeLimit : s.brightness));
  const [contrast, setContrast] = useDeviceSetting<number>(os.modelId, 'contrast', CONTRAST_DEFAULT);
  const value = kind === 'contrast' ? contrast : shared;
  useInput((e) => {
    if (e.type === 'scroll') {
      const v = clamp(value + e.steps / 32, kind === 'limit' ? 0.05 : 0.15, 1);
      if (kind === 'contrast') setContrast(v);
      else useSettings.getState().set(kind === 'limit' ? 'volumeLimit' : 'brightness', v);
      return true;
    }
    if (e.type === 'click' && e.button === 'select') {
      os.nav.pop();
      return true;
    }
    return false;
  });
  const sun = (big: boolean) => (
    <svg width={big ? 18 : 12} height={big ? 18 : 12} viewBox="-10 -10 20 20" aria-hidden>
      <circle r="4" fill="#333" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x="-0.8" y="-9" width="1.6" height="3" fill="#333" transform={`rotate(${i * 45})`} />
      ))}
    </svg>
  );
  // contrast: a circle, half dark
  const half = (big: boolean) => (
    <svg width={big ? 18 : 12} height={big ? 18 : 12} viewBox="-10 -10 20 20" aria-hidden>
      <circle r="8" fill="none" stroke="#333" strokeWidth="1.6" />
      <path d="M0 -8a8 8 0 0 1 0 16z" fill="#333" />
    </svg>
  );
  return (
    <div className="cl-level">
      <div className="cl-level-caption">{kind === 'limit' ? 'Set the maximum volume' : ''}</div>
      <div className="cl-level-row">
        {kind === 'limit' ? <LockGlyph size={13} /> : kind === 'contrast' ? half(false) : sun(false)}
        <div className="cl-bar cl-bar-big">
          <div className="cl-bar-fill" style={{ width: `${value * 100}%` }} />
        </div>
        {kind === 'limit' ? <span className="cl-level-pct">{value >= 1 ? 'Off' : `${Math.round(value * 100)}%`}</span> : kind === 'contrast' ? half(true) : sun(true)}
      </div>
      <div className="cl-level-hint">Press center to confirm</div>
    </div>
  );
}

function DateTimeScreen() {
  const os = useOS();
  const s = useSettings();
  const now = useNow(1000);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const rows: Row[] = [
    {
      key: 'set',
      label: 'Set Date & Time',
      chevron: true,
      onSelect: () =>
        os.nav.push({
          title: 'Date & Time',
          el: (
            <div className="cl-message">
              <b>{formatClock(now, s.use24h)}</b>
              <span>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
              <span>iPod sets its clock from your computer.</span>
            </div>
          ),
        }),
    },
    { key: 'tz', label: 'Time Zone', detail: tz.split('/').pop()?.replace(/_/g, ' '), onSelect: () => os.hud('Set automatically') },
    toggleRow('24 Hour Clock', s.use24h, (v) => s.set('use24h', v)),
    toggleRow('Time in Title', s.timeInTitle, (v) => s.set('timeInTitle', v)),
  ];
  return <ListView rows={rows} />;
}

// ------------------------------------------------------------------ About

function AboutScreen() {
  const os = useOS();
  const tracks = useTracks();
  const photos = useLibrary((s) => s.photos.length);
  const [page, setPage] = useState(0);
  const [used, setUsed] = useState<number | null>(null);
  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => setUsed(e.usage ?? 0))
      .catch(() => setUsed(0));
  }, []);
  const pages = 2;
  useInput((e) => {
    if (e.type === 'scroll' || (e.type === 'click' && (e.button === 'select' || e.button === 'next' || e.button === 'prev'))) {
      const d = e.type === 'scroll' ? Math.sign(e.steps) : e.type === 'click' && e.button === 'prev' ? -1 : 1;
      setPage((p) => (e.type === 'scroll' ? clamp(p + d, 0, pages - 1) : (p + d + pages) % pages));
      return true;
    }
    return false;
  });
  const nSongs = songs(tracks).length;
  const nVideos = allTracks(tracks).filter((t) => t.mediaType === 'movie' || t.mediaType === 'tvshow' || t.mediaType === 'musicvideo').length;
  const cap = os.info.capacityBytes * 0.931; // formatted capacity, like the real thing
  const lines: [string, string][] =
    page === 0
      ? [
          ['Songs', nSongs.toLocaleString()],
          ['Videos', nVideos.toLocaleString()],
          ['Photos', photos.toLocaleString()],
          ['Capacity', formatBytes(cap).replace('GB', 'GB')],
          ['Available', used == null ? '—' : formatBytes(Math.max(0, cap - used))],
        ]
      : [
          ['Version', os.info.version],
          ['S/N', os.info.serial],
          ['Model', os.info.model],
          ['Format', os.info.format],
        ];
  return (
    <div className="cl-about">
      <div className="cl-about-name">{os.info.name}</div>
      <div className="cl-about-lines">
        {lines.map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </div>
      <div className="cl-dots cl-about-dots">
        {Array.from({ length: pages }, (_, i) => (
          <span key={i} className={i === page ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}

const LEGAL = `iPort — an iPod tribute for the web.

iPod, iPod classic, Click Wheel, Cover Flow, Genius and iTunes are trademarks of Apple Inc. This simulator is a fan project and is not affiliated with, authorized or endorsed by Apple Inc.

Music you add stays in your browser. Streaming sources (YouTube, SoundCloud and others) are played with their official embedded players and remain subject to their own terms.

Everything you see here is drawn with HTML, CSS and SVG.`;

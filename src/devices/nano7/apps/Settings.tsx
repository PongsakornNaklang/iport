import { useEffect, useState, type ReactNode } from 'react';
import { useCustomize } from '../../../core/customize/store';
import { useLibrary } from '../../../core/library/store';
import { podcasts, songs, videosOf } from '../../../core/library/selectors';
import { EQ_PRESET_NAMES } from '../../../core/player/eq';
import { player } from '../../../core/player/player';
import { AUDIOBOOK_RATES, useSettings, type AudiobookSpeed } from '../../../core/settings/store';
import { formatClock } from '../../../core/util/format';
import { useNow } from '../../../core/util/hooks';
import type { ShuffleMode } from '../../../core/types';
import { nano, useNanoData, type RadioRegion } from '../state';
import { Glyph } from '../os/icons';
import { NavStack, useNav, type PageSpec } from '../os/Nav';
import { Page, Row, Section, Slider, Switch } from '../os/ui';
import { LANGUAGES } from '../os/i18n';
import { WALLPAPERS, wallpaperStyle } from '../os/wallpaper';
import { useAppNav } from './registry';

const TINT = '#007aff';
const GROUPED = '#efeff4';

function SIcon({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <span className="n7-sicon" style={{ background: bg }}>
      {children}
    </span>
  );
}

const sub = (title: string, node: ReactNode): PageSpec => ({ title, node, bg: GROUPED });

export function SettingsApp({ active }: { active: boolean }) {
  const apiRef = useAppNav('settings');
  return <NavStack root={{ title: 'Settings', node: <SettingsRoot />, bg: GROUPED }} tint={TINT} active={active} apiRef={apiRef} />;
}

function SettingsRoot() {
  const nav = useNav();
  const bt = useNanoData((s) => s.bluetooth);
  return (
    <Page grouped>
      <Section>
        <Row
          icon={
            <SIcon bg="#8e8e93">
              <GearGlyph />
            </SIcon>
          }
          title="General"
          chevron
          onClick={() => nav.push(sub('General', <General />))}
        />
        <Row icon={<SIcon bg="#ff8a00"><Glyph.songs size={13} color="#fff" /></SIcon>} title="Music" chevron onClick={() => nav.push(sub('Music', <MusicSettings />))} />
        <Row icon={<SIcon bg="#1a8cf0"><Glyph.mv size={13} color="#fff" /></SIcon>} title="Videos" chevron onClick={() => nav.push(sub('Videos', <VideoSettings />))} />
        <Row icon={<SIcon bg="#f5a623"><Glyph.photo size={13} color="#fff" /></SIcon>} title="Photos" chevron onClick={() => nav.push(sub('Photos', <PhotoSettings />))} />
        <Row icon={<SIcon bg="#34c759"><Glyph.run size={13} color="#fff" /></SIcon>} title="Fitness" chevron onClick={() => nav.push(sub('Fitness', <FitnessSettings />))} />
        <Row icon={<SIcon bg="#ff2d55"><RadioGlyph /></SIcon>} title="Radio" chevron onClick={() => nav.push(sub('Radio', <RadioSettings />))} />
      </Section>
      <Section>
        <Row icon={<SIcon bg="#007aff"><Glyph.bluetooth size={13} color="#fff" /></SIcon>} title="Bluetooth" detail={bt ? 'On' : 'Off'} chevron onClick={() => nav.push(sub('Bluetooth', <Bluetooth />))} />
      </Section>
      <Section>
        <Row
          title="Reset Settings"
          destructive
          center
          onClick={() =>
            nano.sheet(
              [
                {
                  label: 'Reset All Settings',
                  destructive: true,
                  onSelect: () => {
                    useSettings.getState().reset();
                    useNanoData.getState().resetSettings();
                    nano.toast('Settings Reset');
                  },
                },
              ],
              'This will reset all settings. Your music and data won’t be deleted.',
            )
          }
        />
      </Section>
    </Page>
  );
}

function GearGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24">
      <path
        d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.4 5.2-1.6-.3a7 7 0 0 1-.7 1.7l.9 1.4-1.9 1.9-1.4-.9a7 7 0 0 1-1.7.7l-.3 1.6h-2.7l-.3-1.6a7 7 0 0 1-1.7-.7l-1.4.9-1.9-1.9.9-1.4a7 7 0 0 1-.7-1.7l-1.6-.3v-2.7l1.6-.3a7 7 0 0 1 .7-1.7l-.9-1.4 1.9-1.9 1.4.9a7 7 0 0 1 1.7-.7l.3-1.6h2.7l.3 1.6a7 7 0 0 1 1.7.7l1.4-.9 1.9 1.9-.9 1.4a7 7 0 0 1 .7 1.7l1.6.3z"
        fill="#fff"
      />
    </svg>
  );
}
function RadioGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24">
      <path d="M12 9 7 22M12 9l5 13M9 16h6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="12" cy="7" r="2.2" fill="#fff" />
      <path d="M7.5 3.5a6 6 0 0 0 0 7M16.5 3.5a6 6 0 0 1 0 7" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------- General

function General() {
  const nav = useNav();
  const brightness = useSettings((s) => s.brightness);
  const language = useSettings((s) => s.language);
  const invert = useNanoData((s) => s.invert);
  const mono = useNanoData((s) => s.mono);
  return (
    <Page grouped>
      <Section>
        <Row title="About" chevron onClick={() => nav.push(sub('About', <About />))} />
        <Row title="Wallpaper" chevron onClick={() => nav.push(sub('Wallpaper', <WallpaperPage />))} />
        <Row title="Date & Time" chevron onClick={() => nav.push(sub('Date & Time', <DateTime />))} />
        <Row title="Language" detail={language} chevron onClick={() => nav.push(sub('Language', <Language />))} />
      </Section>
      <Section header="Brightness">
        <div className="n7-section-slider">
          <Slider value={brightness} onChange={(v) => useSettings.getState().set('brightness', Math.max(0.05, v))} min={<SunGlyph small />} max={<SunGlyph />} />
        </div>
      </Section>
      <Section header="Accessibility" footer="White on Black inverts the colors of the display.">
        <Row title="VoiceOver" detail="Off" />
        <Row title="White on Black" right={<Switch on={invert} onChange={(v) => useNanoData.getState().set('invert', v)} />} />
        <Row title="Mono Audio" right={<Switch on={mono} onChange={(v) => useNanoData.getState().set('mono', v)} />} />
      </Section>
    </Page>
  );
}

function SunGlyph({ small }: { small?: boolean }) {
  const s = small ? 12 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4.5" fill="#8e8e93" />
      {Array.from({ length: 8 }, (_, i) => (
        <line key={i} x1="12" y1="2" x2="12" y2="5" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" transform={`rotate(${i * 45} 12 12)`} />
      ))}
    </svg>
  );
}

function About() {
  const tracks = useLibrary((s) => s.tracks);
  const photos = useLibrary((s) => s.photos);
  const serial = useNanoData((s) => s.serial);
  const all = Object.values(tracks);
  const nSongs = songs(tracks).length;
  const nVideos = videosOf(tracks, 'movie').length + videosOf(tracks, 'tvshow').length + videosOf(tracks, 'musicvideo').length;
  const nPod = podcasts(tracks).reduce((n, p) => n + p.trackIds.length, 0);
  // rough storage use: local media at ~256 kbps, photos ~1.5 MB
  const used = all.reduce((b, t) => b + (t.source === 'local' ? (t.duration ?? 200) * 32_000 : 0), 0) + photos.length * 1.5e6;
  const cap = 14.6e9;
  const gb = (n: number) => `${(n / 1e9).toFixed(1)} GB`;
  return (
    <Page grouped>
      <Section>
        <Row title="Name" detail="iPod" />
      </Section>
      <Section>
        <Row title="Songs" detail={nSongs.toLocaleString()} />
        <Row title="Videos" detail={nVideos.toLocaleString()} />
        <Row title="Photos" detail={photos.length.toLocaleString()} />
        <Row title="Podcasts" detail={nPod.toLocaleString()} />
        <Row title="Capacity" detail={gb(cap)} />
        <Row title="Available" detail={gb(Math.max(0, cap - used))} />
        <Row title="Version" detail="1.0.4" />
        <Row title="Model" detail="MKN52LL/A" />
        <Row title="Serial Number" detail={serial} />
      </Section>
      <Section>
        <Row title="Legal" chevron onClick={() => nano.toast('© 2012–2015 Apple Inc.')} />
      </Section>
    </Page>
  );
}

function WallpaperPage() {
  const current = useCustomize((s) => String(s.appearances.nano7?.options.wallpaper ?? 'dark'));
  return (
    <Page grouped>
      <div className="n7-wallgrid">
        {WALLPAPERS.map((w) => (
          <button key={w.id} className={`n7-wallthumb ${current === w.id ? 'on' : ''}`} onClick={() => useCustomize.getState().setOption('wallpaper', w.id)}>
            <div style={wallpaperStyle(w.id)} />
            <span>{w.name}</span>
          </button>
        ))}
      </div>
      <div className="n7-section-footer">The wallpaper is also in Customize ▸ Wallpaper.</div>
    </Page>
  );
}

function DateTime() {
  const use24h = useSettings((s) => s.use24h);
  const now = useNow(1000);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <Page grouped>
      <Section>
        <Row title="24-Hour Time" right={<Switch on={use24h} onChange={(v) => useSettings.getState().set('use24h', v)} />} />
      </Section>
      <Section footer="Date and time are set automatically from your computer.">
        <Row title="Time Zone" detail={tz.split('/').pop()?.replace(/_/g, ' ')} />
        <Row title="Date" detail={now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} />
        <Row title="Time" detail={formatClock(now, use24h)} />
      </Section>
    </Page>
  );
}

function Language() {
  const language = useSettings((s) => s.language);
  return (
    <Page grouped>
      <Section footer="ภาษาไทย translates the system menus.">
        {LANGUAGES.map((l) => (
          <Row key={l} title={l} checked={language === l} onClick={() => useSettings.getState().set('language', l)} />
        ))}
      </Section>
    </Page>
  );
}

// ---------------------------------------------------------------- Music

function MusicSettings() {
  const nav = useNav();
  const s = useSettings();
  const group = useNanoData((x) => x.groupCompilations);
  const lyrics = useNanoData((x) => x.lyricsInfo);
  return (
    <Page grouped>
      <Section>
        <Row title="Shuffle" detail={s.shuffle === 'off' ? 'Off' : s.shuffle === 'songs' ? 'Songs' : 'Albums'} chevron onClick={() => nav.push(sub('Shuffle', <ShufflePage />))} />
        <Row title="Repeat" detail={s.repeat === 'off' ? 'Off' : s.repeat === 'one' ? 'One' : 'All'} chevron onClick={() => nav.push(sub('Repeat', <RepeatPage />))} />
      </Section>
      <Section>
        <Row title="Sound Check" right={<Switch on={s.soundCheck} onChange={(v) => s.set('soundCheck', v)} />} />
        <Row title="EQ" detail={s.eq} chevron onClick={() => nav.push(sub('EQ', <EqPage />))} />
        <Row title="Volume Limit" detail={s.volumeLimit >= 1 ? 'Off' : `${Math.round(s.volumeLimit * 100)}%`} chevron onClick={() => nav.push(sub('Volume Limit', <VolumeLimit />))} />
      </Section>
      <Section>
        <Row title="Group Compilations" right={<Switch on={group} onChange={(v) => useNanoData.getState().set('groupCompilations', v)} />} />
        <Row title="Lyrics & Podcast Info" right={<Switch on={lyrics} onChange={(v) => useNanoData.getState().set('lyricsInfo', v)} />} />
        <Row title="Audiobook Speed" detail={`${AUDIOBOOK_RATES[s.audiobookSpeed]}×`} chevron onClick={() => nav.push(sub('Audiobook Speed', <SpeedPage />))} />
      </Section>
    </Page>
  );
}

function ShufflePage() {
  const v = useSettings((s) => s.shuffle);
  const opts: [ShuffleMode, string][] = [
    ['off', 'Off'],
    ['songs', 'Songs'],
    ['albums', 'Albums'],
  ];
  return (
    <Page grouped>
      <Section>
        {opts.map(([k, l]) => (
          <Row key={k} title={l} checked={v === k} onClick={() => player.setShuffle(k)} />
        ))}
      </Section>
    </Page>
  );
}
function RepeatPage() {
  const v = useSettings((s) => s.repeat);
  return (
    <Page grouped>
      <Section>
        {(['off', 'one', 'all'] as const).map((k) => (
          <Row key={k} title={k === 'off' ? 'Off' : k === 'one' ? 'One' : 'All'} checked={v === k} onClick={() => player.setRepeat(k)} />
        ))}
      </Section>
    </Page>
  );
}
function EqPage() {
  const eq = useSettings((s) => s.eq);
  return (
    <Page grouped>
      <Section>
        {EQ_PRESET_NAMES.map((n) => (
          <Row key={n} title={n} checked={eq === n} onClick={() => useSettings.getState().set('eq', n)} />
        ))}
      </Section>
    </Page>
  );
}
function VolumeLimit() {
  const lim = useSettings((s) => s.volumeLimit);
  return (
    <Page grouped>
      <Section header="Max Volume" footer="Limits the maximum volume of music and videos.">
        <div className="n7-section-slider">
          <Slider value={lim} onChange={(v) => useSettings.getState().set('volumeLimit', Math.max(0.05, v))} min={<Glyph.volLow size={14} color="#8e8e93" />} max={<Glyph.volHigh size={15} color="#8e8e93" />} />
        </div>
      </Section>
      <Section>
        <Row title="Turn Off Volume Limit" tinted center onClick={() => useSettings.getState().set('volumeLimit', 1)} />
      </Section>
    </Page>
  );
}
function SpeedPage() {
  const v = useSettings((s) => s.audiobookSpeed);
  const opts: [AudiobookSpeed, string][] = [
    ['slower', 'Slower'],
    ['normal', 'Normal'],
    ['faster', 'Faster'],
  ];
  return (
    <Page grouped>
      <Section>
        {opts.map(([k, l]) => (
          <Row key={k} title={l} checked={v === k} onClick={() => useSettings.getState().set('audiobookSpeed', k)} />
        ))}
      </Section>
    </Page>
  );
}

// ---------------------------------------------------------------- Videos / Photos / Fitness / Radio

function VideoSettings() {
  const d = useNanoData();
  return (
    <Page grouped>
      <Section header="Start Playing">
        <Row title="Where Left Off" checked={d.videoResume} onClick={() => d.set('videoResume', true)} />
        <Row title="From Beginning" checked={!d.videoResume} onClick={() => d.set('videoResume', false)} />
      </Section>
      <Section footer="Turns the iPod sideways on the stage when a video plays.">
        <Row title="Closed Captioning" right={<Switch on={d.captions} onChange={(v) => d.set('captions', v)} />} />
        <Row title="Rotate for Video" right={<Switch on={d.turnForVideo} onChange={(v) => d.set('turnForVideo', v)} />} />
      </Section>
    </Page>
  );
}

function PhotoSettings() {
  const d = useNanoData();
  return (
    <Page grouped>
      <Section header="Slideshow">
        <Row title="Time Per Slide" detail={`${d.slideTime} Seconds`} />
      </Section>
      <Section>
        {[2, 3, 5, 10, 20].map((n) => (
          <Row key={n} title={`${n} Seconds`} checked={d.slideTime === n} onClick={() => d.set('slideTime', n)} />
        ))}
      </Section>
      <Section header="Transition">
        {(['dissolve', 'push', 'zoom', 'random'] as const).map((k) => (
          <Row key={k} title={k[0].toUpperCase() + k.slice(1)} checked={d.slideTransition === k} onClick={() => d.set('slideTransition', k)} />
        ))}
      </Section>
      <Section>
        <Row title="Repeat" right={<Switch on={d.slideRepeat} onChange={(v) => d.set('slideRepeat', v)} />} />
        <Row title="Shuffle" right={<Switch on={d.slideShuffle} onChange={(v) => d.set('slideShuffle', v)} />} />
      </Section>
    </Page>
  );
}

function FitnessSettings() {
  const d = useNanoData();
  return (
    <Page grouped>
      <Section footer="The pedometer counts your steps all day, even when the screen is off.">
        <Row title="Pedometer" right={<Switch on={d.pedometer} onChange={(v) => d.set('pedometer', v)} />} />
      </Section>
      <Section header="Daily Step Goal">
        {[5000, 7500, 10000, 12500, 15000].map((n) => (
          <Row key={n} title={n.toLocaleString()} checked={d.stepGoal === n} onClick={() => d.set('stepGoal', n)} />
        ))}
      </Section>
      <Section header="Personal Info">
        <Row title="Weight" detail={`${d.weightKg} kg`} right={<Stepper value={d.weightKg} min={30} max={200} onChange={(v) => d.set('weightKg', v)} />} />
        <Row title="Height" detail={`${d.heightCm} cm`} right={<Stepper value={d.heightCm} min={120} max={220} onChange={(v) => d.set('heightCm', v)} />} />
      </Section>
      <Section>
        <Row
          title="Clear Fitness Data"
          destructive
          center
          onClick={() =>
            nano.sheet([
              {
                label: 'Clear Fitness Data',
                destructive: true,
                onSelect: () => {
                  useNanoData.setState({ steps: {}, workouts: [] });
                  nano.toast('Fitness Data Cleared');
                },
              },
            ])
          }
        />
      </Section>
    </Page>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="n7-stepper" data-noswipe>
      <button onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <button onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

const REGIONS: [RadioRegion, string][] = [
  ['americas', 'Americas'],
  ['asia', 'Asia'],
  ['australia', 'Australia'],
  ['europe', 'Europe'],
  ['japan', 'Japan'],
];

function RadioSettings() {
  const d = useNanoData();
  return (
    <Page grouped>
      <Section header="Radio Region" footer="Sets the FM band and tuning step for your region.">
        {REGIONS.map(([k, l]) => (
          <Row key={k} title={l} checked={d.radioRegion === k} onClick={() => d.set('radioRegion', k)} />
        ))}
      </Section>
      <Section>
        <Row title="Clear Recent Stations" tinted center onClick={() => d.set('radioRecent', [])} />
      </Section>
    </Page>
  );
}

// ---------------------------------------------------------------- Bluetooth (UI only)

const BT_DEVICES = ['Beats Pill+', 'AirPods', 'JBL Flip 4', 'Polar H7 Heart Rate'];

function Bluetooth() {
  const on = useNanoData((s) => s.bluetooth);
  const dev = useNanoData((s) => s.btDevice);
  const [found, setFound] = useState(0);
  const [connecting, setConnecting] = useState<string | null>(null);
  useEffect(() => {
    if (!on) {
      setFound(0);
      return;
    }
    const iv = window.setInterval(() => setFound((n) => Math.min(BT_DEVICES.length, n + 1)), 1400);
    return () => window.clearInterval(iv);
  }, [on]);
  const list = BT_DEVICES.slice(0, found);
  if (dev && !list.includes(dev)) list.unshift(dev);
  return (
    <Page grouped>
      <Section footer={on ? 'Now discoverable as “iPod”.' : undefined}>
        <Row
          title="Bluetooth"
          right={
            <Switch
              on={on}
              onChange={(v) => {
                useNanoData.getState().set('bluetooth', v);
                if (!v) useNanoData.getState().set('btDevice', null);
              }}
            />
          }
        />
      </Section>
      {on && (
        <Section header={<span className="n7-bt-head">Devices {found < BT_DEVICES.length && <span className="n7-spinner-sm" />}</span>}>
          {list.map((n) => (
            <Row
              key={n}
              title={n}
              detail={connecting === n ? 'Connecting…' : dev === n ? 'Connected' : 'Not Paired'}
              onClick={() => {
                if (dev === n) {
                  useNanoData.getState().set('btDevice', null);
                  return;
                }
                setConnecting(n);
                window.setTimeout(() => {
                  setConnecting(null);
                  useNanoData.getState().set('btDevice', n);
                  nano.toast(`Connected to ${n}`);
                }, 1500);
              }}
            />
          ))}
          {list.length === 0 && <Row title="Searching…" disabled />}
        </Section>
      )}
    </Page>
  );
}

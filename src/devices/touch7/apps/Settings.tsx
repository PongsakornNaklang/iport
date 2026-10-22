/**
 * Settings (iOS 15.7 on iPod touch 7th generation). Real switches where the
 * simulator has the feature (Wi-Fi, Bluetooth, Airplane Mode, appearance,
 * wallpaper, brightness, auto-lock, passcode, sounds, Music EQ / Sound Check /
 * Volume Limit, 24-hour time, battery percentage…), plausible pages elsewhere.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useCustomize } from '../../../core/customize/store';
import { useLibrary } from '../../../core/library/store';
import { songs, VIDEO_TYPES } from '../../../core/library/selectors';
import { EQ_PRESET_NAMES } from '../../../core/player/eq';
import { player } from '../../../core/player/player';
import { useSettings } from '../../../core/settings/store';
import { playTap } from '../../../core/sound/click';
import { formatBytes } from '../../../core/util/format';
import { useBattery } from '../../../core/util/hooks';
import { isTypingTarget } from '../../../shell/keyboard';
import { APPS } from './registry';
import { Glyph } from '../os/glyphs';
import { AppIcon } from '../os/icons';
import { DEFAULT_LAYOUT, os, usePrefs } from '../os/store';
import { Cell, IconTile, NavStack, Page, SearchField, Section, Sheet, Slider, Switch, TextInput, useNav, type NavApi } from '../os/ui';
import { Wallpaper, WALLPAPERS } from '../os/wallpapers';
import { useIntent } from './shared';


function useOpt<T extends string | boolean>(key: string, fallback: T): [T, (v: T) => void] {
  const v = useCustomize((s) => s.appearances[s.modelId]?.options?.[key]) as T | undefined;
  return [v ?? fallback, (x: T) => useCustomize.getState().setOption(key, x)];
}

/** a cell that pushes a page */
function Nav({ glyph, color, app, title, detail, page, pageTitle }: { glyph?: string; color?: string; app?: string; title: string; detail?: ReactNode; page: () => ReactNode; pageTitle?: string }) {
  const nav = useNav()!;
  return (
    <Cell
      icon={app ? <AppIcon id={app} size={29} /> : glyph ? <IconTile glyph={glyph} bg={color ?? '#8e8e93'} /> : undefined}
      title={title}
      detail={detail}
      chevron
      onPress={() => nav.push(page(), pageTitle ?? title)}
    />
  );
}

function Toggle({ title, on, onChange, glyph, color, sub }: { title: string; on: boolean; onChange: (v: boolean) => void; glyph?: string; color?: string; sub?: string }) {
  return <Cell icon={glyph ? <IconTile glyph={glyph} bg={color ?? '#8e8e93'} /> : undefined} title={title} subtitle={sub} accessory={<Switch on={on} onChange={onChange} />} />;
}

/** local-only switch for cosmetic settings */
function Fake({ title, init = false, sub }: { title: string; init?: boolean; sub?: string }) {
  const [on, setOn] = useState(init);
  return <Toggle title={title} on={on} onChange={setOn} sub={sub} />;
}

function Choice<T extends string | number>({ items, value, onChange }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <>
      {items.map((it) => (
        <Cell key={String(it.id)} title={it.label} check={value === it.id} onPress={() => onChange(it.id)} />
      ))}
    </>
  );
}

// ------------------------------------------------------------------ root

export default function Settings() {
  const [api, setApi] = useState<NavApi | null>(null);
  useIntent((d) => {
    if (!api) return;
    api.popToRoot();
    window.setTimeout(() => {
      if (d === 'wifi') api.push(<WifiPage />, 'Wi-Fi');
      if (d === 'wallpaper') api.push(<WallpaperPage />, 'Wallpaper');
      if (d === 'passcode') api.push(<PasscodePage />, 'Passcode');
    }, 60);
  });
  return (
    <div className="t7s-root">
      <NavStack root={<Root />} rootTitle="Settings" onApi={setApi} />
    </div>
  );
}

function Root() {
  const airplane = usePrefs((s) => s.airplane);
  const wifi = usePrefs((s) => s.wifi);
  const bt = usePrefs((s) => s.bluetooth);
  const owner = useCustomize((s) => s.appearances[s.modelId]?.engraving?.[0]);
  const [q, setQ] = useState('');
  const name = owner?.trim() || 'iPod Owner';
  const setAirplane = (v: boolean) => {
    const p = usePrefs.getState();
    p.set('airplane', v);
    if (v) {
      p.set('wifi', false);
      p.set('bluetooth', false);
    }
  };
  const all: { title: string; node: () => ReactNode; glyph?: string; color?: string; app?: string }[] = useMemo(
    () => [
      { title: 'Wi-Fi', node: () => <WifiPage />, glyph: 'wifi', color: '#007aff' },
      { title: 'Bluetooth', node: () => <BluetoothPage />, glyph: 'bluetooth', color: '#007aff' },
      { title: 'Notifications', node: () => <NotificationsPage />, glyph: 'bell.badge.fill', color: '#ff3b30' },
      { title: 'Sounds', node: () => <SoundsPage />, glyph: 'speaker.wave.3.fill', color: '#ff2d55' },
      { title: 'Focus', node: () => <FocusPage />, glyph: 'moon.fill', color: '#5856d6' },
      { title: 'Screen Time', node: () => <ScreenTimePage />, glyph: 'hourglass', color: '#5856d6' },
      { title: 'General', node: () => <GeneralPage />, glyph: 'gearshape', color: '#8e8e93' },
      { title: 'Control Center', node: () => <ControlCenterPage />, glyph: 'switch.2', color: '#8e8e93' },
      { title: 'Display & Brightness', node: () => <DisplayPage />, glyph: 'textformat.size', color: '#007aff' },
      { title: 'Home Screen', node: () => <HomeScreenPage />, glyph: 'square.grid.2x2.fill', color: '#5856d6' },
      { title: 'Accessibility', node: () => <AccessibilityPage />, glyph: 'figure.stand', color: '#007aff' },
      { title: 'Wallpaper', node: () => <WallpaperPage />, glyph: 'sparkles', color: '#34aadc' },
      { title: 'Siri & Search', node: () => <SiriPage />, glyph: 'siri', color: '#000' },
      { title: 'Passcode', node: () => <PasscodePage />, glyph: 'lock.fill', color: '#ff3b30' },
      { title: 'Battery', node: () => <BatteryPage />, glyph: 'battery.100', color: '#34c759' },
      { title: 'Privacy', node: () => <PrivacyPage />, glyph: 'hand.raised.fill', color: '#007aff' },
      { title: 'Music', node: () => <MusicPage />, app: 'music' },
      { title: 'TV', node: () => <TvPage />, app: 'tv' },
      { title: 'Photos', node: () => <PhotosPage />, app: 'photos' },
      { title: 'Camera', node: () => <CameraPage />, app: 'camera' },
      { title: 'Podcasts', node: () => <AppPage app="podcasts" />, app: 'podcasts' },
      { title: 'Safari', node: () => <AppPage app="safari" />, app: 'safari' },
      { title: 'Notes', node: () => <AppPage app="notes" />, app: 'notes' },
      { title: 'Weather', node: () => <WeatherPage />, app: 'weather' },
      { title: 'Clock', node: () => <AppPage app="clock" />, app: 'clock' },
    ],
    [],
  );
  const nav = useNav()!;
  if (q.trim()) {
    const hits = all.filter((x) => x.title.toLowerCase().includes(q.trim().toLowerCase()));
    return (
      <Page title="Settings" bg="grouped" search={<SearchField value={q} onChange={setQ} />}>
        <Section>
          {hits.map((h) => (
            <Cell key={h.title} icon={h.app ? <AppIcon id={h.app} size={29} /> : <IconTile glyph={h.glyph!} bg={h.color!} />} title={h.title} chevron onPress={() => nav.push(h.node(), h.title)} />
          ))}
          {!hits.length && <Cell title="No Results" />}
        </Section>
      </Page>
    );
  }
  const n = (t: string) => all.find((x) => x.title === t)!;
  const row = (t: string, detail?: ReactNode) => {
    const x = n(t);
    return <Nav key={t} title={t} glyph={x.glyph} color={x.color} app={x.app} detail={detail} page={x.node} />;
  };
  return (
    <Page title="Settings" bg="grouped" search={<SearchField value={q} onChange={setQ} />}>
      <Section>
        <Cell
          className="t7s-profile"
          icon={<span className="t7a-circle t7s-avatar">{name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>}
          title={name}
          subtitle="Apple ID, iCloud, Media & Purchases"
          chevron
          onPress={() => nav.push(<AppleIdPage name={name} />, 'Apple ID')}
        />
      </Section>
      <Section>
        <Toggle title="Airplane Mode" glyph="airplane" color="#ff9500" on={airplane} onChange={setAirplane} />
        {row('Wi-Fi', wifi ? 'iPort' : 'Off')}
        {row('Bluetooth', bt ? 'On' : 'Off')}
      </Section>
      <Section>{['Notifications', 'Sounds', 'Focus', 'Screen Time'].map((t) => row(t))}</Section>
      <Section>{['General', 'Control Center', 'Display & Brightness', 'Home Screen', 'Accessibility', 'Wallpaper', 'Siri & Search', 'Passcode', 'Battery', 'Privacy'].map((t) => row(t))}</Section>
      <Section>
        <Nav app="appstore" title="App Store" page={() => <AppPage app="appstore" />} />
      </Section>
      <Section>
        <Nav glyph="key.fill" color="#8e8e93" title="Passwords" page={() => <PasswordsPage />} />
      </Section>
      <Section>{['Music', 'TV', 'Photos', 'Camera', 'Podcasts', 'Safari', 'Notes', 'Weather', 'Clock'].map((t) => row(t))}</Section>
    </Page>
  );
}

// ------------------------------------------------------------------ profile, connectivity

function AppleIdPage({ name }: { name: string }) {
  return (
    <Page title="Apple ID" large={false} bg="grouped">
      <div className="t7s-idhead">
        <span className="t7a-circle t7s-avatar big">{name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
        <div className="t7s-idname">{name}</div>
        <div className="t7s-idmail">Not signed in to iCloud</div>
      </div>
      <Section>
        <Cell title="Name, Phone Numbers, Email" chevron />
        <Cell title="Password & Security" chevron />
        <Cell title="Payment & Shipping" detail="None" chevron />
      </Section>
      <Section>
        <Cell icon={<IconTile glyph="cloud.fill" bg="#3b9bf6" />} title="iCloud" detail="Off" chevron />
        <Cell icon={<AppIcon id="appstore" size={29} />} title="Media & Purchases" chevron />
        <Cell icon={<AppIcon id="findmy" size={29} />} title="Find My" chevron />
      </Section>
      <Section footer="Everything on this iPod is stored in your browser on this computer.">
        <Cell title="Sign In" tint center onPress={() => os.toast('iPort keeps everything on this device', 'icloud')} />
      </Section>
    </Page>
  );
}

function WifiPage() {
  const wifi = usePrefs((s) => s.wifi);
  const set = usePrefs((s) => s.set);
  const online = typeof navigator === 'undefined' || navigator.onLine;
  return (
    <Page title="Wi-Fi" large={false} bg="grouped">
      <Section>
        <Toggle
          title="Wi-Fi"
          on={wifi}
          onChange={(v) => {
            set('wifi', v);
            if (v) set('airplane', false);
          }}
        />
        {wifi && <Cell title={<span className="t7s-net">iPort</span>} subtitle={online ? undefined : 'No Internet Connection'} icon={<Glyph name="checkmark" size={16} className="t7s-tick" />} accessory={<span className="t7s-netg"><Glyph name="lock.fill" size={12} /><Glyph name="wifi" size={16} /><Glyph name="info.circle" size={20} className="t7s-info" /></span>} />}
      </Section>
      {wifi && (
        <Section header="Networks">
          {['Bangkok Café', 'HOME-5G', 'Studio Guest'].map((n) => (
            <Cell key={n} title={n} accessory={<span className="t7s-netg"><Glyph name="lock.fill" size={12} /><Glyph name="wifi" size={16} /><Glyph name="info.circle" size={20} className="t7s-info" /></span>} onPress={() => os.alert({ title: `Enter the password for “${n}”`, input: { placeholder: 'Password' }, actions: [{ label: 'Cancel', style: 'cancel' }, { label: 'Join', onPress: () => os.toast('Incorrect password', 'wifi') }] })} />
          ))}
          <Cell title="Other…" />
        </Section>
      )}
      <Section footer="Known networks will be joined automatically. If no known networks are available, you will be notified of available networks.">
        <Cell title="Ask to Join Networks" detail="Notify" chevron />
      </Section>
    </Page>
  );
}

function BluetoothPage() {
  const bt = usePrefs((s) => s.bluetooth);
  const set = usePrefs((s) => s.set);
  return (
    <Page title="Bluetooth" large={false} bg="grouped">
      <Section footer={bt ? `Now discoverable as “${usePrefs.getState().deviceName}”.` : 'AirDrop, AirPlay, Find My and Location Services use Bluetooth.'}>
        <Toggle
          title="Bluetooth"
          on={bt}
          onChange={(v) => {
            set('bluetooth', v);
            if (v) set('airplane', false);
          }}
        />
      </Section>
      {bt && (
        <>
          <Section header="My Devices">
            <Cell title="AirPods Pro" detail="Not Connected" accessory={<Glyph name="info.circle" size={20} className="t7s-info" />} />
          </Section>
          <Section header={<span className="t7s-searching">Other Devices <span className="t7-spinner t7s-spin" /></span>} />
        </>
      )}
    </Page>
  );
}

// ------------------------------------------------------------------ notifications, sounds, focus, screen time

function NotificationsPage() {
  const nav = useNav()!;
  const apps = ['calendar', 'clock', 'facetime', 'findmy', 'home', 'mail', 'messages', 'music', 'podcasts', 'reminders', 'tips', 'tv', 'voicememos', 'weather'];
  return (
    <Page title="Notifications" large={false} bg="grouped">
      <Section>
        <Cell title="Scheduled Summary" detail="Off" chevron />
        <Cell title="Show Previews" detail="Always" chevron />
        <Cell title="Screen Sharing" detail="Notifications Off" chevron />
      </Section>
      <Section header="Siri">
        <Cell title="Siri Suggestions" chevron />
      </Section>
      <Section header="Notification Style">
        {apps.map((a) => (
          <Cell
            key={a}
            icon={<AppIcon id={a} size={29} />}
            title={APPS[a]?.name ?? a}
            subtitle="Banners, Sounds, Badges"
            chevron
            onPress={() =>
              nav.push(
                <Page title={APPS[a]?.name ?? a} large={false} bg="grouped">
                  <Section>
                    <Fake title="Allow Notifications" init />
                  </Section>
                  <Section header="Alerts">
                    <Fake title="Lock Screen" init />
                    <Fake title="Notification Center" init />
                    <Fake title="Banners" init />
                  </Section>
                  <Section>
                    <Fake title="Sounds" init />
                    <Fake title="Badges" init />
                  </Section>
                </Page>,
                APPS[a]?.name ?? a,
              )
            }
          />
        ))}
      </Section>
    </Page>
  );
}

function SoundsPage() {
  const vol = useSettings((s) => s.volume);
  const clicks = usePrefs((s) => s.keyboardClicks);
  const lock = usePrefs((s) => s.lockSound);
  const set = usePrefs((s) => s.set);
  return (
    <Page title="Sounds" large={false} bg="grouped">
      <Section header="Headphone Audio">
        <Cell title="Headphone Safety" chevron />
      </Section>
      <Section header="Ringer and Alerts" footer="The volume of the ringer and alerts can be adjusted using the volume buttons.">
        <div className="t7s-slider">
          <Slider value={vol} onChange={(v) => player.setVolume(v)} minGlyph="speaker.fill" maxGlyph="speaker.wave.3.fill" />
        </div>
        <Fake title="Change with Buttons" init />
      </Section>
      <Section header="Sounds">
        <Cell title="Ringtone" detail="Reflection" chevron />
        <Cell title="Text Tone" detail="Note" chevron />
        <Cell title="New Mail" detail="None" chevron />
        <Cell title="Calendar Alerts" detail="Chord" chevron />
        <Cell title="Reminder Alerts" detail="Chord" chevron />
      </Section>
      <Section>
        <Toggle title="Keyboard Clicks" on={clicks} onChange={(v) => set('keyboardClicks', v)} />
        <Toggle title="Lock Sound" on={lock} onChange={(v) => set('lockSound', v)} />
      </Section>
    </Page>
  );
}

function FocusPage() {
  const focus = usePrefs((s) => s.focus);
  const set = usePrefs((s) => s.set);
  return (
    <Page title="Focus" large={false} bg="grouped">
      <Section footer="Focus lets you customize your device and silence calls and notifications. Turn it on and off in Control Center.">
        <Cell icon={<IconTile glyph="moon.fill" bg="#5856d6" />} title="Do Not Disturb" accessory={<Switch on={focus} onChange={(v) => set('focus', v)} />} />
        <Cell icon={<IconTile glyph="person.fill" bg="#af52de" />} title="Personal" detail="Set Up" chevron />
        <Cell icon={<IconTile glyph="bed.double.fill" bg="#30b0c7" />} title="Sleep" detail="Set Up" chevron />
        <Cell icon={<IconTile glyph="person.crop.square" bg="#00b7a8" />} title="Work" detail="Set Up" chevron />
      </Section>
      <Section footer="Focus is shared across devices, and turning one on for this device will turn it on for all of them.">
        <Fake title="Share Across Devices" init />
        <Cell title="Focus Status" detail="On" chevron />
      </Section>
    </Page>
  );
}

function ScreenTimePage() {
  return (
    <Page title="Screen Time" large={false} bg="grouped">
      <div className="t7s-hero">
        <IconTile glyph="hourglass" bg="#5856d6" size={64} />
        <b>Screen Time</b>
        <span>Get weekly reports with insights into your screen time and set time limits for apps you want to manage.</span>
      </div>
      <Section>
        <Cell title="Turn On Screen Time" tint center onPress={() => os.toast('Screen Time is On', 'hourglass')} />
      </Section>
    </Page>
  );
}

// ------------------------------------------------------------------ General

function GeneralPage() {
  return (
    <Page title="General" large={false} bg="grouped">
      <Section>
        <Nav title="About" page={() => <AboutPage />} />
        <Nav title="Software Update" page={() => <UpdatePage />} />
      </Section>
      <Section>
        <Nav title="AirDrop" detail="Receiving Off" page={() => <ChoicePage title="AirDrop" items={['Receiving Off', 'Contacts Only', 'Everyone for 10 Minutes']} />} />
        <Nav title="AirPlay & Handoff" page={() => <SimplePage title="AirPlay & Handoff" toggles={['Handoff']} />} />
        <Nav title="Picture in Picture" page={() => <SimplePage title="Picture in Picture" toggles={['Start PiP Automatically']} />} />
      </Section>
      <Section>
        <Nav title="iPod Storage" page={() => <StoragePage />} />
        <Nav title="Background App Refresh" detail="On" page={() => <SimplePage title="Background App Refresh" toggles={['Background App Refresh']} />} />
      </Section>
      <Section>
        <Nav title="Date & Time" page={() => <DateTimePage />} />
        <Nav title="Keyboard" page={() => <SimplePage title="Keyboards" toggles={['Auto-Capitalization', 'Auto-Correction', 'Check Spelling', 'Enable Caps Lock', 'Predictive', '“.” Shortcut']} />} />
        <Nav title="Fonts" page={() => <SimplePage title="Fonts" text="No fonts installed." />} />
        <Nav title="Language & Region" page={() => <LanguagePage />} />
        <Nav title="Dictionary" page={() => <SimplePage title="Dictionary" text="English · Thai · Japanese" />} />
      </Section>
      <Section>
        <Nav title="VPN & Device Management" detail="Not Connected" page={() => <SimplePage title="VPN & Device Management" text="No configuration installed." />} />
      </Section>
      <Section>
        <Nav title="Legal & Regulatory" page={() => <SimplePage title="Legal & Regulatory" text="iPort is a fan-made simulator and is not affiliated with Apple Inc. iPod, iOS and the Apple logo are trademarks of Apple Inc." />} />
      </Section>
      <Section>
        <Nav title="Transfer or Reset iPod" page={() => <ResetPage />} />
        <Cell title="Shut Down" tint onPress={() => os.sleep()} />
      </Section>
    </Page>
  );
}

function AboutPage() {
  const tracks = useLibrary((s) => s.tracks);
  const photos = useLibrary((s) => s.photos.length);
  const deviceName = usePrefs((s) => s.deviceName);
  const [usage, setUsage] = useState<number | null>(null);
  useEffect(() => {
    void navigator.storage?.estimate?.().then((e) => setUsage(e.usage ?? 0)).catch(() => {});
  }, []);
  const all = Object.values(tracks);
  const nSongs = songs(tracks).length;
  const nVideos = all.filter((t) => VIDEO_TYPES.includes(t.mediaType)).length;
  const CAP = 128e9;
  const nav = useNav()!;
  return (
    <Page title="About" large={false} bg="grouped">
      <Section>
        <Cell
          title="Name"
          detail={deviceName}
          chevron
          onPress={() =>
            nav.push(
              <Page title="Name" large={false} bg="grouped">
                <Section>
                  <div className="t7cal-in">
                    <TextInput value={usePrefs.getState().deviceName} onChange={(v) => usePrefs.getState().set('deviceName', v || 'iPod')} autoFocus />
                  </div>
                </Section>
              </Page>,
              'Name',
            )
          }
        />
        <Cell title="Software Version" detail="15.7" />
        <Cell title="Model Name" detail="iPod touch (7th generation)" />
        <Cell title="Model Number" detail="MVJ62LL/A" />
        <Cell title="Serial Number" detail="F4KZ71P2N7KL" />
      </Section>
      <Section>
        <Cell title="Songs" detail={nSongs.toLocaleString()} />
        <Cell title="Videos" detail={nVideos.toLocaleString()} />
        <Cell title="Photos" detail={photos.toLocaleString()} />
        <Cell title="Applications" detail={String(Object.keys(APPS).length)} />
        <Cell title="Capacity" detail="128 GB" />
        <Cell title="Available" detail={usage == null ? '—' : formatBytes(Math.max(0, CAP - usage)).replace('.0 ', ' ')} />
      </Section>
      <Section>
        <Cell title="Wi-Fi Address" detail="F0:C3:71:2A:9B:4E" />
        <Cell title="Bluetooth" detail="F0:C3:71:2A:9B:4F" />
        <Cell title="SEID" chevron />
      </Section>
      <Section>
        <Cell title="Certificate Trust Settings" chevron />
      </Section>
    </Page>
  );
}

function UpdatePage() {
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setChecking(false), 1400);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <Page title="Software Update" large={false} bg="grouped">
      <Section>
        <Cell title="Automatic Updates" detail="Off" chevron />
      </Section>
      <div className="t7s-update">
        {checking ? (
          <>
            <span className="t7-spinner t7s-spin" />
            <span>Checking for Update…</span>
          </>
        ) : (
          <>
            <b>iOS 15.7</b>
            <span>iOS is up to date</span>
          </>
        )}
      </div>
    </Page>
  );
}

function StoragePage() {
  const tracks = useLibrary((s) => s.tracks);
  const photos = useLibrary((s) => s.photos.length);
  const memos = useLibrary((s) => s.voiceMemos.length);
  const [usage, setUsage] = useState(0);
  useEffect(() => {
    void navigator.storage?.estimate?.().then((e) => setUsage(e.usage ?? 0)).catch(() => {});
  }, []);
  const local = Object.values(tracks).filter((t) => t.source === 'local').length;
  const sys = 9.4e9;
  const apps = 2.1e9;
  const total = 128e9;
  const used = sys + apps + usage;
  const seg = (v: number) => `${Math.max(0.6, (v / total) * 100)}%`;
  return (
    <Page title="iPod Storage" large={false} bg="grouped">
      <Section>
        <div className="t7s-storage">
          <div className="t7s-st-top">
            <span>iPod</span>
            <span>
              {formatBytes(used)} of {formatBytes(total)} Used
            </span>
          </div>
          <div className="t7s-st-bar">
            <i style={{ width: seg(usage * 0.8), background: '#ff3b30' }} />
            <i style={{ width: seg(usage * 0.2), background: '#ffcc00' }} />
            <i style={{ width: seg(apps), background: '#34c759' }} />
            <i style={{ width: seg(sys), background: '#8e8e93' }} />
          </div>
          <div className="t7s-st-legend">
            <span><i style={{ background: '#ff3b30' }} />Media</span>
            <span><i style={{ background: '#ffcc00' }} />Photos</span>
            <span><i style={{ background: '#34c759' }} />Apps</span>
            <span><i style={{ background: '#8e8e93' }} />iOS</span>
          </div>
        </div>
      </Section>
      <Section>
        <Cell icon={<AppIcon id="music" size={29} />} title="Music" subtitle={`${local} downloaded songs`} detail={formatBytes(usage * 0.8)} />
        <Cell icon={<AppIcon id="photos" size={29} />} title="Photos" subtitle={`${photos} photos`} detail={formatBytes(usage * 0.2)} />
        <Cell icon={<AppIcon id="voicememos" size={29} />} title="Voice Memos" subtitle={`${memos} recordings`} detail={memos ? '—' : 'Zero KB'} />
        <Cell icon={<AppIcon id="settings" size={29} />} title="iOS" detail="9.4 GB" />
      </Section>
    </Page>
  );
}

function DateTimePage() {
  const use24h = useSettings((s) => s.use24h);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <Page title="Date & Time" large={false} bg="grouped">
      <Section>
        <Toggle title="24-Hour Time" on={use24h} onChange={(v) => useSettings.getState().set('use24h', v)} />
      </Section>
      <Section>
        <Toggle title="Set Automatically" on onChange={() => os.toast('Time is set by your computer', 'clock')} />
        <Cell title="Time Zone" detail={tz.split('/').pop()?.replace(/_/g, ' ')} />
      </Section>
    </Page>
  );
}

function LanguagePage() {
  return (
    <Page title="Language & Region" large={false} bg="grouped">
      <Section>
        <Cell title="iPod Language" detail="English" chevron />
      </Section>
      <Section header="Preferred Language Order">
        <Cell title="English" subtitle="iPod Language" />
        <Cell title="Add Language…" tint />
      </Section>
      <Section>
        <Cell title="Region" detail="Thailand" chevron />
        <Cell title="Calendar" detail="Gregorian" chevron />
        <Cell title="Temperature Unit" detail={usePrefs.getState().weatherUnit === 'F' ? '°F' : '°C'} chevron />
      </Section>
    </Page>
  );
}

function ResetPage() {
  const nav = useNav()!;
  const confirm = (title: string, msg: string, label: string, run: () => void) =>
    os.alert({ sheet: true, title, message: msg, actions: [{ label, style: 'destructive', onPress: run }, { label: 'Cancel', style: 'cancel' }] });
  return (
    <Page title="Transfer or Reset iPod" large={false} bg="grouped">
      <div className="t7s-hero">
        <IconTile glyph="iphone" bg="#8e8e93" size={64} />
        <b>Prepare for New iPod</b>
        <span>Make sure everything’s ready to transfer to a new iPod.</span>
      </div>
      <Section>
        <Cell title="Reset Home Screen Layout" tint onPress={() => confirm('Reset Home Screen', 'This will reset your Home Screen to the factory default layout.', 'Reset Home Screen', () => usePrefs.getState().set('layout', DEFAULT_LAYOUT))} />
        <Cell
          title="Reset All Settings"
          tint
          onPress={() =>
            confirm('Reset All Settings', 'This will reset all settings. No data or media will be deleted.', 'Reset All Settings', () => {
              useSettings.getState().reset();
              os.toast('Settings Reset', 'arrow.clockwise');
            })
          }
        />
      </Section>
      <Section>
        <Cell
          title="Erase All Content and Settings"
          destructive
          onPress={() =>
            confirm('Erase iPod?', 'This will delete all music, photos, notes, recordings and other data stored in this browser.', 'Erase iPod', () => {
              player.stop();
              void useLibrary.getState().resetLibrary();
              useSettings.getState().reset();
              nav.popToRoot();
              os.sleep();
            })
          }
        />
      </Section>
    </Page>
  );
}

// ------------------------------------------------------------------ display, wallpaper, home, CC, accessibility

function DisplayPage() {
  const [dark, setDark] = useOpt<boolean>('darkMode', false);
  const brightness = useSettings((s) => s.brightness);
  const autoLock = usePrefs((s) => s.autoLock);
  const nav = useNav()!;
  return (
    <Page title="Display & Brightness" large={false} bg="grouped">
      <Section header="Appearance">
        <div className="t7s-appear">
          {[false, true].map((d) => (
            <button key={String(d)} onClick={() => setDark(d)}>
              <span className={`t7s-mock ${d ? 'dark' : ''}`}>
                <span className="t">9:41</span>
                <i />
                <i />
                <i />
              </span>
              <span className="l">{d ? 'Dark' : 'Light'}</span>
              <span className={`r ${dark === d ? 'on' : ''}`}>{dark === d && <Glyph name="checkmark" size={12} />}</span>
            </button>
          ))}
        </div>
        <Fake title="Automatic" />
      </Section>
      <Section header="Brightness">
        <div className="t7s-slider">
          <Slider value={brightness} onChange={(v) => useSettings.getState().set('brightness', Math.max(0.05, v))} minGlyph="sun.min.fill" maxGlyph="sun.max.fill" />
        </div>
        <Fake title="True Tone" init sub="Automatically adapt iPod display based on ambient lighting conditions." />
      </Section>
      <Section>
        <Cell title="Night Shift" detail="Off" chevron />
        <Cell
          title="Auto-Lock"
          detail={autoLock ? `${autoLock} Minute${autoLock === 1 ? '' : 's'}` : 'Never'}
          chevron
          onPress={() => nav.push(<AutoLockPage />, 'Auto-Lock')}
        />
      </Section>
      <Section>
        <Cell title="Text Size" chevron />
        <Fake title="Bold Text" />
      </Section>
      <Section header="Display Zoom" footer="Choose a view for iPod. Larger Text shows larger controls. Standard shows more content.">
        <Cell title="View" detail="Standard" chevron />
      </Section>
    </Page>
  );
}

function AutoLockPage() {
  const v = usePrefs((s) => s.autoLock);
  return (
    <Page title="Auto-Lock" large={false} bg="grouped">
      <Section>
        <Choice
          items={[
            { id: 1, label: '1 Minute' },
            { id: 2, label: '2 Minutes' },
            { id: 3, label: '3 Minutes' },
            { id: 4, label: '4 Minutes' },
            { id: 5, label: '5 Minutes' },
            { id: 0, label: 'Never' },
          ]}
          value={v}
          onChange={(x) => usePrefs.getState().set('autoLock', x)}
        />
      </Section>
    </Page>
  );
}

function WallpaperPage() {
  const nav = useNav()!;
  const [wall] = useOpt<string>('wallpaper', 'ios15');
  const [dark] = useOpt<boolean>('darkMode', false);
  return (
    <Page title="Wallpaper" large={false} bg="grouped">
      <Section>
        <Cell title="Choose a New Wallpaper" tint chevron onPress={() => nav.push(<WallpaperGrid />, 'Choose')} />
        <div className="t7s-wallprev">
          <div className="t7s-wp">
            <Wallpaper id={wall} dark={dark} />
            <span className="lock">9:41</span>
          </div>
          <div className="t7s-wp">
            <Wallpaper id={wall} dark={dark} />
            <span className="grid">
              {Array.from({ length: 16 }, (_, i) => (
                <i key={i} />
              ))}
            </span>
          </div>
        </div>
      </Section>
      <Section footer="Dark Appearance dims the wallpaper when Dark Mode is on.">
        <Cell title="Dark Appearance Dims Wallpaper" accessory={<Switch on onChange={() => {}} />} />
      </Section>
    </Page>
  );
}

function WallpaperGrid() {
  const [wall, setWall] = useOpt<string>('wallpaper', 'ios15');
  const [dark] = useOpt<boolean>('darkMode', false);
  return (
    <Page title="Choose" large={false} bg="grouped">
      <div className="t7s-wgrid">
        {WALLPAPERS.map((w) => (
          <button
            key={w.id}
            className={wall === w.id ? 'on' : ''}
            onClick={() => {
              setWall(w.id);
              os.toast('Wallpaper Set', 'checkmark');
            }}
          >
            <span className="t7s-wtile">
              <Wallpaper id={w.id} dark={dark} />
            </span>
            <span className="n">{w.name}</span>
          </button>
        ))}
      </div>
    </Page>
  );
}

function HomeScreenPage() {
  const [v, setV] = useState<'home' | 'library'>('home');
  return (
    <Page title="Home Screen" large={false} bg="grouped">
      <Section header="Newly Downloaded Apps">
        <Choice items={[{ id: 'home', label: 'Add to Home Screen' }, { id: 'library', label: 'App Library Only' }]} value={v} onChange={setV} />
      </Section>
      <Section header="Notification Badges">
        <Fake title="Show in App Library" />
      </Section>
      <Section footer="Restores the default layout of your Home Screen.">
        <Cell title="Reset Home Screen Layout" tint onPress={() => usePrefs.getState().set('layout', DEFAULT_LAYOUT)} />
      </Section>
    </Page>
  );
}

function ControlCenterPage() {
  // no Flashlight: the iPod touch has no flash
  const inc = ['Timer', 'Calculator', 'Camera', 'Alarm', 'Stopwatch', 'Notes', 'Voice Memos', 'Dark Mode'];
  const more = ['Accessibility Shortcuts', 'Code Scanner', 'Guided Access', 'Hearing', 'Low Power Mode', 'Magnifier', 'Quick Note', 'Screen Recording', 'Text Size'];
  return (
    <Page title="Control Center" large={false} bg="grouped">
      <Section footer="Swipe up from the bottom edge to open Control Center.">
        <Fake title="Access Within Apps" init />
        <Fake title="Show Home Controls" init />
      </Section>
      <Section header="Included Controls">
        {inc.map((c) => (
          <Cell key={c} icon={<Glyph name="minus.circle.fill" size={22} className="t7s-red" />} title={c} />
        ))}
      </Section>
      <Section header="More Controls">
        {more.map((c) => (
          <Cell key={c} icon={<Glyph name="plus.circle.fill" size={22} className="t7s-green" />} title={c} />
        ))}
      </Section>
    </Page>
  );
}

function AccessibilityPage() {
  return (
    <Page title="Accessibility" large={false} bg="grouped">
      <Section header="Vision">
        <Cell icon={<IconTile glyph="figure.stand" bg="#007aff" />} title="VoiceOver" detail="Off" chevron />
        <Cell icon={<IconTile glyph="magnifyingglass" bg="#007aff" />} title="Zoom" detail="Off" chevron />
        <Cell icon={<IconTile glyph="textformat.size" bg="#007aff" />} title="Display & Text Size" chevron />
        <Cell icon={<IconTile glyph="circle.lefthalf.filled" bg="#34c759" />} title="Motion" chevron />
        <Cell icon={<IconTile glyph="quote.bubble.fill" bg="#007aff" />} title="Spoken Content" chevron />
      </Section>
      <Section header="Physical and Motor">
        <Cell icon={<IconTile glyph="hand.raised.fill" bg="#007aff" />} title="Touch" chevron />
        <Cell icon={<IconTile glyph="house.fill" bg="#8e8e93" />} title="Home Button" chevron />
      </Section>
      <Section header="Hearing">
        <Cell icon={<IconTile glyph="speaker.wave.3.fill" bg="#007aff" />} title="Audio/Visual" chevron />
      </Section>
    </Page>
  );
}

function SiriPage() {
  return (
    <Page title="Siri & Search" large={false} bg="grouped">
      <Section header="Ask Siri" footer="Hold the Home button (or the H key) to talk to Siri. Typing works when speech recognition isn’t available.">
        <Fake title="Listen for “Hey Siri”" />
        <Fake title="Press Home for Siri" init />
        <Fake title="Allow Siri When Locked" init />
        <Cell title="Language" detail="English (United States)" chevron />
        <Cell title="Siri Voice" detail="American (Voice 4)" chevron />
      </Section>
      <Section header="Content from Apple">
        <Fake title="Show in Look Up" init />
        <Fake title="Show in Spotlight" init />
      </Section>
    </Page>
  );
}

function BatteryPage() {
  const pct = usePrefs((s) => s.batteryPercent);
  const b = useBattery();
  const bars = useMemo(() => Array.from({ length: 24 }, (_, i) => 30 + ((i * 37) % 60)), []);
  return (
    <Page title="Battery" large={false} bg="grouped">
      <Section>
        <Toggle title="Battery Percentage" on={pct} onChange={(v) => usePrefs.getState().set('batteryPercent', v)} />
        <Fake title="Low Power Mode" sub="Low Power Mode temporarily reduces background activity until you can fully charge your iPod." />
      </Section>
      <Section header="Last 24 Hours">
        <div className="t7s-batt">
          <div className="t7s-batt-now">
            <b>{Math.round(b.level * 100)}%</b> {b.charging ? 'Charging' : 'Battery Level'}
          </div>
          <div className="t7s-batt-bars">
            {bars.map((h, i) => (
              <i key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </Section>
    </Page>
  );
}

function PrivacyPage() {
  const rows: [string, string, string][] = [
    ['Location Services', 'location.fill', '#007aff'],
    ['Tracking', 'hand.raised.fill', '#ff9500'],
    ['Contacts', 'person.crop.circle', '#8e8e93'],
    ['Calendars', 'calendar', '#ff3b30'],
    ['Reminders', 'list.bullet', '#ff9500'],
    ['Photos', 'photo', '#ff2d55'],
    ['Bluetooth', 'bluetooth', '#007aff'],
    ['Microphone', 'mic.fill', '#ff9500'],
    ['Camera', 'camera.fill', '#8e8e93'],
  ];
  return (
    <Page title="Privacy" large={false} bg="grouped">
      <Section>
        {rows.map(([t, g, c]) => (
          <Cell key={t} icon={<IconTile glyph={g} bg={c} />} title={t} detail={t === 'Location Services' ? 'On' : undefined} chevron />
        ))}
      </Section>
      <Section footer="As applications request access, they will be added in the categories above. In iPort, the browser asks you before an app can use the camera, microphone or location.">
        <Cell title="Analytics & Improvements" chevron />
        <Cell title="Apple Advertising" chevron />
      </Section>
    </Page>
  );
}

function PasswordsPage() {
  return (
    <Page title="Passwords" large={false} bg="grouped">
      <div className="t7s-hero">
        <IconTile glyph="key.fill" bg="#8e8e93" size={64} />
        <b>No Passwords</b>
        <span>Passwords you save in Safari and apps appear here.</span>
      </div>
    </Page>
  );
}

// ------------------------------------------------------------------ apps

function MusicPage() {
  const sc = useSettings((s) => s.soundCheck);
  const eq = useSettings((s) => s.eq);
  const limit = useSettings((s) => s.volumeLimit);
  const shuffle = useSettings((s) => s.shuffle);
  const nav = useNav()!;
  return (
    <Page title="Music" large={false} bg="grouped">
      <Section header="Allow Music to Access">
        <Cell icon={<IconTile glyph="magnifyingglass" bg="#8e8e93" />} title="Siri & Search" chevron />
      </Section>
      <Section>
        <Fake title="Show Apple Music" init />
        <Fake title="Add Playlist Songs" />
      </Section>
      <Section header="Audio">
        <Cell title="EQ" detail={eq} chevron onPress={() => nav.push(<EqPage />, 'EQ')} />
        <Cell title="Volume Limit" detail={limit >= 0.999 ? 'Off' : `${Math.round(limit * 100)}%`} chevron onPress={() => nav.push(<VolumeLimitPage />, 'Volume Limit')} />
        <Toggle title="Sound Check" on={sc} onChange={(v) => useSettings.getState().set('soundCheck', v)} />
      </Section>
      <Section header="Playback" footer="Shuffle and Repeat can also be changed on the Now Playing screen.">
        <Toggle title="Shuffle" on={shuffle !== 'off'} onChange={(v) => player.setShuffle(v ? 'songs' : 'off')} />
        <Cell title="Repeat" detail={useSettings.getState().repeat === 'one' ? 'One' : useSettings.getState().repeat === 'all' ? 'All' : 'Off'} chevron onPress={() => nav.push(<RepeatPage />, 'Repeat')} />
      </Section>
      <Section header="Library">
        <Fake title="Show Star Ratings" />
        <Fake title="Sync Library" />
      </Section>
    </Page>
  );
}

function EqPage() {
  const eq = useSettings((s) => s.eq);
  return (
    <Page title="EQ" large={false} bg="grouped">
      <Section>
        <Choice items={EQ_PRESET_NAMES.filter((n) => n !== 'Flat').map((n) => ({ id: n, label: n }))} value={eq} onChange={(v) => useSettings.getState().set('eq', v)} />
      </Section>
    </Page>
  );
}

function RepeatPage() {
  const repeat = useSettings((s) => s.repeat);
  return (
    <Page title="Repeat" large={false} bg="grouped">
      <Section>
        <Choice
          items={[
            { id: 'off', label: 'Off' },
            { id: 'one', label: 'One' },
            { id: 'all', label: 'All' },
          ]}
          value={repeat}
          onChange={(v) => player.setRepeat(v)}
        />
      </Section>
    </Page>
  );
}

function VolumeLimitPage() {
  const limit = useSettings((s) => s.volumeLimit);
  const on = limit < 0.999;
  return (
    <Page title="Volume Limit" large={false} bg="grouped">
      <Section footer="Limit the maximum volume of the music on your iPod.">
        <Toggle title="Volume Limit" on={on} onChange={(v) => useSettings.getState().set('volumeLimit', v ? 0.75 : 1)} />
        {on && (
          <div className="t7s-slider">
            <Slider value={limit} onChange={(v) => useSettings.getState().set('volumeLimit', Math.max(0.1, Math.min(0.99, v)))} minGlyph="speaker.fill" maxGlyph="speaker.wave.3.fill" />
          </div>
        )}
      </Section>
    </Page>
  );
}

function TvPage() {
  return (
    <Page title="TV" large={false} bg="grouped">
      <Section header="Playback Quality">
        <Cell title="Wi-Fi" detail="Best Quality Available" chevron />
      </Section>
      <Section header="Audio Language">
        <Cell title="Primary Language" detail="Auto" chevron />
      </Section>
      <Section header="Subtitles & Captioning">
        <Fake title="Closed Captions + SDH" />
      </Section>
    </Page>
  );
}

function PhotosPage() {
  return (
    <Page title="Photos" large={false} bg="grouped">
      <Section footer="Your photos are kept in this browser. Import pictures with the Library button above the iPod.">
        <Fake title="iCloud Photos" />
        <Fake title="Shared Albums" />
      </Section>
      <Section header="Albums">
        <Fake title="Show Hidden Album" init />
      </Section>
      <Section header="Memories">
        <Fake title="Show Holiday Events" init />
      </Section>
    </Page>
  );
}

function CameraPage() {
  return (
    <Page title="Camera" large={false} bg="grouped">
      <Section>
        <Cell title="Formats" chevron />
        <Cell title="Record Video" detail="1080p at 30 fps" chevron />
        <Cell title="Preserve Settings" chevron />
      </Section>
      <Section header="Composition">
        <Fake title="Grid" />
        <Fake title="Mirror Front Camera" init />
      </Section>
    </Page>
  );
}

function WeatherPage() {
  const unit = usePrefs((s) => s.weatherUnit);
  return (
    <Page title="Weather" large={false} bg="grouped">
      <Section header="Allow Weather to Access">
        <Cell icon={<IconTile glyph="location.fill" bg="#007aff" />} title="Location" detail="While Using" chevron />
      </Section>
      <Section header="Temperature Unit">
        <Choice
          items={[
            { id: 'C', label: 'Celsius' },
            { id: 'F', label: 'Fahrenheit' },
          ]}
          value={unit}
          onChange={(v) => usePrefs.getState().set('weatherUnit', v)}
        />
      </Section>
    </Page>
  );
}

function AppPage({ app }: { app: string }) {
  return (
    <Page title={APPS[app]?.name ?? app} large={false} bg="grouped">
      <Section header={`Allow ${APPS[app]?.name ?? app} to Access`}>
        <Cell icon={<IconTile glyph="magnifyingglass" bg="#8e8e93" />} title="Siri & Search" chevron />
        <Cell icon={<IconTile glyph="bell.badge.fill" bg="#ff3b30" />} title="Notifications" chevron />
        <Fake title="Background App Refresh" init />
      </Section>
    </Page>
  );
}

function SimplePage({ title, toggles, text }: { title: string; toggles?: string[]; text?: string }) {
  return (
    <Page title={title} large={false} bg="grouped">
      {toggles && (
        <Section>
          {toggles.map((t) => (
            <Fake key={t} title={t} init />
          ))}
        </Section>
      )}
      {text && <div className="t7s-text">{text}</div>}
    </Page>
  );
}

function ChoicePage({ title, items }: { title: string; items: string[] }) {
  const [v, setV] = useState(items[0]);
  return (
    <Page title={title} large={false} bg="grouped">
      <Section>
        <Choice items={items.map((i) => ({ id: i, label: i }))} value={v} onChange={setV} />
      </Section>
    </Page>
  );
}

// ------------------------------------------------------------------ passcode

function PasscodePage() {
  const code = useSettings((s) => s.lockCode);
  const [flow, setFlow] = useState<null | 'on' | 'off' | 'change'>(null);
  return (
    <Page title="Passcode" large={false} bg="grouped">
      <Section footer="Your passcode is asked for when you unlock iPod. It is stored only in this browser.">
        {code ? (
          <>
            <Cell title="Turn Passcode Off" tint onPress={() => setFlow('off')} />
            <Cell title="Change Passcode" tint onPress={() => setFlow('change')} />
          </>
        ) : (
          <>
            <Cell title="Turn Passcode On" tint onPress={() => setFlow('on')} />
            <Cell title="Change Passcode" disabled />
          </>
        )}
      </Section>
      <Section>
        <Cell title="Require Passcode" detail={code ? 'Immediately' : undefined} disabled={!code} chevron />
      </Section>
      <Section header="Allow Access When Locked">
        <Fake title="Today View and Search" init />
        <Fake title="Notification Center" init />
        <Fake title="Control Center" init />
        <Fake title="Siri" init />
      </Section>
      <Sheet open={!!flow} onClose={() => setFlow(null)} full>
        {flow && <PasscodeFlow mode={flow} onDone={() => setFlow(null)} />}
      </Sheet>
    </Page>
  );
}

function PasscodeFlow({ mode, onDone }: { mode: 'on' | 'off' | 'change'; onDone: () => void }) {
  const current = useSettings((s) => s.lockCode);
  const [step, setStep] = useState<'old' | 'new' | 'again'>(mode === 'on' ? 'new' : 'old');
  const [entry, setEntry] = useState('');
  const [first, setFirst] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const title = step === 'old' ? 'Enter your passcode' : step === 'new' ? (mode === 'change' ? 'Enter your new passcode' : 'Enter a passcode') : 'Re-enter your passcode';
  const fail = (msg: string) => {
    setShake(true);
    setError(msg);
    window.setTimeout(() => {
      setShake(false);
      setEntry('');
    }, 450);
  };
  const done = (code: string) => {
    if (step === 'old') {
      if (code !== current) return fail('Wrong passcode. Try again.');
      if (mode === 'off') {
        useSettings.getState().set('lockCode', '');
        os.toast('Passcode Off', 'lock.open.fill');
        return onDone();
      }
      setStep('new');
      setEntry('');
      setError('');
      return;
    }
    if (step === 'new') {
      setFirst(code);
      setStep('again');
      setEntry('');
      setError('');
      return;
    }
    if (code !== first) {
      setStep('new');
      return fail('Passcodes did not match. Try again.');
    }
    useSettings.getState().set('lockCode', code);
    os.toast('Passcode Set', 'lock.fill');
    onDone();
  };
  const press = (k: string) => {
    playTap();
    setEntry((e) => {
      const n = (e + k).slice(0, 4);
      if (n.length === 4) window.setTimeout(() => done(n), 150);
      return n;
    });
  };
  const pressRef = { current: press };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.stopPropagation();
        pressRef.current(e.key);
      } else if (e.key === 'Backspace') setEntry((x) => x.slice(0, -1));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
  return (
    <div className="t7s-pc">
      <div className="t7s-pc-head">
        <span />
        <b>{mode === 'on' ? 'Set Passcode' : mode === 'off' ? 'Enter Passcode' : 'Change Passcode'}</b>
        <button className="t7-tbtn" onClick={onDone}>
          Cancel
        </button>
      </div>
      <div className="t7s-pc-title">{title}</div>
      <div className={`t7s-pc-dots ${shake ? 'shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < entry.length ? 'on' : ''} />
        ))}
      </div>
      <div className="t7s-pc-err">{error}</div>
      <div className="t7s-pc-keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button key={i} className={k === '⌫' ? 'del' : ''} onClick={() => (k === '⌫' ? setEntry((x) => x.slice(0, -1)) : press(k))}>
              {k === '⌫' ? <Glyph name="delete.left" size={22} /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

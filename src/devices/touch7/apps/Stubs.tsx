/**
 * The other stock iOS 15 apps on the iPod touch. Each has a believable
 * screen; the ones that can do something useful offline do it (Books plays
 * audiobooks, Find My plays a sound, Shortcuts runs actions, Files browses
 * what is on the iPod, Translate has a phrasebook + a free online API, Tips
 * explains the simulator).
 */
import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Artwork } from '../../../core/library/Artwork';
import { useCustomize } from '../../../core/customize/store';
import { useLibrary } from '../../../core/library/store';
import { audiobooks, songs, useTracks } from '../../../core/library/selectors';
import { player } from '../../../core/player/player';
import { fetchWithTimeout } from '../../../core/sources/net';
import { playTone } from '../../../core/sound/click';
import { Glyph } from '../os/glyphs';
import { AppIcon } from '../os/icons';
import { os, usePrefs } from '../os/store';
import { Scroller } from '../os/Scroller';
import { Cell, Empty, IconTile, NavStack, Page, SearchField, Section, Tabs, TextButton, TextInput, useNav } from '../os/ui';

// ------------------------------------------------------------------ FaceTime

function FaceTime() {
  return (
    <NavStack
      rootTitle="FaceTime"
      root={
        <Page title="FaceTime" left={<TextButton>Edit</TextButton>}>
          <div className="t7x-ft">
            <button className="gray" onClick={() => os.toast('Link Copied', 'link')}>
              <Glyph name="link" size={18} />
              Create Link
            </button>
            <button className="green" onClick={() => os.toast('FaceTime needs an Apple ID', 'video.fill')}>
              <Glyph name="video.fill" size={18} />
              New FaceTime
            </button>
          </div>
          <div className="t7a-sep" />
          <div className="t7x-ft-empty">
            <b>No Recent Calls</b>
            <span>Your recent FaceTime calls will appear here.</span>
          </div>
        </Page>
      }
    />
  );
}

// ------------------------------------------------------------------ Mail

const BOXES: [string, string][] = [
  ['Inbox', 'tray'],
  ['VIP', 'star'],
  ['Flagged', 'flag.fill'],
  ['Drafts', 'doc'],
  ['Sent', 'paperplane'],
  ['Junk', 'xmark.circle.fill'],
  ['Trash', 'trash'],
  ['Archive', 'archivebox'],
];

function Mail() {
  return (
    <NavStack
      rootTitle="Mailboxes"
      root={
        <MailboxesPage />
      }
    />
  );
}

function MailboxesPage() {
  const nav = useNav()!;
  const toolbar = (
    <>
      <span />
      <span className="t7x-updated">Updated Just Now</span>
      <button className="t7-gbtn" aria-label="Compose" onClick={() => os.toast('Add a Mail account in Settings', 'envelope.fill')}>
        <Glyph name="square.and.pencil" size={22} />
      </button>
    </>
  );
  return (
    <Page title="Mailboxes" bg="grouped" right={<TextButton>Edit</TextButton>} bottom={toolbar}>
      <Section>
        {BOXES.map(([n, g]) => (
          <Cell
            key={n}
            icon={<Glyph name={g} size={22} className="t7x-tint" />}
            title={n}
            chevron
            onPress={() =>
              nav.push(
                <Page title={n} bottom={toolbar}>
                  <SearchField value="" onChange={() => {}} />
                  <Empty title="No Mail" />
                </Page>,
                n,
              )
            }
          />
        ))}
      </Section>
    </Page>
  );
}

// ------------------------------------------------------------------ Maps / Find My shared map

function MapArt({ pin }: { pin?: ReactNode }) {
  return (
    <div className="t7x-map">
      <svg viewBox="0 0 320 568" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="568" fill="var(--t7x-land)" />
        <path d="M-10 380 C 60 350, 120 420, 190 390 S 300 330, 340 360 L 340 600 L -10 600 Z" fill="var(--t7x-water)" />
        <path d="M30 90 h90 v70 h-90z M200 40 h80 v60 h-80z" fill="var(--t7x-park)" rx="8" />
        <g stroke="var(--t7x-road)" strokeWidth="9" fill="none" strokeLinecap="round">
          <path d="M-10 200 L330 170" />
          <path d="M150 -10 L170 600" />
          <path d="M-10 300 L330 260" />
        </g>
        <g stroke="var(--t7x-road2)" strokeWidth="4" fill="none" strokeLinecap="round">
          <path d="M60 -10 L80 360" />
          <path d="M250 -10 L240 330" />
          <path d="M-10 120 L330 100" />
          <path d="M-10 250 L330 220" />
        </g>
        <path d="M-10 200 L330 170" stroke="#f7c948" strokeWidth="5" fill="none" />
        <g fontSize="9" fill="var(--t7x-label)" fontFamily="-apple-system, Helvetica, Arial">
          <text x="38" y="128">Lumphini Park</text>
          <text x="208" y="74">Benjakitti</text>
          <text x="180" y="186" transform="rotate(-5 180 186)">Rama IV Rd</text>
          <text x="40" y="470" fill="#5a8fc9">Chao Phraya</text>
        </g>
      </svg>
      {pin}
    </div>
  );
}

function Maps() {
  const [q, setQ] = useState('');
  return (
    <div className="t7x-maps">
      <MapArt
        pin={
          <span className="t7x-me" style={{ left: 160, top: 230 }}>
            <i />
          </span>
        }
      />
      <div className="t7x-mapbtns">
        <button aria-label="Info" onClick={() => os.toast('Explore · Driving · Transit · Satellite', 'map')}>
          <Glyph name="map" size={18} />
        </button>
        <button aria-label="Location" onClick={() => os.toast('Current Location', 'location.fill')}>
          <Glyph name="location.fill" size={16} />
        </button>
      </div>
      <div className="t7x-sheet">
        <span className="grab" />
        <SearchField value={q} onChange={setQ} placeholder="Search Maps" />
        <div className="t7x-sheet-h">Favorites</div>
        <div className="t7x-favs">
          {[
            ['house.fill', 'Home', 'Add'],
            ['folder.fill', 'Work', 'Add'],
            ['plus', 'Add', ''],
          ].map(([g, t, s]) => (
            <button key={t} onClick={() => os.toast(`${t}`, g)}>
              <span>
                <Glyph name={g} size={20} />
              </span>
              <b>{t}</b>
              <small>{s}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ App Store

function AppStore() {
  const [tab, setTab] = useState('today');
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  const cards: { label: string; title: string; sub: string; app: string; bg: string }[] = [
    { label: 'APP OF THE DAY', title: 'Music', sub: 'Every song you love, beautifully', app: 'music', bg: 'linear-gradient(160deg, #ff5f6d, #c31432)' },
    { label: 'GET STARTED', title: 'Capture the Moment', sub: 'Tips for great photos with Camera', app: 'camera', bg: 'linear-gradient(160deg, #3a3a3c, #0b0b0c)' },
    { label: 'WHAT WE’RE USING', title: 'Forecasts at a Glance', sub: 'Weather, wherever you are', app: 'weather', bg: 'linear-gradient(160deg, #3a8dde, #1c4fa1)' },
    { label: 'TIME SAVERS', title: 'Never Miss a Beat', sub: 'Alarms, timers and stopwatches', app: 'clock', bg: 'linear-gradient(160deg, #ff9f0a, #c96100)' },
  ];
  const todayPage = (
    <Page title="Today" large={false} titleView={<span />}>
      <div className="t7x-todayhead">
        <div className="t7x-date">{today}</div>
        <h1 className="t7-large-title">Today</h1>
        <span className="t7x-avatar">
          <Glyph name="person.crop.circle" size={34} />
        </span>
      </div>
      {cards.map((c) => (
        <div key={c.title} className="t7x-today" style={{ background: c.bg }} onClick={() => os.openApp(c.app)}>
          <span className="l">{c.label}</span>
          <b>{c.title}</b>
          <div className="foot">
            <AppIcon id={c.app} size={44} />
            <div>
              <div className="t">{c.title === 'Music' ? 'Music' : (c.app[0].toUpperCase() + c.app.slice(1))}</div>
              <div className="s">{c.sub}</div>
            </div>
            <span className="open">OPEN</span>
          </div>
        </div>
      ))}
    </Page>
  );
  const list = (title: string) => (
    <Page title={title}>
      <Section plain>
        {['music', 'podcasts', 'tv', 'books', 'itunes', 'voicememos', 'translate', 'shortcuts'].map((a) => (
          <Cell key={a} icon={<AppIcon id={a} size={52} />} title={a === 'itunes' ? 'iTunes Store' : a === 'voicememos' ? 'Voice Memos' : a === 'tv' ? 'Apple TV' : a[0].toUpperCase() + a.slice(1)} subtitle="Apple" accessory={<button className="t7x-open" onClick={() => os.openApp(a)}>OPEN</button>} />
        ))}
      </Section>
    </Page>
  );
  return (
    <Tabs
      value={tab}
      onChange={setTab}
      tabs={[
        { id: 'today', label: 'Today', glyph: 'doc', render: () => <NavStack root={todayPage} rootTitle="Today" /> },
        { id: 'games', label: 'Games', glyph: 'gamecontroller', render: () => <NavStack root={list('Games')} rootTitle="Games" /> },
        { id: 'apps', label: 'Apps', glyph: 'square.stack.3d.up', render: () => <NavStack root={list('Apps')} rootTitle="Apps" /> },
        { id: 'arcade', label: 'Arcade', glyph: 'star', render: () => <NavStack root={<Page title="Arcade"><Empty glyph="star" title="Apple Arcade" text="Play the Click Wheel games on the iPod classic and nano." /></Page>} rootTitle="Arcade" /> },
        { id: 'search', label: 'Search', glyph: 'magnifyingglass', render: () => <NavStack root={list('Search')} rootTitle="Search" /> },
      ]}
    />
  );
}

// ------------------------------------------------------------------ Books

function Books() {
  const [tab, setTab] = useState('now');
  const tracks = useTracks();
  const books = audiobooks(tracks);
  const lib = (
    <Page title="Library">
      {books.length ? (
        <div className="t7pod-grid">
          {books.map((b) => (
            <div key={b.id} className="t7pod-gitem" onClick={() => player.playTracks(books.map((x) => x.id), books.indexOf(b), { startAt: b.bookmark })}>
              <Artwork src={b.artwork} radius={4} className="t7pod-gart" />
              <div className="t">{b.title}</div>
              <div className="s">{b.artist}</div>
            </div>
          ))}
        </div>
      ) : (
        <Empty glyph="book" title="No Books" text="Audiobooks you import appear here." />
      )}
    </Page>
  );
  const now = (
    <Page title="Reading Now" right={<span className="t7x-avatar"><Glyph name="person.crop.circle" size={30} /></span>}>
      {books[0] ? (
        <div className="t7x-reading" onClick={() => player.playTracks([books[0].id], 0, { startAt: books[0].bookmark })}>
          <Artwork src={books[0].artwork} size={110} radius={4} />
          <div>
            <span>CONTINUE</span>
            <b>{books[0].title}</b>
            <small>{books[0].artist}</small>
          </div>
        </div>
      ) : (
        <div className="t7x-reading empty">
          <Glyph name="book.fill" size={40} />
          <div>
            <b>Discover your next great book.</b>
            <small>Books you’re reading will appear here.</small>
          </div>
        </div>
      )}
      <div className="t7a-h2">Reading Goals</div>
      <div className="t7x-goal">
        <span className="ring" />
        <div>
          <b>Today’s Reading</b>
          <small>0:00 of 5 minutes</small>
        </div>
      </div>
    </Page>
  );
  return (
    <div className="t7x-books">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'now', label: 'Reading Now', glyph: 'book.fill', render: () => <NavStack root={now} rootTitle="Reading Now" /> },
          { id: 'lib', label: 'Library', glyph: 'books.vertical', render: () => <NavStack root={lib} rootTitle="Library" /> },
          { id: 'store', label: 'Book Store', glyph: 'bag', render: () => <NavStack root={<Page title="Book Store"><Empty glyph="bag" title="Book Store" text="The Book Store needs an Apple ID." /></Page>} rootTitle="Book Store" /> },
          { id: 'search', label: 'Search', glyph: 'magnifyingglass', render: () => <NavStack root={<Page title="Search"><SearchField value="" onChange={() => {}} placeholder="Books & Audiobooks" /></Page>} rootTitle="Search" /> },
        ]}
      />
    </div>
  );
}

// ------------------------------------------------------------------ Find My

function FindMy() {
  const [tab, setTab] = useState('devices');
  const [ringing, setRinging] = useState(false);
  const name = usePrefs((s) => s.deviceName);
  const owner = useCustomize((s) => s.appearances[s.modelId]?.engraving?.[0]);
  const sound = () => {
    setRinging(true);
    for (let i = 0; i < 6; i++) {
      playTone(1568, 140, { delayMs: i * 420, volume: 0.15 });
      playTone(2093, 140, { delayMs: i * 420 + 160, volume: 0.15 });
    }
    window.setTimeout(() => setRinging(false), 2600);
  };
  const tabs = ['people', 'devices', 'items', 'me'];
  return (
    <div className="t7x-findmy">
      <MapArt
        pin={
          <span className="t7x-devpin" style={{ left: 160, top: 210 }}>
            <Glyph name="iphone" size={22} />
          </span>
        }
      />
      <div className="t7x-sheet tall">
        <span className="grab" />
        {tab === 'devices' ? (
          <>
            <div className="t7x-sheet-title">Devices</div>
            <div className="t7x-dev">
              <span className="ic">
                <Glyph name="iphone" size={22} />
              </span>
              <div>
                <b>{owner?.trim() ? `${owner.trim()}’s ${name}` : name}</b>
                <small>This iPod · With You</small>
              </div>
            </div>
            <div className="t7x-devbtns">
              <button onClick={sound} className={ringing ? 'on' : ''}>
                <Glyph name="speaker.wave.3.fill" size={18} />
                {ringing ? 'Playing…' : 'Play Sound'}
              </button>
              <button onClick={() => os.toast('You’re already here', 'location.fill')}>
                <Glyph name="location.fill" size={18} />
                Directions
              </button>
            </div>
          </>
        ) : (
          <div className="t7x-sheet-title">{tab === 'people' ? 'People' : tab === 'items' ? 'Items' : 'Me'}</div>
        )}
        {tab !== 'devices' && <div className="t7a-hint">{tab === 'people' ? 'Share your location with friends using an Apple ID.' : tab === 'items' ? 'No AirTags or accessories.' : 'Share My Location is off.'}</div>}
      </div>
      <div className="t7-tabbar t7x-fmtabs">
        {tabs.map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            <Glyph name={t === 'people' ? 'person.2' : t === 'devices' ? 'iphone' : t === 'items' ? 'circle.lefthalf.filled' : 'person.crop.circle'} size={24} />
            <span>{t[0].toUpperCase() + t.slice(1)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Home

function HomeApp() {
  const [scenes, setScenes] = useState<Record<string, boolean>>({});
  return (
    <div className="t7x-home">
      <Scroller className="t7x-home-scroll">
        <div className="t7x-home-top">
          <Glyph name="house.fill" size={22} />
          <button onClick={() => os.toast('Add Accessory', 'plus')} aria-label="Add">
            <Glyph name="plus" size={22} />
          </button>
        </div>
        <h1>My Home</h1>
        <div className="t7x-home-sub">No Accessories</div>
        <div className="t7x-home-h">Favorite Scenes</div>
        <div className="t7x-scenes">
          {['Arrive Home', 'Leave Home', 'Good Morning', 'Good Night'].map((s) => (
            <button key={s} className={scenes[s] ? 'on' : ''} onClick={() => setScenes({ ...scenes, [s]: !scenes[s] })}>
              <Glyph name={s.includes('Night') ? 'moon.fill' : s.includes('Morning') ? 'sun.max.fill' : 'house.fill'} size={20} />
              <span>{s}</span>
            </button>
          ))}
        </div>
        <div className="t7x-home-h">Favorite Accessories</div>
        <div className="t7x-home-add" onClick={() => os.toast('Scan a HomeKit code with an iPhone', 'house.fill')}>
          <Glyph name="plus.circle.fill" size={30} />
          <span>Add Accessory</span>
        </div>
      </Scroller>
    </div>
  );
}

// ------------------------------------------------------------------ Files

function Files() {
  const [tab, setTab] = useState('browse');
  const browse = <BrowseFiles />;
  return (
    <Tabs
      value={tab}
      onChange={setTab}
      tabs={[
        { id: 'recents', label: 'Recents', glyph: 'clock.fill', render: () => <NavStack root={<Page title="Recents"><Empty glyph="clock" title="No Recents" /></Page>} rootTitle="Recents" /> },
        { id: 'shared', label: 'Shared', glyph: 'folder.fill', render: () => <NavStack root={<Page title="Shared"><Empty glyph="person.2" title="No Shared Files" /></Page>} rootTitle="Shared" /> },
        { id: 'browse', label: 'Browse', glyph: 'folder.fill', render: () => <NavStack root={browse} rootTitle="Browse" /> },
      ]}
    />
  );
}

function BrowseFiles() {
  const nav = useNav()!;
  const tracks = useTracks();
  const photos = useLibrary((s) => s.photos);
  const memos = useLibrary((s) => s.voiceMemos);
  const notes = useLibrary((s) => s.notes);
  const local = useMemo(() => Object.values(tracks).filter((t) => t.source === 'local'), [tracks]);
  const folder = (title: string, items: { name: string; sub: string; glyph: string }[]) =>
    nav.push(
      <Page title={title}>
        {items.length ? (
          <div className="t7x-files">
            {items.map((it, i) => (
              <div key={i} className="t7x-file">
                <span className="ic">
                  <Glyph name={it.glyph} size={30} />
                </span>
                <b>{it.name}</b>
                <small>{it.sub}</small>
              </div>
            ))}
          </div>
        ) : (
          <Empty glyph="folder" title="Folder is Empty" />
        )}
      </Page>,
      title,
    );
  const onMyIpod = () =>
    nav.push(
      <Page title="On My iPod">
        <div className="t7x-files">
          {[
            ['Music', local.length, () => folder('Music', local.map((t) => ({ name: t.title, sub: t.artist, glyph: t.mediaType === 'movie' ? 'film' : 'music.note' })))],
            ['Photos', photos.length, () => folder('Photos', photos.map((p) => ({ name: p.name, sub: new Date(p.addedAt).toLocaleDateString(), glyph: 'photo' })))],
            ['Voice Memos', memos.length, () => folder('Voice Memos', memos.map((m) => ({ name: m.name, sub: `${Math.round(m.duration)} s`, glyph: 'waveform' })))],
            ['Notes', notes.length, () => folder('Notes', notes.map((n) => ({ name: n.title, sub: new Date(n.updatedAt).toLocaleDateString(), glyph: 'doc' })))],
          ].map(([n, c, run]) => (
            <div key={n as string} className="t7x-file" onClick={run as () => void}>
              <span className="ic folder">
                <Glyph name="folder.fill" size={50} />
              </span>
              <b>{n as string}</b>
              <small>{c as number} items</small>
            </div>
          ))}
        </div>
      </Page>,
      'On My iPod',
    );
  const tags: [string, string][] = [
    ['Red', '#ff3b30'],
    ['Orange', '#ff9500'],
    ['Yellow', '#ffcc00'],
    ['Green', '#34c759'],
    ['Blue', '#007aff'],
    ['Purple', '#af52de'],
    ['Gray', '#8e8e93'],
  ];
  return (
    <Page title="Browse" bg="grouped" right={<button className="t7-gbtn" aria-label="More"><Glyph name="ellipsis.circle" size={22} /></button>}>
      <Section header="Locations">
        <Cell icon={<Glyph name="icloud" size={22} className="t7x-tint" />} title="iCloud Drive" detail="Off" disabled />
        <Cell icon={<Glyph name="iphone" size={22} className="t7x-tint" />} title="On My iPod" chevron onPress={onMyIpod} />
        <Cell icon={<Glyph name="trash" size={22} className="t7x-tint" />} title="Recently Deleted" chevron onPress={() => folder('Recently Deleted', [])} />
      </Section>
      <Section header="Favorites">
        <Cell icon={<Glyph name="arrow.down.circle" size={22} className="t7x-tint" />} title="Downloads" chevron onPress={() => folder('Downloads', [])} />
      </Section>
      <Section header="Tags">
        {tags.map(([n, c]) => (
          <Cell key={n} icon={<span className="t7x-tag" style={{ background: c }} />} title={n} />
        ))}
      </Section>
    </Page>
  );
}

// ------------------------------------------------------------------ Shortcuts

const SHORTCUTS: { name: string; glyph: string; color: string; run: () => void }[] = [
  { name: 'Shuffle All Music', glyph: 'shuffle', color: '#ff2d55', run: () => {
      const ids = songs(useLibrary.getState().tracks).map((t) => t.id);
      if (ids.length) player.playTracks(ids, 0, { shuffle: true });
      else os.toast('No songs on this iPod', 'music.note');
    } },
  { name: 'Pause Music', glyph: 'pause.fill', color: '#5856d6', run: () => player.pause() },
  { name: 'Start Timer 5 min', glyph: 'timer', color: '#ff9500', run: () => {
      const t = usePrefs.getState().timer;
      usePrefs.getState().set('timer', { ...t, duration: 300, remaining: 300, endAt: Date.now() + 300_000 });
    } },
  { name: 'Take a Photo', glyph: 'camera.fill', color: '#8e8e93', run: () => os.openApp('camera') },
  { name: 'Toggle Dark Mode', glyph: 'circle.lefthalf.filled', color: '#1c1c1e', run: () => {
      const s = useCustomize.getState();
      s.setOption('darkMode', !s.appearances[s.modelId]?.options?.darkMode);
    } },
  { name: 'Weather', glyph: 'cloud.sun.fill', color: '#34aadc', run: () => os.openApp('weather') },
  { name: 'New Note', glyph: 'square.and.pencil', color: '#ffcc00', run: () => os.openAppWith('notes', 'new') },
  { name: 'Record Voice Memo', glyph: 'waveform', color: '#ff3b30', run: () => os.openAppWith('voicememos', 'record') },
];

function Shortcuts() {
  const [running, setRunning] = useState<string | null>(null);
  const [tab, setTab] = useState('my');
  const grid = (
    <Page title="All Shortcuts" right={<button className="t7-gbtn" aria-label="Add" onClick={() => os.toast('New Shortcut', 'plus')}><Glyph name="plus" size={22} /></button>}>
      <div className="t7x-sc">
        {SHORTCUTS.map((s) => (
          <button
            key={s.name}
            className={running === s.name ? 'run' : ''}
            style={{ background: s.color }}
            onClick={() => {
              setRunning(s.name);
              window.setTimeout(() => {
                s.run();
                setRunning(null);
                os.toast('Done', 'checkmark');
              }, 650);
            }}
          >
            <span className="top">
              <Glyph name={s.glyph} size={22} />
              <Glyph name="ellipsis.circle" size={20} className="more" />
            </span>
            <b>{s.name}</b>
          </button>
        ))}
      </div>
    </Page>
  );
  return (
    <Tabs
      value={tab}
      onChange={setTab}
      tabs={[
        { id: 'my', label: 'My Shortcuts', glyph: 'square.grid.2x2.fill', render: () => <NavStack root={grid} rootTitle="All Shortcuts" /> },
        { id: 'auto', label: 'Automation', glyph: 'clock.fill', render: () => <NavStack root={<Page title="Automation"><Empty glyph="clock" title="Create Personal Automation" text="Run shortcuts automatically at a time of day." /></Page>} rootTitle="Automation" /> },
        { id: 'gallery', label: 'Gallery', glyph: 'square.stack.3d.up', render: () => <NavStack root={<Page title="Gallery"><Empty glyph="sparkles" title="Starter Shortcuts" text="The shortcuts in My Shortcuts are ready to run." /></Page>} rootTitle="Gallery" /> },
      ]}
    />
  );
}

// ------------------------------------------------------------------ Translate

const PHRASES: Record<string, string> = {
  hello: 'สวัสดี',
  hi: 'สวัสดี',
  'thank you': 'ขอบคุณ',
  thanks: 'ขอบคุณ',
  'good morning': 'สวัสดีตอนเช้า',
  'good night': 'ราตรีสวัสดิ์',
  'how are you': 'สบายดีไหม',
  'i love music': 'ฉันรักเสียงเพลง',
  music: 'เพลง',
  yes: 'ใช่',
  no: 'ไม่',
  sorry: 'ขอโทษ',
  'where is the bathroom': 'ห้องน้ำอยู่ที่ไหน',
  'how much': 'เท่าไหร่',
  delicious: 'อร่อย',
  goodbye: 'ลาก่อน',
};

function Translate() {
  const [src, setSrc] = useState<'en' | 'th'>('en');
  const [text, setText] = useState('');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const dst = src === 'en' ? 'th' : 'en';
  const name = (l: string) => (l === 'en' ? 'English (US)' : 'Thai');
  const run = async () => {
    const q = text.trim();
    if (!q) return;
    const key = q.toLowerCase().replace(/[?.!]+$/, '');
    const local = src === 'en' ? PHRASES[key] : Object.entries(PHRASES).find(([, v]) => v === q)?.[0];
    setBusy(true);
    try {
      const r = await fetchWithTimeout(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${src}|${dst}`, { timeout: 8000 });
      const j = (await r.json()) as { responseData?: { translatedText?: string } };
      setOut(j.responseData?.translatedText || local || '—');
    } catch {
      setOut(local ?? 'Translation needs an internet connection.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page title="Translate" large={false} bg="grouped" noScroll>
      <div className="t7x-tr">
        <div className="t7x-langs">
          <button>{name(src)}</button>
          <button
            className="swap"
            aria-label="Swap languages"
            onClick={() => {
              setSrc(dst);
              setText(out && !out.includes('internet') ? out : '');
              setOut(text);
            }}
          >
            <Glyph name="arrow.left.arrow.right" size={16} />
          </button>
          <button>{name(dst)}</button>
        </div>
        <div className="t7x-trcard">
          <small>{name(src)}</small>
          <TextInput value={text} onChange={setText} placeholder="Enter text" multiline />
          <button className="go" disabled={!text.trim() || busy} onClick={() => void run()}>
            {busy ? 'Translating…' : 'Translate'}
          </button>
        </div>
        {out && (
          <div className="t7x-trcard out">
            <small>{name(dst)}</small>
            <div className="res">{out}</div>
          </div>
        )}
      </div>
    </Page>
  );
}

// ------------------------------------------------------------------ Tips

const TIPS: { title: string; body: string; glyph: string; color: string }[] = [
  { title: 'Open Control Center', body: 'Drag up from the bottom edge of the screen for music controls, brightness, volume, Wi-Fi, Dark Mode and shortcuts.', glyph: 'switch.2', color: '#007aff' },
  { title: 'Switch apps fast', body: 'Double-click the Home button (or press H twice) to see your recent apps. Swipe a card up to close it.', glyph: 'square.on.square', color: '#5856d6' },
  { title: 'Ask Siri', body: 'Hold the Home button or the H key. Try “Play Queen”, “Set a timer for 5 minutes” or “What time is it?”.', glyph: 'mic.fill', color: '#ff2d55' },
  { title: 'Keyboard shortcuts', body: 'H = Home, L = Sleep/Wake, + / − = volume, Space = play/pause. F and B turn the iPod to its front and back.', glyph: 'textformat.size', color: '#34c759' },
  { title: 'Bring your music', body: 'Use the Library button above the iPod to import files, YouTube or SoundCloud links, podcasts and free music.', glyph: 'music.note', color: '#ff9500' },
  { title: 'See the lyrics', body: 'In Now Playing, tap the quote button. Synced lyrics scroll along with the song — tap a line to jump to it.', glyph: 'quote.bubble.fill', color: '#af52de' },
  { title: 'Make it yours', body: 'Customize changes the finish, wallpaper, Dark Mode and engraving. Save looks as presets and share them.', glyph: 'paintbrush', color: '#ff3b30' },
  { title: 'Turn it around', body: 'Drag outside the screen to rotate the iPod in 3D and see the aluminium back and the ports.', glyph: 'rotate.right', color: '#8e8e93' },
];

function Tips() {
  return (
    <NavStack
      rootTitle="Tips"
      root={
        <Page title="Tips">
          <div className="t7x-tiphero">
            <span className="ic">
              <Glyph name="lightbulb" size={34} />
            </span>
            <b>Welcome to iPod touch</b>
            <span>Get the most out of the last iPod, right in your browser.</span>
          </div>
          {TIPS.map((t) => (
            <TipCard key={t.title} t={t} />
          ))}
        </Page>
      }
    />
  );
}

function TipCard({ t }: { t: (typeof TIPS)[number] }) {
  return (
    <div className="t7x-tip">
      <IconTile glyph={t.glyph} bg={t.color} size={40} />
      <div>
        <b>{t.title}</b>
        <span>{t.body}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ registry

export const STUBS: Record<string, ComponentType> = {
  facetime: FaceTime,
  mail: Mail,
  maps: Maps,
  appstore: AppStore,
  books: Books,
  findmy: FindMy,
  home: HomeApp,
  files: Files,
  shortcuts: Shortcuts,
  translate: Translate,
  tips: Tips,
};

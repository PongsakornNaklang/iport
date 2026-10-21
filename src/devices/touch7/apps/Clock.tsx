/**
 * Clock: World Clock, Alarm, Stopwatch, Timer (iOS 15).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLibrary } from '../../../core/library/store';
import { usePlaylists } from '../../../core/library/selectors';
import { useSettings } from '../../../core/settings/store';
import { playTone } from '../../../core/sound/click';
import { useNow } from '../../../core/util/hooks';
import type { Alarm } from '../../../core/types';
import { Glyph } from '../os/glyphs';
import { usePrefs } from '../os/store';
import { Cell, Empty, Page, SearchField, Section, Sheet, SheetHeader, Switch, Tabs, TextButton, TextInput, Wheel, NavStack } from '../os/ui';
import { Scroller } from '../os/Scroller';
import { useIntent } from './shared';

// ------------------------------------------------------------------ data

export const CITIES: { city: string; country: string; tz: string }[] = [
  { city: 'Abu Dhabi', country: 'United Arab Emirates', tz: 'Asia/Dubai' },
  { city: 'Amsterdam', country: 'Netherlands', tz: 'Europe/Amsterdam' },
  { city: 'Anchorage', country: 'U.S.A.', tz: 'America/Anchorage' },
  { city: 'Athens', country: 'Greece', tz: 'Europe/Athens' },
  { city: 'Auckland', country: 'New Zealand', tz: 'Pacific/Auckland' },
  { city: 'Bangkok', country: 'Thailand', tz: 'Asia/Bangkok' },
  { city: 'Barcelona', country: 'Spain', tz: 'Europe/Madrid' },
  { city: 'Beijing', country: 'China', tz: 'Asia/Shanghai' },
  { city: 'Berlin', country: 'Germany', tz: 'Europe/Berlin' },
  { city: 'Buenos Aires', country: 'Argentina', tz: 'America/Argentina/Buenos_Aires' },
  { city: 'Cairo', country: 'Egypt', tz: 'Africa/Cairo' },
  { city: 'Chiang Mai', country: 'Thailand', tz: 'Asia/Bangkok' },
  { city: 'Chicago', country: 'U.S.A.', tz: 'America/Chicago' },
  { city: 'Cupertino', country: 'U.S.A.', tz: 'America/Los_Angeles' },
  { city: 'Delhi', country: 'India', tz: 'Asia/Kolkata' },
  { city: 'Denver', country: 'U.S.A.', tz: 'America/Denver' },
  { city: 'Dubai', country: 'United Arab Emirates', tz: 'Asia/Dubai' },
  { city: 'Dublin', country: 'Ireland', tz: 'Europe/Dublin' },
  { city: 'Hanoi', country: 'Vietnam', tz: 'Asia/Ho_Chi_Minh' },
  { city: 'Helsinki', country: 'Finland', tz: 'Europe/Helsinki' },
  { city: 'Hong Kong', country: 'China', tz: 'Asia/Hong_Kong' },
  { city: 'Honolulu', country: 'U.S.A.', tz: 'Pacific/Honolulu' },
  { city: 'Istanbul', country: 'Türkiye', tz: 'Europe/Istanbul' },
  { city: 'Jakarta', country: 'Indonesia', tz: 'Asia/Jakarta' },
  { city: 'Johannesburg', country: 'South Africa', tz: 'Africa/Johannesburg' },
  { city: 'Kuala Lumpur', country: 'Malaysia', tz: 'Asia/Kuala_Lumpur' },
  { city: 'Lisbon', country: 'Portugal', tz: 'Europe/Lisbon' },
  { city: 'London', country: 'U.K.', tz: 'Europe/London' },
  { city: 'Los Angeles', country: 'U.S.A.', tz: 'America/Los_Angeles' },
  { city: 'Madrid', country: 'Spain', tz: 'Europe/Madrid' },
  { city: 'Manila', country: 'Philippines', tz: 'Asia/Manila' },
  { city: 'Melbourne', country: 'Australia', tz: 'Australia/Melbourne' },
  { city: 'Mexico City', country: 'Mexico', tz: 'America/Mexico_City' },
  { city: 'Moscow', country: 'Russia', tz: 'Europe/Moscow' },
  { city: 'Mumbai', country: 'India', tz: 'Asia/Kolkata' },
  { city: 'Nairobi', country: 'Kenya', tz: 'Africa/Nairobi' },
  { city: 'New York', country: 'U.S.A.', tz: 'America/New_York' },
  { city: 'Oslo', country: 'Norway', tz: 'Europe/Oslo' },
  { city: 'Paris', country: 'France', tz: 'Europe/Paris' },
  { city: 'Phuket', country: 'Thailand', tz: 'Asia/Bangkok' },
  { city: 'Reykjavík', country: 'Iceland', tz: 'Atlantic/Reykjavik' },
  { city: 'Rio de Janeiro', country: 'Brazil', tz: 'America/Sao_Paulo' },
  { city: 'Rome', country: 'Italy', tz: 'Europe/Rome' },
  { city: 'San Francisco', country: 'U.S.A.', tz: 'America/Los_Angeles' },
  { city: 'Seoul', country: 'South Korea', tz: 'Asia/Seoul' },
  { city: 'Shanghai', country: 'China', tz: 'Asia/Shanghai' },
  { city: 'Singapore', country: 'Singapore', tz: 'Asia/Singapore' },
  { city: 'Stockholm', country: 'Sweden', tz: 'Europe/Stockholm' },
  { city: 'Sydney', country: 'Australia', tz: 'Australia/Sydney' },
  { city: 'Taipei', country: 'Taiwan', tz: 'Asia/Taipei' },
  { city: 'Tokyo', country: 'Japan', tz: 'Asia/Tokyo' },
  { city: 'Toronto', country: 'Canada', tz: 'America/Toronto' },
  { city: 'Vancouver', country: 'Canada', tz: 'America/Vancouver' },
  { city: 'Vienna', country: 'Austria', tz: 'Europe/Vienna' },
  { city: 'Zürich', country: 'Switzerland', tz: 'Europe/Zurich' },
];

export const ALARM_SOUNDS = ['Radar', 'Apex', 'Beacon', 'Bulletin', 'By The Seaside', 'Chimes', 'Circuit', 'Constellation', 'Cosmic', 'Crystals', 'Hillside', 'Illuminate', 'Night Owl', 'Opening', 'Playtime', 'Presto', 'Radiate', 'Reflection', 'Ripples', 'Sencha', 'Signal', 'Silk', 'Slow Rise', 'Stargaze', 'Summit', 'Twinkle', 'Uplift', 'Waves'];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function repeatText(r: number[]): string {
  if (!r.length) return 'Never';
  const s = [...r].sort();
  if (s.length === 7) return 'Every day';
  if (s.join() === '1,2,3,4,5') return 'Weekdays';
  if (s.join() === '0,6') return 'Weekends';
  if (s.length === 1) return `Every ${DAYS[s[0]]}`;
  return s.map((d) => SHORT[d]).join(' ');
}

/** offset of a time zone from UTC in minutes at `at` */
function tzOffset(tz: string, at: Date): number {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(at);
    const v = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
    const asUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'));
    return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
  } catch {
    return 0;
  }
}

function zoned(tz: string, at: Date): { h: number; m: number; s: number; day: number } {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', weekday: 'short', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(at);
    const v = (t: string) => p.find((x) => x.type === t)?.value ?? '0';
    return { h: Number(v('hour')) % 24, m: Number(v('minute')), s: Number(v('second')), day: SHORT.indexOf(v('weekday')) };
  } catch {
    return { h: at.getHours(), m: at.getMinutes(), s: at.getSeconds(), day: at.getDay() };
  }
}

function hm(totalMin: number, use24h: boolean): { time: string; ap: string } {
  const h = Math.floor(totalMin / 60) % 24;
  const m = String(totalMin % 60).padStart(2, '0');
  if (use24h) return { time: `${String(h).padStart(2, '0')}:${m}`, ap: '' };
  return { time: `${h % 12 || 12}:${m}`, ap: h < 12 ? 'AM' : 'PM' };
}

// ------------------------------------------------------------------ app

export default function Clock() {
  const tab = usePrefs((s) => s.clockTab);
  const setTab = (v: string) => usePrefs.getState().set('clockTab', v);
  const [newAlarm, setNewAlarm] = useState(0);
  useIntent((d) => {
    if (d === 'alarm') {
      setTab('alarm');
      setNewAlarm((n) => n + 1);
    } else if (d === 'timer' || d === 'stopwatch' || d === 'world') setTab(d);
  });
  return (
    <div className="t7c-root">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'world', label: 'World Clock', glyph: 'globe.fill', render: (r) => <NavStack root={<WorldClock />} rootTitle="World Clock" resetSerial={r} /> },
          { id: 'alarm', label: 'Alarm', glyph: 'alarm.fill', render: (r) => <NavStack root={<Alarms create={newAlarm} />} rootTitle="Alarm" resetSerial={r} /> },
          { id: 'stopwatch', label: 'Stopwatch', glyph: 'stopwatch', render: () => <Stopwatch /> },
          { id: 'timer', label: 'Timer', glyph: 'timer', render: () => <Timer /> },
        ]}
      />
    </div>
  );
}

// ------------------------------------------------------------------ World Clock

function WorldClock() {
  const clocks = useLibrary((s) => s.worldClocks);
  const now = useNow(1000);
  const use24h = useSettings((s) => s.use24h);
  const [edit, setEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const here = -now.getTimezoneOffset();
  return (
    <Page
      title="World Clock"
      left={clocks.length ? <TextButton onPress={() => setEdit(!edit)} bold={edit}>{edit ? 'Done' : 'Edit'}</TextButton> : undefined}
      right={
        <button className="t7-gbtn" onClick={() => setAdding(true)} aria-label="Add">
          <Glyph name="plus" size={22} />
        </button>
      }
    >
      {clocks.length === 0 && <Empty title="No World Clocks" text="Tap + to add a city." />}
      <div className="t7c-list">
        {clocks.map((c) => {
          const z = zoned(c.timeZone, now);
          const diff = Math.round((tzOffset(c.timeZone, now) - here) / 60 * 2) / 2;
          const dayDiff = (z.day - now.getDay() + 7) % 7;
          const dayLabel = dayDiff === 0 ? 'Today' : dayDiff === 1 ? 'Tomorrow' : 'Yesterday';
          const t = hm(z.h * 60 + z.m, use24h);
          return (
            <div key={c.id} className={`t7c-wrow ${edit ? 'editing' : ''}`}>
              {edit && (
                <button className="t7c-del" onClick={() => useLibrary.getState().removeWorldClock(c.id)} aria-label="Delete">
                  <Glyph name="minus.circle.fill" size={22} />
                </button>
              )}
              <div className="t7c-wmain">
                <div className="t7c-wsub">
                  {dayLabel}, {diff >= 0 ? '+' : ''}
                  {diff}HRS
                </div>
                <div className="t7c-wcity">{c.city}</div>
              </div>
              {!edit && (
                <div className="t7c-wtime">
                  {t.time}
                  {t.ap && <small>{t.ap}</small>}
                </div>
              )}
              {edit && <Glyph name="list.bullet" size={18} className="t7c-grip" />}
            </div>
          );
        })}
      </div>
      <Sheet open={adding} onClose={() => setAdding(false)}>
        <CityPicker
          onPick={(c) => {
            useLibrary.getState().addWorldClock({ city: c.city, timeZone: c.tz });
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      </Sheet>
    </Page>
  );
}

function CityPicker({ onPick, onCancel }: { onPick: (c: (typeof CITIES)[number]) => void; onCancel: () => void }) {
  const [q, setQ] = useState('');
  const list = CITIES.filter((c) => !q || `${c.city} ${c.country}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="t7c-picker">
      <div className="t7c-picker-title">Choose a City.</div>
      <div className="t7c-picker-search">
        <SearchField value={q} onChange={setQ} />
        <button className="t7-tbtn" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <Scroller className="t7c-picker-list">
        {list.map((c) => (
          <div key={c.city} className="t7c-picker-row" onClick={() => onPick(c)}>
            {c.city}, {c.country}
          </div>
        ))}
      </Scroller>
    </div>
  );
}

// ------------------------------------------------------------------ Alarm

function Alarms({ create }: { create: number }) {
  const alarms = useLibrary((s) => s.alarms);
  const use24h = useSettings((s) => s.use24h);
  const [edit, setEdit] = useState(false);
  const [editing, setEditing] = useState<Alarm | 'new' | null>(null);
  const seen = useRef(0);
  useEffect(() => {
    if (create === seen.current) return;
    seen.current = create;
    setEditing('new');
  }, [create]);
  const sorted = [...alarms].sort((a, b) => a.time - b.time);
  return (
    <Page
      title="Alarm"
      left={alarms.length ? <TextButton onPress={() => setEdit(!edit)} bold={edit}>{edit ? 'Done' : 'Edit'}</TextButton> : undefined}
      right={
        <button className="t7-gbtn" onClick={() => setEditing('new')} aria-label="Add Alarm">
          <Glyph name="plus" size={22} />
        </button>
      }
    >
      <div className="t7c-ahead">
        <Glyph name="bed.double.fill" size={16} /> Sleep | Wake Up
      </div>
      <div className="t7c-arow sleep">
        <div className="t7c-amain">
          <div className="t7c-anone">No Alarm</div>
        </div>
        <button className="t7c-setup">SET UP</button>
      </div>
      <div className="t7c-ahead other">Other</div>
      {sorted.map((a) => {
        const t = hm(a.time, use24h);
        return (
          <div key={a.id} className={`t7c-arow ${a.enabled ? '' : 'off'} ${edit ? 'editing' : ''}`} onClick={() => setEditing(a)}>
            {edit && (
              <button
                className="t7c-del"
                onClick={(e) => {
                  e.stopPropagation();
                  useLibrary.getState().removeAlarm(a.id);
                }}
                aria-label="Delete"
              >
                <Glyph name="minus.circle.fill" size={22} />
              </button>
            )}
            <div className="t7c-amain">
              <div className="t7c-atime">
                {t.time}
                {t.ap && <small>{t.ap}</small>}
              </div>
              <div className="t7c-alabel">
                {a.label || 'Alarm'}
                {a.repeat.length ? `, ${repeatText(a.repeat).replace(/^Every /, 'every ')}` : ''}
              </div>
            </div>
            {edit ? (
              <Glyph name="chevron.right" size={14} className="t7-cell-chev" />
            ) : (
              <Switch on={a.enabled} onChange={(v) => useLibrary.getState().upsertAlarm({ id: a.id, enabled: v })} />
            )}
          </div>
        );
      })}
      <Sheet open={!!editing} onClose={() => setEditing(null)}>
        {editing && <AlarmEditor alarm={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </Page>
  );
}

function AlarmEditor({ alarm, onDone }: { alarm: Alarm | null; onDone: () => void }) {
  const use24h = useSettings((s) => s.use24h);
  const pls = usePlaylists();
  const now = new Date();
  const [time, setTime] = useState(alarm?.time ?? now.getHours() * 60 + now.getMinutes());
  const [repeat, setRepeat] = useState<number[]>(alarm?.repeat ?? []);
  const [label, setLabel] = useState(alarm?.label ?? 'Alarm');
  const [sound, setSound] = useState(alarm?.sound ?? 'Radar');
  const [playlistId, setPlaylistId] = useState<string | undefined>(alarm?.playlistId);
  const [snooze, setSnooze] = useState(true);
  const [view, setView] = useState<'main' | 'repeat' | 'label' | 'sound'>('main');
  const h = Math.floor(time / 60);
  const m = time % 60;
  const save = () => {
    useLibrary.getState().upsertAlarm({ id: alarm?.id, time, repeat, label: label.trim() || 'Alarm', sound, playlistId, enabled: true });
    onDone();
  };
  const hours12 = Array.from({ length: 12 }, (_, i) => String(i === 0 ? 12 : i));
  const hours24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const mins = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
  if (view !== 'main') {
    const back = (
      <button className="t7-back" onClick={() => setView('main')}>
        <Glyph name="chevron.left" size={21} />
        <span>Back</span>
      </button>
    );
    return (
      <div className="t7c-editor">
        <SheetHeader left={back} title={view === 'repeat' ? 'Repeat' : view === 'label' ? 'Label' : 'Sound'} />
        <Scroller className="t7c-editor-scroll">
          {view === 'repeat' && (
            <Section>
              {DAYS.map((d, i) => (
                <Cell key={d} title={`Every ${d}`} check={repeat.includes(i)} onPress={() => setRepeat(repeat.includes(i) ? repeat.filter((x) => x !== i) : [...repeat, i])} />
              ))}
            </Section>
          )}
          {view === 'label' && (
            <Section>
              <div className="t7c-labelin">
                <TextInput value={label} onChange={setLabel} placeholder="Alarm" autoFocus onEnter={() => setView('main')} />
              </div>
            </Section>
          )}
          {view === 'sound' && (
            <>
              {pls.length > 0 && (
                <Section header="Songs">
                  {pls.slice(0, 8).map((p) => (
                    <Cell key={p.id} title={p.name} check={playlistId === p.id} onPress={() => setPlaylistId(p.id)} />
                  ))}
                </Section>
              )}
              <Section header="Ringtones">
                {ALARM_SOUNDS.map((s) => (
                  <Cell
                    key={s}
                    title={s}
                    check={!playlistId && sound === s}
                    onPress={() => {
                      setPlaylistId(undefined);
                      setSound(s);
                      preview(s);
                    }}
                  />
                ))}
              </Section>
            </>
          )}
        </Scroller>
      </div>
    );
  }
  return (
    <div className="t7c-editor">
      <SheetHeader
        left={<TextButton onPress={onDone}>Cancel</TextButton>}
        title={alarm ? 'Edit Alarm' : 'Add Alarm'}
        right={
          <TextButton bold onPress={save}>
            Save
          </TextButton>
        }
      />
      <Scroller className="t7c-editor-scroll">
        <div className="t7-wheels t7c-wheels">
          {use24h ? (
            <Wheel items={hours24} value={h} onChange={(i) => setTime(i * 60 + m)} loop width={70} align="right" />
          ) : (
            <Wheel items={hours12} value={h % 12} onChange={(i) => setTime(((h >= 12 ? 12 : 0) + i) * 60 + m)} loop width={64} align="right" />
          )}
          <Wheel items={mins} value={m} onChange={(i) => setTime(h * 60 + i)} loop width={64} align="left" />
          {!use24h && <Wheel items={['AM', 'PM']} value={h >= 12 ? 1 : 0} onChange={(i) => setTime(((h % 12) + (i ? 12 : 0)) * 60 + m)} width={60} />}
        </div>
        <Section>
          <Cell title="Repeat" detail={repeatText(repeat)} chevron onPress={() => setView('repeat')} />
          <Cell title="Label" detail={label || 'Alarm'} chevron onPress={() => setView('label')} />
          <Cell title="Sound" detail={playlistId ? pls.find((p) => p.id === playlistId)?.name ?? 'Song' : sound} chevron onPress={() => setView('sound')} />
          <Cell title="Snooze" accessory={<Switch on={snooze} onChange={setSnooze} />} />
        </Section>
        {alarm && (
          <Section>
            <Cell
              title="Delete Alarm"
              destructive
              center
              onPress={() => {
                useLibrary.getState().removeAlarm(alarm.id);
                onDone();
              }}
            />
          </Section>
        )}
      </Scroller>
    </div>
  );
}

function preview(sound: string) {
  const i = Math.max(0, ALARM_SOUNDS.indexOf(sound));
  const base = 520 + (i % 7) * 70;
  [0, 120, 240].forEach((d, k) => playTone(base * (1 + k * 0.25), 160, { delayMs: d, volume: 0.12 }));
}

// ------------------------------------------------------------------ Stopwatch

function fmtSw(ms: number): string {
  const cs = Math.floor(ms / 10) % 100;
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function useTicker(on: boolean) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const loop = () => {
      setT((x) => x + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);
}

function Stopwatch() {
  const sw = usePrefs((s) => s.stopwatch);
  const set = (v: typeof sw) => usePrefs.getState().set('stopwatch', v);
  const running = sw.startAt != null;
  useTicker(running);
  const [page, setPage] = useState(0);
  const elapsed = sw.acc + (running ? Date.now() - sw.startAt! : 0);
  const lapsTotal = sw.laps.reduce((a, b) => a + b, 0);
  const current = elapsed - lapsTotal;
  const done = sw.laps;
  const best = done.length > 1 ? Math.min(...done) : -1;
  const worst = done.length > 1 ? Math.max(...done) : -1;
  return (
    <div className="t7c-sw">
      <Scroller axis="x" snap={320} className="t7c-sw-pages" onScroll={(p) => setPage(Math.round(p / 320))}>
        <div className="t7c-sw-page">
          <div className="t7c-sw-digits">{fmtSw(elapsed)}</div>
        </div>
        <div className="t7c-sw-page">
          <AnalogStopwatch ms={elapsed} lap={current} />
        </div>
      </Scroller>
      <div className="t7c-sw-dots">
        <span className={page === 0 ? 'on' : ''} />
        <span className={page === 1 ? 'on' : ''} />
      </div>
      <div className="t7c-btns">
        <button
          className="t7c-cbtn gray"
          disabled={!running && elapsed === 0}
          onClick={() => {
            if (running) set({ ...sw, laps: [...sw.laps, current] });
            else set({ startAt: null, acc: 0, laps: [] });
          }}
        >
          <span>{running || elapsed === 0 ? 'Lap' : 'Reset'}</span>
        </button>
        <button
          className={`t7c-cbtn ${running ? 'red' : 'green'}`}
          onClick={() => {
            if (running) set({ ...sw, startAt: null, acc: elapsed });
            else set({ ...sw, startAt: Date.now() });
          }}
        >
          <span>{running ? 'Stop' : 'Start'}</span>
        </button>
      </div>
      <Scroller className="t7c-laps">
        {(running || elapsed > 0) && (
          <div className="t7c-lap">
            <span>Lap {done.length + 1}</span>
            <span>{fmtSw(current)}</span>
          </div>
        )}
        {[...done].reverse().map((l, i) => {
          const n = done.length - i;
          return (
            <div key={n} className={`t7c-lap ${l === best ? 'best' : l === worst ? 'worst' : ''}`}>
              <span>Lap {n}</span>
              <span>{fmtSw(l)}</span>
            </div>
          );
        })}
      </Scroller>
    </div>
  );
}

function AnalogStopwatch({ ms, lap }: { ms: number; lap: number }) {
  const sec = (ms / 1000) % 60;
  const lapSec = (lap / 1000) % 60;
  const minDial = (ms / 60000) % 30;
  return (
    <svg viewBox="0 0 240 240" className="t7c-analog">
      {Array.from({ length: 240 }, (_, i) => (
        <line key={i} x1="120" y1="6" x2="120" y2={i % 20 === 0 ? 18 : i % 4 === 0 ? 14 : 11} stroke={i % 20 === 0 ? 'currentColor' : 'var(--t7-label2)'} strokeWidth={i % 20 === 0 ? 1.4 : 0.6} transform={`rotate(${i * 1.5} 120 120)`} />
      ))}
      {Array.from({ length: 12 }, (_, i) => {
        const a = ((i + 1) * 30 * Math.PI) / 180;
        return (
          <text key={i} x={120 + Math.sin(a) * 92} y={120 - Math.cos(a) * 92 + 6} textAnchor="middle" fontSize="16" fill="currentColor">
            {(i + 1) * 5}
          </text>
        );
      })}
      <circle cx="120" cy="78" r="22" fill="none" stroke="var(--t7-label3)" strokeWidth="0.8" />
      <line x1="120" y1="78" x2="120" y2="60" stroke="#ff9500" strokeWidth="1.6" transform={`rotate(${minDial * 12} 120 78)`} />
      <text x="120" y="160" textAnchor="middle" fontSize="15" fill="currentColor" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {fmtSw(ms)}
      </text>
      <line x1="120" y1="140" x2="120" y2="14" stroke="#0a84ff" strokeWidth="1.4" transform={`rotate(${lapSec * 6} 120 120)`} />
      <line x1="120" y1="140" x2="120" y2="10" stroke="#ff9500" strokeWidth="1.6" transform={`rotate(${sec * 6} 120 120)`} />
      <circle cx="120" cy="120" r="4" fill="#ff9500" />
      <circle cx="120" cy="120" r="1.6" fill="var(--t7-bg)" />
    </svg>
  );
}

// ------------------------------------------------------------------ Timer

function fmtTimer(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}

function Timer() {
  const timer = usePrefs((s) => s.timer);
  const use24h = useSettings((s) => s.use24h);
  const set = (v: Partial<typeof timer>) => usePrefs.getState().set('timer', { ...usePrefs.getState().timer, ...v });
  const running = timer.endAt != null;
  const active = running || timer.remaining > 0;
  useNow(250);
  const [soundSheet, setSoundSheet] = useState(false);
  const left = running ? (timer.endAt! - Date.now()) / 1000 : timer.remaining;
  const d = timer.duration;
  const hh = Math.floor(d / 3600);
  const mm = Math.floor((d % 3600) / 60);
  const ss = d % 60;
  const n24 = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i)), []);
  const n60 = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i)), []);
  const end = new Date(Date.now() + Math.max(0, left) * 1000);
  const R = 118;
  const C = 2 * Math.PI * R;
  const frac = d ? Math.max(0, Math.min(1, left / d)) : 0;
  return (
    <div className="t7c-timer">
      <div className="t7c-timer-top">
        {active ? (
          <div className="t7c-ring">
            <svg viewBox="0 0 250 250">
              <circle cx="125" cy="125" r={R} fill="none" stroke="var(--t7-fill)" strokeWidth="7" />
              <circle cx="125" cy="125" r={R} fill="none" stroke="#ff9500" strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 125 125)" />
            </svg>
            <div className="t7c-ring-in">
              <div className="t7c-ring-time">{fmtTimer(left)}</div>
              <div className={`t7c-ring-end ${running ? '' : 'paused'}`}>
                <Glyph name="bell.fill" size={11} />
                {end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: !use24h })}
              </div>
            </div>
          </div>
        ) : (
          <div className="t7-wheels t7c-twheels">
            <Wheel items={n24} value={hh} onChange={(i) => set({ duration: i * 3600 + mm * 60 + ss })} width={92} align="right" />
            <Wheel items={n60} value={mm} onChange={(i) => set({ duration: hh * 3600 + i * 60 + ss })} width={92} align="right" />
            <Wheel items={n60} value={ss} onChange={(i) => set({ duration: hh * 3600 + mm * 60 + i })} width={92} align="right" />
            <span className="t7-wheel-unit" style={{ left: 92 + 10 - 46 + 8 }}>hours</span>
            <span className="t7-wheel-unit" style={{ left: 184 + 10 - 46 + 8 }}>min</span>
            <span className="t7-wheel-unit" style={{ left: 276 + 10 - 46 + 8 }}>sec</span>
          </div>
        )}
      </div>
      <div className="t7c-btns">
        <button className="t7c-cbtn gray" disabled={!active} onClick={() => set({ endAt: null, remaining: 0 })}>
          <span>Cancel</span>
        </button>
        <button
          className={`t7c-cbtn ${running ? 'orange' : 'green'}`}
          disabled={!active && d === 0}
          onClick={() => {
            if (running) set({ endAt: null, remaining: Math.max(0, left) });
            else if (active) set({ endAt: Date.now() + timer.remaining * 1000 });
            else set({ endAt: Date.now() + d * 1000, remaining: d });
          }}
        >
          <span>{running ? 'Pause' : active ? 'Resume' : 'Start'}</span>
        </button>
      </div>
      <div className="t7c-tsound">
        <Section>
          <Cell title="When Timer Ends" detail={timer.sound} chevron onPress={() => setSoundSheet(true)} />
        </Section>
      </div>
      <Sheet open={soundSheet} onClose={() => setSoundSheet(false)}>
        <div className="t7c-editor">
          <SheetHeader
            left={<TextButton onPress={() => setSoundSheet(false)}>Cancel</TextButton>}
            title="When Timer Ends"
            right={
              <TextButton bold onPress={() => setSoundSheet(false)}>
                Set
              </TextButton>
            }
          />
          <Scroller className="t7c-editor-scroll">
            <Section>
              {ALARM_SOUNDS.map((s) => (
                <Cell
                  key={s}
                  title={s}
                  check={timer.sound === s}
                  onPress={() => {
                    set({ sound: s });
                    preview(s);
                  }}
                />
              ))}
            </Section>
            <Section>
              <Cell title="Stop Playing" check={timer.sound === 'Stop Playing'} onPress={() => set({ sound: 'Stop Playing' })} />
            </Section>
          </Scroller>
        </div>
      </Sheet>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { usePlaylists } from '../../../../core/library/selectors';
import { useLibrary } from '../../../../core/library/store';
import { player, usePlayer } from '../../../../core/player/player';
import { useSettings } from '../../../../core/settings/store';
import type { Alarm } from '../../../../core/types';
import { formatClock } from '../../../../core/util/format';
import { useNow } from '../../../../core/util/hooks';
import { clamp, useInput, useOS } from '../core';
import { ChoiceList } from '../common';
import { ListView, type Row } from '../ListView';
import { locale, t } from '../i18n';

// ------------------------------------------------------------------ alarms

export function minutesLabel(min: number, use24h: boolean): string {
  const d = new Date();
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return formatClock(d, use24h);
}

const REPEATS: { label: string; days: number[] }[] = [
  { label: 'Once', days: [] },
  { label: 'Every Day', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { label: 'Weekends', days: [0, 6] },
  ...['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => ({ label: `Every ${d}`, days: [i] })),
];

/** a repeat as the chosen language says it ("Every Sunday" names the day in it) */
function repeatText(label: string): string {
  const r = REPEATS.find((x) => x.label === label);
  if (!label.startsWith('Every ') || !r || r.days.length !== 1) return t(label);
  // 1 Jan 2023 was a Sunday
  const day = new Date(2023, 0, 1 + r.days[0]).toLocaleDateString(locale(), { weekday: 'long' });
  return t('Every {d}', { d: day });
}

function repeatLabel(days: number[]): string {
  const key = [...days].sort().join(',');
  return REPEATS.find((r) => [...r.days].sort().join(',') === key)?.label ?? 'Custom';
}

const LABELS = ['Alarm', 'Wake Up', 'Work', 'Class', 'Medication', 'Exercise', 'Appointment', 'Meeting', 'Lunch', 'Nap', 'Event'];

export function AlarmsScreen() {
  const os = useOS();
  const alarms = useLibrary((s) => s.alarms);
  const use24h = useSettings((s) => s.use24h);
  const sleepAt = usePlayer((s) => s.sleepAt);
  const now = useNow(1000);
  const rows = useMemo<Row[]>(() => {
    const left = sleepAt ? Math.max(0, Math.ceil((sleepAt - now.getTime()) / 60000)) : 0;
    return [
      {
        key: '__create',
        label: t('Create Alarm'),
        chevron: true,
        onSelect: () => {
          const id = useLibrary.getState().upsertAlarm({ time: 7 * 60, label: 'Alarm', enabled: true, repeat: [] });
          os.nav.push({ title: t('Alarm'), el: <AlarmEditor id={id} /> });
        },
      },
      {
        key: '__sleep',
        label: t('Sleep Timer'),
        detail: sleepAt ? `${left} min` : 'Off',
        chevron: true,
        onSelect: () => os.nav.push({ title: t('Sleep Timer'), el: <SleepTimer /> }),
      },
      ...[...alarms]
        .sort((a, b) => a.time - b.time)
        .map((a) => ({
          key: a.id,
          label: `${minutesLabel(a.time, use24h)}  ${t(a.label)}`,
          detail: t(a.enabled ? 'On' : 'Off'),
          dim: !a.enabled,
          chevron: true,
          onSelect: () => os.nav.push({ title: t('Alarm'), el: <AlarmEditor id={a.id} /> }),
        })),
    ];
  }, [alarms, use24h, sleepAt, now, os]);
  return <ListView rows={rows} />;
}

function AlarmEditor({ id }: { id: string }) {
  const os = useOS();
  const a = useLibrary((s) => s.alarms.find((x) => x.id === id));
  const use24h = useSettings((s) => s.use24h);
  const lists = usePlaylists();
  const set = (p: Partial<Alarm>) => useLibrary.getState().upsertAlarm({ id, ...p });
  const rows = useMemo<Row[]>(() => {
    if (!a) return [];
    const soundLabel = a.playlistId ? lists.find((p) => p.id === a.playlistId)?.name ?? 'Playlist' : a.sound === 'None' ? 'None' : 'Beep';
    return [
      { key: 'on', label: t('Alarm'), detail: t(a.enabled ? 'On' : 'Off'), onSelect: () => set({ enabled: !a.enabled }) },
      {
        key: 'time',
        label: t('Time'),
        detail: minutesLabel(a.time, use24h),
        chevron: true,
        onSelect: () => os.nav.push({ title: t('Time'), el: <TimePicker value={a.time} onDone={(m) => set({ time: m, enabled: true })} /> }),
      },
      {
        key: 'repeat',
        label: t('Repeat'),
        detail: repeatText(repeatLabel(a.repeat)),
        chevron: true,
        onSelect: () =>
          os.nav.push({
            title: t('Repeat'),
            el: <ChoiceList raw choices={REPEATS.map((r) => ({ value: r.label, label: repeatText(r.label) }))} value={repeatLabel(a.repeat)} onPick={(v) => set({ repeat: REPEATS.find((r) => r.label === v)?.days ?? [] })} />,
          }),
      },
      {
        key: 'sound',
        label: t('Alerts'),
        detail: soundLabel,
        chevron: true,
        onSelect: () =>
          os.nav.push({
            title: t('Alerts'),
            el: (
              <ChoiceList
                raw
                choices={[{ value: '__beep', label: t('Beep') }, { value: '__none', label: t('None') }, ...lists.map((p) => ({ value: p.id, label: p.name }))]}
                value={a.playlistId ?? (a.sound === 'None' ? '__none' : '__beep')}
                onPick={(v) => (v === '__beep' ? set({ sound: 'Beep', playlistId: undefined }) : v === '__none' ? set({ sound: 'None', playlistId: undefined }) : set({ playlistId: v }))}
              />
            ),
          }),
      },
      {
        key: 'label',
        label: t('Label'),
        detail: t(a.label),
        chevron: true,
        onSelect: () => os.nav.push({ title: t('Label'), el: <ChoiceList choices={LABELS.map((l) => ({ value: l, label: l }))} value={a.label} onPick={(v) => set({ label: v })} /> }),
      },
      {
        key: 'delete',
        label: t('Delete'),
        onSelect: () =>
          os.menu({
            title: t('Delete this alarm?'),
            options: [
              {
                label: t('Delete'),
                action: () => {
                  useLibrary.getState().removeAlarm(id);
                  os.nav.pop();
                },
              },
              { label: t('Cancel') },
            ],
          }),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, use24h, lists, os, id]);
  if (!a) return <ListView rows={[]} empty={t('Alarm deleted')} />;
  return <ListView rows={rows} />;
}

/** Hour / minute (/ AM-PM) fields set with the wheel, center moves on. */
export function TimePicker({ value, onDone }: { value: number; onDone: (minutes: number) => void }) {
  const os = useOS();
  const use24h = useSettings((s) => s.use24h);
  const [h, setH] = useState(Math.floor(value / 60));
  const [m, setM] = useState(value % 60);
  const [field, setField] = useState(0);
  const fields = use24h ? 2 : 3;
  useInput((e) => {
    if (e.type === 'scroll') {
      if (field === 0) setH((x) => (((x + e.steps) % 24) + 24) % 24);
      else if (field === 1) setM((x) => (((x + e.steps) % 60) + 60) % 60);
      else setH((x) => (x + 12) % 24);
      return true;
    }
    if (e.type === 'click' && (e.button === 'select' || e.button === 'next')) {
      if (field + 1 >= fields) {
        onDone(h * 60 + m);
        os.nav.pop();
      } else setField(field + 1);
      return true;
    }
    if (e.type === 'click' && e.button === 'prev') {
      setField((f) => Math.max(0, f - 1));
      return true;
    }
    return false;
  });
  const hh = use24h ? String(h).padStart(2, '0') : String(h % 12 || 12);
  return (
    <div className="cl-picker">
      <div className="cl-picker-fields">
        <span className={`cl-picker-f ${field === 0 ? 'on' : ''}`}>{hh}</span>
        <span className="cl-picker-colon">:</span>
        <span className={`cl-picker-f ${field === 1 ? 'on' : ''}`}>{String(m).padStart(2, '0')}</span>
        {!use24h && <span className={`cl-picker-f cl-picker-ampm ${field === 2 ? 'on' : ''}`}>{h >= 12 ? 'PM' : 'AM'}</span>}
      </div>
      <div className="cl-picker-hint">{t('Turn the wheel to change, press center to continue.')}</div>
    </div>
  );
}

function SleepTimer() {
  const sleepAt = usePlayer((s) => s.sleepAt);
  const now = useNow(1000);
  const opts = [0, 15, 30, 60, 90, 120];
  const left = sleepAt ? Math.max(0, Math.ceil((sleepAt - now.getTime()) / 60000)) : 0;
  return (
    <ChoiceList
      choices={opts.map((v) => ({ value: v, label: v === 0 ? 'Off' : `${v} Minutes` }))}
      value={sleepAt ? (opts.includes(left) ? left : -1) : 0}
      onPick={(v) => player.setSleepTimer(v || null)}
    />
  );
}

// ------------------------------------------------------------------ clocks

export const CITIES: { city: string; tz: string }[] = [
  { city: 'Amsterdam', tz: 'Europe/Amsterdam' },
  { city: 'Auckland', tz: 'Pacific/Auckland' },
  { city: 'Bangkok', tz: 'Asia/Bangkok' },
  { city: 'Beijing', tz: 'Asia/Shanghai' },
  { city: 'Berlin', tz: 'Europe/Berlin' },
  { city: 'Buenos Aires', tz: 'America/Argentina/Buenos_Aires' },
  { city: 'Cairo', tz: 'Africa/Cairo' },
  { city: 'Chicago', tz: 'America/Chicago' },
  { city: 'Cupertino', tz: 'America/Los_Angeles' },
  { city: 'Dubai', tz: 'Asia/Dubai' },
  { city: 'Hong Kong', tz: 'Asia/Hong_Kong' },
  { city: 'Honolulu', tz: 'Pacific/Honolulu' },
  { city: 'Istanbul', tz: 'Europe/Istanbul' },
  { city: 'Jakarta', tz: 'Asia/Jakarta' },
  { city: 'London', tz: 'Europe/London' },
  { city: 'Los Angeles', tz: 'America/Los_Angeles' },
  { city: 'Madrid', tz: 'Europe/Madrid' },
  { city: 'Mexico City', tz: 'America/Mexico_City' },
  { city: 'Moscow', tz: 'Europe/Moscow' },
  { city: 'Mumbai', tz: 'Asia/Kolkata' },
  { city: 'New York', tz: 'America/New_York' },
  { city: 'Paris', tz: 'Europe/Paris' },
  { city: 'Rio de Janeiro', tz: 'America/Sao_Paulo' },
  { city: 'Rome', tz: 'Europe/Rome' },
  { city: 'Seoul', tz: 'Asia/Seoul' },
  { city: 'Singapore', tz: 'Asia/Singapore' },
  { city: 'Sydney', tz: 'Australia/Sydney' },
  { city: 'Taipei', tz: 'Asia/Taipei' },
  { city: 'Tokyo', tz: 'Asia/Tokyo' },
  { city: 'Toronto', tz: 'America/Toronto' },
  { city: 'Vancouver', tz: 'America/Vancouver' },
];

/** Wall-clock parts in a time zone. */
export function zoned(now: Date, timeZone: string): { h: number; m: number; s: number; day: string; date: Date } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23', weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
    const date = new Date(+get('year'), +get('month') - 1, +get('day'));
    return { h: +get('hour') % 24, m: +get('minute'), s: +get('second'), day: get('weekday'), date };
  } catch {
    return { h: now.getHours(), m: now.getMinutes(), s: now.getSeconds(), day: '', date: now };
  }
}

export function AnalogClock({ h, m, s, size, night }: { h: number; m: number; s: number; size: number; night: boolean }) {
  const fg = night ? '#f2f2f2' : '#111';
  const bg = night ? '#141414' : '#fbfbfb';
  const ha = ((h % 12) + m / 60) * 30;
  const ma = (m + s / 60) * 6;
  const sa = s * 6;
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" className="cl-analog" aria-hidden>
      <defs>
        <radialGradient id={night ? 'clFaceN' : 'clFaceD'} cx="0.5" cy="0.35" r="0.7">
          <stop offset="0" stopColor={night ? '#2a2a2a' : '#ffffff'} />
          <stop offset="1" stopColor={bg} />
        </radialGradient>
      </defs>
      <circle r="48" fill={`url(#${night ? 'clFaceN' : 'clFaceD'})`} stroke={night ? '#555' : '#9a9a9a'} strokeWidth="2.5" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x="-1.3" y="-44" width="2.6" height={i % 3 === 0 ? 9 : 5} fill={fg} transform={`rotate(${i * 30})`} />
      ))}
      <rect x="-2.4" y="-26" width="4.8" height="31" rx="2" fill={fg} transform={`rotate(${ha})`} />
      <rect x="-1.7" y="-40" width="3.4" height="45" rx="1.5" fill={fg} transform={`rotate(${ma})`} />
      <g transform={`rotate(${sa})`}>
        <rect x="-0.6" y="-42" width="1.2" height="52" fill="#e0262b" />
      </g>
      <circle r="3" fill={fg} />
      <circle r="1.4" fill="#e0262b" />
    </svg>
  );
}

export function ClocksScreen() {
  const os = useOS();
  const clocks = useLibrary((s) => s.worldClocks);
  const use24h = useSettings((s) => s.use24h);
  const now = useNow(1000);
  const [sel, setSel] = useState(0);
  const s = clamp(sel, 0, Math.max(0, clocks.length - 1));
  const rowH = 54;
  const visible = Math.floor((os.height - os.hdr) / rowH);
  const top = clamp(s - visible + 1, 0, Math.max(0, clocks.length - visible));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const addClock = () =>
    os.nav.push({
      title: t('Add Clock'),
      el: (
        <ChoiceList
          choices={CITIES.map((c) => ({ value: c.city, label: c.city }))}
          value=""
          onPick={(city) => {
            const c = CITIES.find((x) => x.city === city);
            if (c) useLibrary.getState().addWorldClock({ city: c.city, timeZone: c.tz });
          }}
        />
      ),
    });

  useInput((e) => {
    if (e.type === 'scroll') {
      setSel(clamp(s + e.steps, 0, Math.max(0, clocks.length - 1)));
      return true;
    }
    if (e.type === 'click' && e.button === 'select') {
      const c = clocks[s];
      os.menu({
        title: c?.city ?? 'Clocks',
        options: [
          { label: t('Add'), action: addClock },
          ...(c ? [{ label: t('Delete'), action: () => useLibrary.getState().removeWorldClock(c.id) }] : []),
          { label: t('Cancel') },
        ],
      });
      return true;
    }
    return false;
  });

  if (!clocks.length) return <ListView rows={[{ key: 'add', label: t('Add Clock'), chevron: true, onSelect: addClock }]} />;
  return (
    <div className="cl-clocks">
      {clocks.slice(top, top + visible + 1).map((c, k) => {
        const i = top + k;
        const z = zoned(now, c.timeZone);
        const night = z.h < 6 || z.h >= 18;
        const diff = Math.round((z.date.getTime() - today) / 86400000);
        const d = new Date(now);
        d.setHours(z.h, z.m);
        return (
          <div key={c.id} className={`cl-clock-row ${i === s ? 'cl-sel' : ''}`} style={{ top: k * rowH, height: rowH }}>
            <AnalogClock h={z.h} m={z.m} s={z.s} size={44} night={night} />
            <div className="cl-clock-text">
              <b>{c.city}</b>
              <span>{t(diff === 0 ? 'Today' : diff > 0 ? 'Tomorrow' : 'Yesterday')}</span>
            </div>
            <div className="cl-clock-time">{formatClock(d, use24h)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ stopwatch

interface StopwatchState {
  running: boolean;
  startedAt: number;
  before: number;
  laps: number[];
}

/** Lives outside the screen so the stopwatch keeps running while you browse. */
const useStopwatch = create<StopwatchState>(() => ({ running: false, startedAt: 0, before: 0, laps: [] }));

function swElapsed(s: StopwatchState, now: number): number {
  return s.before + (s.running ? now - s.startedAt : 0);
}

function fmtSw(ms: number): string {
  const cs = Math.floor(ms / 10) % 100;
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000);
  return `${h ? `${h}:` : ''}${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function StopwatchScreen() {
  const sw = useStopwatch();
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!sw.running) return;
    let raf = 0;
    const loop = () => {
      setTick((t) => t + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sw.running]);

  useInput((e) => {
    const s = useStopwatch.getState();
    const now = performance.now();
    if (e.type === 'click' && e.button === 'play') {
      if (s.running) useStopwatch.setState({ running: false, before: swElapsed(s, now) });
      else useStopwatch.setState({ running: true, startedAt: now });
      return true;
    }
    if (e.type === 'click' && e.button === 'select') {
      if (s.running) {
        const total = swElapsed(s, now);
        const prev = s.laps.reduce((a, b) => a + b, 0);
        useStopwatch.setState({ laps: [...s.laps, total - prev] });
      } else useStopwatch.setState({ before: 0, laps: [] });
      return true;
    }
    return false;
  });

  const now = performance.now();
  const total = swElapsed(sw, now);
  const lapTotal = sw.laps.reduce((a, b) => a + b, 0);
  const current = total - lapTotal;
  return (
    <div className="cl-sw">
      <div className="cl-sw-main">{fmtSw(total)}</div>
      <div className="cl-sw-lap">
        {t('Lap {n}', { n: sw.laps.length + 1 })}: {fmtSw(current)}
      </div>
      <div className="cl-sw-laps">
        {[...sw.laps]
          .map((l, i) => ({ l, i }))
          .reverse()
          .slice(0, 5)
          .map(({ l, i }) => (
            <div key={i}>
              <span>{t('Lap {n}', { n: i + 1 })}</span>
              <span>{fmtSw(l)}</span>
            </div>
          ))}
      </div>
      <div className="cl-sw-hint">{sw.running ? `❚❚ ${t('Stop')}  ·  ● ${t('Lap')}` : total ? `▶ ${t('Resume')}  ·  ● ${t('Reset')}` : `▶ ${t('Start')}`}</div>
    </div>
  );
}

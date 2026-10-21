import { useMemo, useState } from 'react';
import { useLibrary } from '@/core/library/store';
import { usePlaylists } from '@/core/library/selectors';
import type { Alarm } from '@/core/types';
import { IconClose, IconPlus, IconTrash } from '../../icons';
import { IconAlarm, IconGlobe } from '../icons';
import { Confirm, Empty, Sheet } from '../ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SOUNDS = ['Radar', 'Beep', 'Chimes', 'Circuit', 'Marimba', 'Xylophone'];

const pad = (n: number) => String(n).padStart(2, '0');
const toInput = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const fromInput = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

function clock(m: number): string {
  const d = new Date(2000, 0, 1, Math.floor(m / 60), m % 60);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function repeatLabel(days: number[]): string {
  if (!days.length) return 'Never';
  const s = [...days].sort();
  if (s.length === 7) return 'Every day';
  if (s.join() === '1,2,3,4,5') return 'Weekdays';
  if (s.join() === '0,6') return 'Weekends';
  return s.map((d) => DAYS[d]).join(' ');
}

export function Alarms() {
  const alarms = useLibrary((s) => s.alarms);
  const clocks = useLibrary((s) => s.worldClocks);
  const [editing, setEditing] = useState<Alarm | 'new' | null>(null);
  const [addingClock, setAddingClock] = useState(false);
  const list = useMemo(() => [...alarms].sort((a, b) => a.time - b.time), [alarms]);

  return (
    <>
      <div className="section-title">
        <span className="grow">Alarms</span>
        <button className="btn small primary" onClick={() => setEditing('new')}>
          <IconPlus /> Add Alarm
        </button>
      </div>
      {list.length === 0 ? (
        <Empty icon={<IconAlarm />} title="No alarms">
          Alarms ring on whichever iPod is showing — with a tone or your favourite playlist.
        </Empty>
      ) : (
        <div className="list">
          {list.map((a) => (
            <div key={a.id} className="list-item lib-row lib-row-plain clickable" onClick={() => setEditing(a)}>
              <div className="li-text">
                <div className={`lib-alarm-time ${a.enabled ? '' : 'off'}`}>{clock(a.time)}</div>
                <div className="li-sub">
                  {a.label} · {repeatLabel(a.repeat)}
                </div>
              </div>
              <button
                className={`switch ${a.enabled ? 'on' : ''}`}
                role="switch"
                aria-checked={a.enabled}
                aria-label={a.enabled ? 'Turn off' : 'Turn on'}
                onClick={(e) => {
                  e.stopPropagation();
                  useLibrary.getState().upsertAlarm({ id: a.id, enabled: !a.enabled });
                }}
              />
            </div>
          ))}
        </div>
      )}

      <div className="section-title" style={{ marginTop: 22 }}>
        <span className="grow">World Clock</span>
        <button className="btn small" onClick={() => setAddingClock(true)}>
          <IconPlus /> Add City
        </button>
      </div>
      <div className="list">
        {clocks.map((c) => (
          <div key={c.id} className="list-item lib-row lib-row-icon">
            <IconGlobe style={{ color: 'var(--ui-text-3)', flex: 'none' }} />
            <div className="li-text">
              <div className="li-title">{c.city}</div>
              <div className="li-sub">{new Date().toLocaleTimeString(undefined, { timeZone: c.timeZone, hour: 'numeric', minute: '2-digit', weekday: 'short' })}</div>
            </div>
            <button className="lib-rbtn" aria-label={`Remove ${c.city}`} onClick={() => useLibrary.getState().removeWorldClock(c.id)}>
              <IconClose width={12} height={12} />
            </button>
          </div>
        ))}
      </div>

      {editing && <AlarmEditor alarm={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {addingClock && <ClockPicker onClose={() => setAddingClock(false)} />}
    </>
  );
}

function AlarmEditor({ alarm, onClose }: { alarm: Alarm | null; onClose: () => void }) {
  const playlists = usePlaylists();
  const [time, setTime] = useState(toInput(alarm?.time ?? 7 * 60));
  const [label, setLabel] = useState(alarm?.label ?? 'Alarm');
  const [repeat, setRepeat] = useState<number[]>(alarm?.repeat ?? []);
  const [sound, setSound] = useState(alarm?.sound ?? 'Radar');
  const [playlistId, setPlaylistId] = useState(alarm?.playlistId ?? '');
  const [confirm, setConfirm] = useState(false);

  const save = () => {
    useLibrary.getState().upsertAlarm({
      id: alarm?.id,
      time: fromInput(time),
      label: label.trim() || 'Alarm',
      repeat: [...repeat].sort(),
      sound,
      playlistId: playlistId || undefined,
      enabled: true,
    });
    onClose();
  };

  return (
    <Sheet
      title={alarm ? 'Edit Alarm' : 'Add Alarm'}
      onClose={onClose}
      actions={
        <button className="btn small primary" onClick={save}>
          Save
        </button>
      }
    >
      <div className="field">
        <label>Time</label>
        <input className="input" type="time" value={time} style={{ fontSize: 22, height: 48 }} onChange={(e) => setTime(e.target.value)} />
      </div>
      <div className="field">
        <label>Repeat · {repeatLabel(repeat)}</label>
        <div className="lib-days">
          {DAYS.map((d, i) => (
            <button key={d} className={repeat.includes(i) ? 'on' : ''} onClick={() => setRepeat((r) => (r.includes(i) ? r.filter((x) => x !== i) : [...r, i]))}>
              {d[0]}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Label</label>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div className="lib-grid2">
        <div className="field">
          <label>Sound</label>
          <select className="select" value={sound} disabled={!!playlistId} onChange={(e) => setSound(e.target.value)}>
            {SOUNDS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Or play a playlist</label>
          <select className="select" value={playlistId} onChange={(e) => setPlaylistId(e.target.value)}>
            <option value="">None (use sound)</option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {alarm && (
        <button className="btn danger" onClick={() => setConfirm(true)}>
          <IconTrash /> Delete Alarm
        </button>
      )}
      {confirm && alarm && (
        <Confirm
          title="Delete this alarm?"
          message={`${clock(alarm.time)} · ${alarm.label}`}
          confirm="Delete"
          danger
          onConfirm={() => {
            useLibrary.getState().removeAlarm(alarm.id);
            onClose();
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </Sheet>
  );
}

function ClockPicker({ onClose }: { onClose: () => void }) {
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone').filter((z) => z.includes('/'));
    } catch {
      return ['Asia/Bangkok', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney'];
    }
  }, []);
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const w = q.trim().toLowerCase().replace(/\s+/g, '_');
    return zones.filter((z) => !w || z.toLowerCase().includes(w)).slice(0, 80);
  }, [zones, q]);
  const add = (tz: string) => {
    useLibrary.getState().addWorldClock({ city: tz.split('/').pop()!.replace(/_/g, ' '), timeZone: tz });
    onClose();
  };
  return (
    <Sheet title="Add City" onClose={onClose}>
      <input className="input" autoFocus placeholder="Search cities (e.g. Paris, Chiang Mai → Bangkok)" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="list" style={{ marginTop: 10 }}>
        {matches.map((z) => (
          <div key={z} className="list-item lib-row lib-row-plain clickable" onClick={() => add(z)}>
            <div className="li-text">
              <div className="li-title">{z.split('/').pop()!.replace(/_/g, ' ')}</div>
              <div className="li-sub">{z.split('/')[0].replace(/_/g, ' ')}</div>
            </div>
            <span className="tiny">{new Date().toLocaleTimeString(undefined, { timeZone: z, hour: 'numeric', minute: '2-digit' })}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

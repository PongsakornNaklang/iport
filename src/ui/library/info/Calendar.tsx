import { useMemo, useRef, useState } from 'react';
import { useLibrary } from '@/core/library/store';
import { parseIcs } from '@/core/sources/ics';
import type { CalendarEvent } from '@/core/types';
import { IconPlus, IconTrash, IconUpload } from '../../icons';
import { toast } from '../../toast';
import { IconCalendar } from '../icons';
import { Confirm, Empty, Sheet } from '../ui';

const COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#0a84ff', '#5856d6', '#af52de', '#a2845e'];

const pad = (n: number) => String(n).padStart(2, '0');
const dateStr = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const timeStr = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const nextDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m || 1) - 1, (d || 1) + 1).getTime();
};
const fromLocal = (date: string, time = '00:00') => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, h || 0, mi || 0).getTime();
};

function dayLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

export function Calendar() {
  const events = useLibrary((s) => s.events);
  const [past, setPast] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => {
    const startOfToday = new Date(new Date().toDateString()).getTime();
    const list = events.filter((e) => (past ? e.end < startOfToday : e.end >= startOfToday)).sort((a, b) => (past ? b.start - a.start : a.start - b.start));
    const m = new Map<string, CalendarEvent[]>();
    for (const e of list.slice(0, 300)) {
      const k = new Date(e.start).toDateString();
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return [...m.values()];
  }, [events, past]);

  const importIcs = async (files: FileList | null) => {
    let n = 0;
    for (const f of Array.from(files ?? [])) {
      try {
        for (const e of parseIcs(await f.text())) {
          useLibrary.getState().upsertEvent(e);
          n++;
        }
      } catch {
        /* skip */
      }
    }
    toast(n ? `Imported ${n} event${n === 1 ? '' : 's'}` : 'No events found in that file');
  };

  return (
    <>
      <div className="lib-row-flex">
        <button className="btn primary" onClick={() => setEditing('new')}>
          <IconPlus /> New Event
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()} title="Import an .ics file exported from Google Calendar, iCloud or Outlook">
          <IconUpload /> Import .ics
        </button>
        <span className="grow" />
        {events.length > 0 && (
          <button className="btn small ghost" onClick={() => setPast((p) => !p)}>
            {past ? 'Upcoming' : 'Past'}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".ics,.ical,text/calendar"
        multiple
        hidden
        onChange={(e) => {
          void importIcs(e.target.files);
          e.target.value = '';
        }}
      />
      {events.length === 0 ? (
        <Empty icon={<IconCalendar />} title="No events">
          Add events here or import an .ics calendar. They appear in the iPod’s Calendars app.
        </Empty>
      ) : groups.length === 0 ? (
        <Empty title={past ? 'No past events' : 'Nothing coming up'} />
      ) : (
        groups.map((g) => (
          <div key={g[0].id}>
            <div className="lib-date-head">{dayLabel(g[0].start)}</div>
            <div className="list">
              {g.map((e) => (
                <div key={e.id} className="list-item lib-row clickable" onClick={() => setEditing(e)}>
                  <div className="lib-ev-time">{e.allDay ? 'all-day' : `${new Date(e.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}</div>
                  <span className="lib-ev-dot" style={{ background: e.color ?? COLORS[4] }} />
                  <div className="li-text">
                    <div className="li-title">{e.title}</div>
                    {e.location && <div className="li-sub">{e.location}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
      {events.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button className="btn small ghost" style={{ color: 'var(--ui-danger)' }} onClick={() => setConfirmAll(true)}>
            Delete all events…
          </button>
        </div>
      )}
      {editing && <EventEditor event={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {confirmAll && (
        <Confirm
          title={`Delete all ${events.length} events?`}
          message="They are removed from every iPod."
          confirm="Delete"
          danger
          onConfirm={() => events.forEach((e) => useLibrary.getState().removeEvent(e.id))}
          onClose={() => setConfirmAll(false)}
        />
      )}
    </>
  );
}

function EventEditor({ event, onClose }: { event: CalendarEvent | null; onClose: () => void }) {
  const now = new Date();
  const defStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1).getTime();
  const [title, setTitle] = useState(event?.title ?? '');
  const [allDay, setAllDay] = useState(!!event?.allDay);
  const [sd, setSd] = useState(dateStr(event?.start ?? defStart));
  const [st, setSt] = useState(timeStr(event?.start ?? defStart));
  // for all-day events `ed` is the last day (inclusive); `end` is stored as the next midnight
  const [ed, setEd] = useState(event?.allDay ? dateStr(Math.max(event.start, event.end - 1)) : dateStr(event?.end ?? defStart + 3600_000));
  const [et, setEt] = useState(timeStr(event?.end ?? defStart + 3600_000));
  const [location, setLocation] = useState(event?.location ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [color, setColor] = useState(event?.color ?? COLORS[4]);
  const [confirm, setConfirm] = useState(false);

  const save = () => {
    const start = allDay ? fromLocal(sd) : fromLocal(sd, st);
    let end = allDay ? nextDay(ed < sd ? sd : ed) : fromLocal(ed, et);
    if (end <= start) end = allDay ? nextDay(sd) : start + 3600_000;
    useLibrary.getState().upsertEvent({
      id: event?.id,
      title: title.trim() || 'New Event',
      start,
      end,
      allDay: allDay || undefined,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      color,
    });
    onClose();
  };

  return (
    <Sheet
      title={event ? 'Edit Event' : 'New Event'}
      onClose={onClose}
      actions={
        <button className="btn small primary" onClick={save}>
          Save
        </button>
      }
    >
      <div className="field">
        <label>Title</label>
        <input className="input" value={title} autoFocus={!event} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label>Location</label>
        <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div className="lib-row-flex" style={{ marginBottom: 12 }}>
        <span className="grow" style={{ fontSize: 13.5 }}>
          All-day
        </span>
        <button className={`switch ${allDay ? 'on' : ''}`} role="switch" aria-checked={allDay} onClick={() => setAllDay((a) => !a)} />
      </div>
      <div className="lib-grid2">
        <div className="field">
          <label>Starts</label>
          <input
            className="input"
            type="date"
            value={sd}
            onChange={(e) => {
              setSd(e.target.value);
              if (e.target.value > ed) setEd(e.target.value);
            }}
          />
        </div>
        {!allDay && (
          <div className="field">
            <label>&nbsp;</label>
            <input className="input" type="time" value={st} onChange={(e) => setSt(e.target.value)} />
          </div>
        )}
      </div>
      <div className="lib-grid2">
        <div className="field">
          <label>Ends</label>
          <input className="input" type="date" value={ed} min={sd} onChange={(e) => setEd(e.target.value)} />
        </div>
        {!allDay && (
          <div className="field">
            <label>&nbsp;</label>
            <input className="input" type="time" value={et} onChange={(e) => setEt(e.target.value)} />
          </div>
        )}
      </div>
      <div className="field">
        <label>Color</label>
        <div className="lib-color-row">
          {COLORS.map((c) => (
            <button key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>
      <div className="field">
        <label>Notes</label>
        <textarea className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {event && (
        <button className="btn danger" onClick={() => setConfirm(true)}>
          <IconTrash /> Delete Event
        </button>
      )}
      {confirm && event && (
        <Confirm
          title="Delete this event?"
          message={event.title}
          confirm="Delete"
          danger
          onConfirm={() => {
            useLibrary.getState().removeEvent(event.id);
            onClose();
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </Sheet>
  );
}

/**
 * Calendar (iOS 15): month grid with event dots, the selected day's events
 * underneath, event details and a New Event sheet.
 */
import { useMemo, useRef, useState } from 'react';
import { useLibrary } from '../../../core/library/store';
import { useSettings } from '../../../core/settings/store';
import { useNow } from '../../../core/util/hooks';
import type { CalendarEvent } from '../../../core/types';
import { claim, suppressNextClick, unitScale } from '../os/gesture';
import { Glyph } from '../os/glyphs';
import { os } from '../os/store';
import { Scroller } from '../os/Scroller';
import { Cell, NavStack, Page, Section, Sheet, SheetHeader, Switch, TextButton, TextInput, useNav } from '../os/ui';
import { sameDay } from './shared';

const COLORS = ['#ff3b30', '#ff9500', '#34c759', '#007aff', '#af52de', '#a2845e'];
const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function eventsOn(events: CalendarEvent[], d: Date): CalendarEvent[] {
  const a = dayStart(d).getTime();
  const b = a + 86400_000;
  return events.filter((e) => e.start < b && e.end > a).sort((x, y) => Number(!x.allDay) - Number(!y.allDay) || x.start - y.start);
}
function timeStr(t: number, use24h: boolean): string {
  return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: !use24h });
}
function toLocalInput(t: number, allDay?: boolean): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return allDay ? date : `${date}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function Calendar() {
  return (
    <div className="t7cal-root">
      <NavStack root={<MonthView />} rootTitle="Calendar" />
    </div>
  );
}

function MonthView() {
  const nav = useNav()!;
  const events = useLibrary((s) => s.events);
  const use24h = useSettings((s) => s.use24h);
  const today = useNow(60_000);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [sel, setSel] = useState(() => dayStart(today));
  const [adding, setAdding] = useState(false);
  const [slide, setSlide] = useState<'' | 'l' | 'r'>('');

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const n = Math.ceil((first.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7;
    return Array.from({ length: n }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);

  const go = (delta: number) => {
    setSlide(delta > 0 ? 'l' : 'r');
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
    window.setTimeout(() => setSlide(''), 320);
  };
  const dayEvents = eventsOn(events, sel);

  // horizontal swipe on the grid flips months
  const sw = useRef<{ x: number; y: number; k: number; id: number; on: boolean } | null>(null);

  return (
    <Page
      title={month.toLocaleDateString('en-US', { month: 'long' })}
      large={false}
      noScroll
      className="t7cal-page"
      left={
        <button className="t7-back" onClick={() => go(-12)}>
          <Glyph name="chevron.left" size={21} />
          <span>{month.getFullYear()}</span>
        </button>
      }
      titleView={<span />}
      right={
        <>
          <button className="t7-gbtn" aria-label="Search" onClick={() => os.toast('Search Events', 'magnifyingglass')}>
            <Glyph name="magnifyingglass" size={20} />
          </button>
          <button className="t7-gbtn" aria-label="Add Event" onClick={() => setAdding(true)}>
            <Glyph name="plus" size={22} />
          </button>
        </>
      }
      bottom={
        <>
          <TextButton
            onPress={() => {
              const t = dayStart(new Date());
              setMonth(new Date(t.getFullYear(), t.getMonth(), 1));
              setSel(t);
            }}
          >
            Today
          </TextButton>
          <TextButton onPress={() => os.toast('Calendar · On My iPod', 'calendar')}>Calendars</TextButton>
          <TextButton onPress={() => os.toast('No Invitations', 'tray')}>Inbox</TextButton>
        </>
      }
    >
      <div className="t7cal-head">
        <div className="t7cal-wd">
          {WD.map((d, i) => (
            <span key={i} className={i === 0 || i === 6 ? 'we' : ''}>
              {d}
            </span>
          ))}
        </div>
      </div>
      <div
        className={`t7cal-grid ${slide ? `slide-${slide}` : ''}`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          sw.current = { x: e.clientX, y: e.clientY, k: unitScale(e.currentTarget).kx, id: e.pointerId, on: false };
        }}
        onPointerMove={(e) => {
          const s = sw.current;
          if (!s || s.on) return;
          const dx = (e.clientX - s.x) * s.k;
          const dy = (e.clientY - s.y) * s.k;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5 && claim(e.pointerId, e.currentTarget)) {
            s.on = true;
            suppressNextClick();
            go(dx < 0 ? 1 : -1);
          }
        }}
        onPointerUp={() => (sw.current = null)}
      >
        <div className="t7cal-mname">{month.toLocaleDateString('en-US', { month: 'long', year: month.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })}</div>
        <div className="t7cal-days">
          {cells.map((d) => {
            const inMonth = d.getMonth() === month.getMonth();
            const isToday = sameDay(d, today);
            const isSel = sameDay(d, sel);
            const has = inMonth && eventsOn(events, d).length > 0;
            return (
              <button
                key={d.getTime()}
                className={`t7cal-day ${inMonth ? '' : 'out'} ${isToday ? 'today' : ''} ${isSel ? 'sel' : ''} ${d.getDay() === 0 || d.getDay() === 6 ? 'we' : ''}`}
                onClick={() => {
                  setSel(dayStart(d));
                  if (!inMonth) go(d < month ? -1 : 1);
                }}
              >
                <span className="n">{inMonth ? d.getDate() : ''}</span>
                {has && <i />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="t7cal-dayhead">{sel.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
      <Scroller className="t7cal-events">
        {dayEvents.map((e) => (
          <div key={e.id} className="t7cal-ev" onClick={() => nav.push(<EventDetail id={e.id} />, e.title)}>
            <div className="t7cal-ev-time">
              {e.allDay ? (
                <span>all-day</span>
              ) : (
                <>
                  <span>{timeStr(e.start, use24h)}</span>
                  <small>{timeStr(e.end, use24h)}</small>
                </>
              )}
            </div>
            <div className="t7cal-ev-bar" style={{ background: e.color ?? COLORS[0] }} />
            <div className="t7cal-ev-main">
              <div className="t">{e.title}</div>
              {e.location && <div className="s">{e.location}</div>}
            </div>
          </div>
        ))}
        {!dayEvents.length && <div className="t7cal-none">No Events</div>}
      </Scroller>
      <Sheet open={adding} onClose={() => setAdding(false)}>
        {adding && <EventEditor day={sel} onDone={() => setAdding(false)} />}
      </Sheet>
    </Page>
  );
}

function EventDetail({ id }: { id: string }) {
  const nav = useNav()!;
  const e = useLibrary((s) => s.events.find((x) => x.id === id));
  const use24h = useSettings((s) => s.use24h);
  const [edit, setEdit] = useState(false);
  if (!e) return <Page title="Event Details" large={false} />;
  const d = new Date(e.start);
  return (
    <Page title="Event Details" large={false} bg="grouped" right={<TextButton onPress={() => setEdit(true)}>Edit</TextButton>}>
      <div className="t7cal-detail">
        <div className="t">{e.title}</div>
        {e.location && <div className="l">{e.location}</div>}
        <div className="w">
          {d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          <br />
          {e.allDay ? 'all-day' : `from ${timeStr(e.start, use24h)} to ${timeStr(e.end, use24h)}`}
        </div>
      </div>
      <Section>
        <Cell title="Calendar" detail={<span className="t7cal-cal"><i style={{ background: e.color ?? COLORS[0] }} /> Calendar</span>} />
        <Cell title="Alert" detail="None" />
      </Section>
      {e.notes && (
        <Section header="Notes">
          <div className="t7cal-notes">{e.notes}</div>
        </Section>
      )}
      <Section>
        <Cell
          title="Delete Event"
          destructive
          center
          onPress={() =>
            os.alert({
              sheet: true,
              message: 'Are you sure you want to delete this event?',
              actions: [
                {
                  label: 'Delete Event',
                  style: 'destructive',
                  onPress: () => {
                    nav.pop();
                    window.setTimeout(() => useLibrary.getState().removeEvent(id), 400);
                  },
                },
                { label: 'Cancel', style: 'cancel' },
              ],
            })
          }
        />
      </Section>
      <Sheet open={edit} onClose={() => setEdit(false)}>
        {edit && <EventEditor event={e} day={d} onDone={() => setEdit(false)} />}
      </Sheet>
    </Page>
  );
}

function EventEditor({ event, day, onDone }: { event?: CalendarEvent; day: Date; onDone: () => void }) {
  const base = new Date(day);
  const now = new Date();
  base.setHours(sameDay(day, now) ? now.getHours() + 1 : 9, 0, 0, 0);
  const [title, setTitle] = useState(event?.title ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [allDay, setAllDay] = useState(!!event?.allDay);
  const [start, setStart] = useState(event?.start ?? base.getTime());
  const [end, setEnd] = useState(event?.end ?? base.getTime() + 3600_000);
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [color, setColor] = useState(event?.color ?? COLORS[3]);
  const parse = (v: string) => (v ? new Date(v.length <= 10 ? `${v}T00:00` : v).getTime() : NaN);
  const save = () => {
    let s = start;
    let e = Math.max(end, start + (allDay ? 0 : 60_000));
    if (allDay) {
      s = dayStart(new Date(start)).getTime();
      e = dayStart(new Date(end)).getTime() + 86400_000;
    }
    useLibrary.getState().upsertEvent({ id: event?.id, title: title.trim() || 'New Event', location: location.trim() || undefined, allDay, start: s, end: e, notes: notes.trim() || undefined, color });
    onDone();
  };
  return (
    <div className="t7c-editor">
      <SheetHeader
        left={<TextButton onPress={onDone}>Cancel</TextButton>}
        title={event ? 'Edit Event' : 'New Event'}
        right={
          <TextButton bold onPress={save}>
            {event ? 'Done' : 'Add'}
          </TextButton>
        }
      />
      <Scroller className="t7c-editor-scroll">
        <Section>
          <div className="t7cal-in">
            <TextInput value={title} onChange={setTitle} placeholder="Title" autoFocus={!event} />
          </div>
          <div className="t7cal-in">
            <TextInput value={location} onChange={setLocation} placeholder="Location or Video Call" />
          </div>
        </Section>
        <Section>
          <Cell title="All-day" accessory={<Switch on={allDay} onChange={setAllDay} />} />
          <Cell
            title="Starts"
            accessory={
              <input
                className="t7cal-dt"
                type={allDay ? 'date' : 'datetime-local'}
                value={toLocalInput(start, allDay)}
                onChange={(e) => {
                  const t = parse(e.target.value);
                  if (Number.isNaN(t)) return;
                  setEnd(end + (t - start));
                  setStart(t);
                }}
              />
            }
          />
          <Cell
            title="Ends"
            accessory={
              <input
                className="t7cal-dt"
                type={allDay ? 'date' : 'datetime-local'}
                value={toLocalInput(end, allDay)}
                onChange={(e) => {
                  const t = parse(e.target.value);
                  if (!Number.isNaN(t)) setEnd(t);
                }}
              />
            }
          />
        </Section>
        <Section>
          <Cell
            title="Calendar"
            accessory={
              <span className="t7cal-colors">
                {COLORS.map((c) => (
                  <button key={c} className={c === color ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
                ))}
              </span>
            }
          />
        </Section>
        <Section>
          <div className="t7cal-in tall">
            <TextInput value={notes} onChange={setNotes} placeholder="Notes" multiline />
          </div>
        </Section>
      </Scroller>
    </div>
  );
}

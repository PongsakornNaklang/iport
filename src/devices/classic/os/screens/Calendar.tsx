import { useMemo, useState } from 'react';
import { useLibrary } from '../../../../core/library/store';
import { useDeviceSetting, useSettings } from '../../../../core/settings/store';
import type { CalendarEvent } from '../../../../core/types';
import { formatClock } from '../../../../core/util/format';
import { useInput, useOS, useTitle } from '../core';
import { cycleRow } from '../common';
import { ListView, type Row } from '../ListView';
import { locale, t } from '../i18n';

/** a Sunday-first week (1 Jan 2023 was a Sunday) */
const WEEK = [0, 1, 2, 3, 4, 5, 6].map((i) => new Date(2023, 0, 1 + i));
/** the one-letter day names over the month, in the chosen language */
const narrowDay = (d: Date) => d.toLocaleDateString(locale(), { weekday: 'narrow' });

const DAY_MS = 86400000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function eventsOn(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const a = startOfDay(day).getTime();
  const b = a + DAY_MS;
  return events.filter((e) => e.start < b && e.end > a).sort((x, y) => x.start - y.start);
}

export function CalendarsMenu() {
  const os = useOS();
  const [alerts, setAlerts] = useDeviceSetting<string>(os.modelId, 'calendarAlerts', 'Beep');
  const rows: Row[] = [
    { key: 'all', label: t('All Calendars'), chevron: true, onSelect: () => os.nav.push({ title: t('Calendar'), el: <MonthView /> }) },
    { key: 'todo', label: t("To Do's"), chevron: true, onSelect: () => os.nav.push({ title: t("To Do's"), el: <ListView rows={[]} empty={t("No To Do's")} /> }) },
    cycleRow('Alarms', alerts, ['Beep', 'None'].map((v) => ({ value: v, label: v })), setAlerts),
  ];
  return <ListView rows={rows} />;
}

export function MonthView() {
  const os = useOS();
  const events = useLibrary((s) => s.events);
  const [day, setDay] = useState(() => startOfDay(new Date()));
  useTitle(day.toLocaleDateString(locale(), { month: 'long', year: 'numeric' }));

  useInput((e) => {
    if (e.type === 'scroll') {
      setDay((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + e.steps));
      return true;
    }
    if (e.type === 'click' && (e.button === 'next' || e.button === 'prev')) {
      const dir = e.button === 'next' ? 1 : -1;
      setDay((d) => new Date(d.getFullYear(), d.getMonth() + dir, Math.min(d.getDate(), 28)));
      return true;
    }
    if (e.type === 'click' && e.button === 'select') {
      const label = day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      os.nav.push({ title: label, el: <DayEvents day={day.getTime()} /> });
      return true;
    }
    return false;
  });

  const first = new Date(day.getFullYear(), day.getMonth(), 1);
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  const today = startOfDay(new Date()).getTime();
  const weeks = Math.ceil((first.getDay() + new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate()) / 7);
  const cellH = Math.floor((os.height - os.hdr - 16) / weeks);
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const inMonth = d.getMonth() === day.getMonth();
    const has = inMonth && eventsOn(events, d).length > 0;
    const isSel = d.getTime() === day.getTime();
    cells.push(
      <div
        key={i}
        className={`cl-cal-cell ${inMonth ? '' : 'out'} ${d.getTime() === today ? 'today' : ''} ${isSel ? 'cl-sel' : ''}`}
        style={{ height: cellH }}
      >
        <span>{d.getDate()}</span>
        {has && <i className="cl-cal-mark" />}
      </div>,
    );
  }
  return (
    <div className="cl-cal">
      <div className="cl-cal-head">
        {WEEK.map((d) => narrowDay(d)).map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="cl-cal-grid">{cells}</div>
    </div>
  );
}

function DayEvents({ day }: { day: number }) {
  const os = useOS();
  const events = useLibrary((s) => s.events);
  const use24h = useSettings((s) => s.use24h);
  const rows = useMemo<Row[]>(
    () =>
      eventsOn(events, new Date(day)).map((e) => ({
        key: e.id,
        label: e.title,
        detail: e.allDay ? t('all-day') : formatClock(new Date(e.start), use24h),
        chevron: true,
        onSelect: () => os.nav.push({ title: t('Event'), el: <EventView id={e.id} /> }),
      })),
    [events, day, use24h, os],
  );
  return <ListView rows={rows} empty={t('No Events')} />;
}

function EventView({ id }: { id: string }) {
  const e = useLibrary((s) => s.events.find((x) => x.id === id));
  const use24h = useSettings((s) => s.use24h);
  if (!e) return <ListView rows={[]} empty={t('Event deleted')} />;
  const s = new Date(e.start);
  const en = new Date(e.end);
  return (
    <div className="cl-event">
      <div className="cl-event-title">{e.title}</div>
      <div className="cl-event-line">{s.toLocaleDateString(locale(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
      <div className="cl-event-line">{e.allDay ? t('All day') : `${formatClock(s, use24h)} – ${formatClock(en, use24h)}`}</div>
      {e.location && <div className="cl-event-line">{e.location}</div>}
      {e.notes && <div className="cl-event-notes">{e.notes}</div>}
    </div>
  );
}

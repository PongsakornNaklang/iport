/**
 * iCalendar (.ics) import: VEVENTs with all-day / UTC / floating / TZID
 * times, DURATION, and simple recurrence (DAILY / WEEKLY+BYDAY / MONTHLY /
 * YEARLY with INTERVAL, COUNT, UNTIL) expanded into a window around now.
 */
import type { CalendarEvent } from '../types';

export type ParsedEvent = Omit<CalendarEvent, 'id'>;

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function unfold(text: string): string[] {
  const out: string[] = [];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) out[out.length - 1] += line.slice(1);
    else if (line.trim()) out.push(line);
  }
  return out;
}

function parseLine(line: string): Prop | null {
  let inQ = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQ = !inQ;
    else if (line[i] === ':' && !inQ) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const head = line.slice(0, colon).split(';');
  const params: Record<string, string> = {};
  for (const p of head.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/"/g, '');
  }
  return { name: head[0].toUpperCase(), params, value: line.slice(colon + 1) };
}

function unescapeText(s: string): string {
  return s.replace(/\\([nN,;\\])/g, (_m, c: string) => (c === 'n' || c === 'N' ? '\n' : c)).trim();
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffset(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) if (p.type !== 'literal') parts[p.type] = parseInt(p.value, 10);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Wall-clock time in an IANA zone → epoch ms. */
export function zonedTime(y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string): number {
  const guess = Date.UTC(y, mo, d, h, mi, s);
  try {
    const off1 = tzOffset(guess, timeZone);
    const off2 = tzOffset(guess - off1, timeZone);
    return guess - off2;
  } catch {
    return new Date(y, mo, d, h, mi, s).getTime();
  }
}

/** Windows zone names some exporters (Outlook) use, mapped to IANA. */
const WINDOWS_TZ: Record<string, string> = {
  'SE Asia Standard Time': 'Asia/Bangkok',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'GMT Standard Time': 'Europe/London',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Romance Standard Time': 'Europe/Paris',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'Korea Standard Time': 'Asia/Seoul',
  'Singapore Standard Time': 'Asia/Singapore',
  'China Standard Time': 'Asia/Shanghai',
  'India Standard Time': 'Asia/Kolkata',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  UTC: 'UTC',
};

export function parseIcsDate(p: Prop): { time: number; allDay: boolean } | null {
  const v = p.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [y, mo, d] = [parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)];
  if (!m[4] || p.params.VALUE === 'DATE') return { time: new Date(y, mo, d).getTime(), allDay: true };
  const [h, mi, s] = [parseInt(m[4], 10), parseInt(m[5], 10), parseInt(m[6] ?? '0', 10)];
  if (m[7]) return { time: Date.UTC(y, mo, d, h, mi, s), allDay: false };
  const tzid = p.params.TZID ? (WINDOWS_TZ[p.params.TZID] ?? p.params.TZID.replace(/^\/[^/]+\//, '')) : undefined;
  if (tzid) return { time: zonedTime(y, mo, d, h, mi, s, tzid), allDay: false };
  return { time: new Date(y, mo, d, h, mi, s).getTime(), allDay: false };
}

/** "P1DT2H30M", "PT45M", "-P1W" → ms */
export function parseDuration(v: string): number | null {
  const m = v.trim().match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const n = (i: number) => parseInt(m[i] ?? '0', 10);
  const ms = (((n(2) * 7 + n(3)) * 24 + n(4)) * 60 + n(5)) * 60_000 + n(6) * 1000;
  return m[1] === '-' ? -ms : ms;
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

interface Rule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count?: number;
  until?: number;
  byDay?: number[];
}

function parseRule(v: string): Rule | null {
  const parts: Record<string, string> = {};
  for (const kv of v.split(';')) {
    const [k, val] = kv.split('=');
    if (k && val) parts[k.toUpperCase()] = val;
  }
  const freq = parts.FREQ as Rule['freq'];
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null;
  const rule: Rule = { freq, interval: Math.max(1, parseInt(parts.INTERVAL ?? '1', 10) || 1) };
  if (parts.COUNT) rule.count = parseInt(parts.COUNT, 10);
  if (parts.UNTIL) rule.until = parseIcsDate({ name: 'UNTIL', params: {}, value: parts.UNTIL })?.time;
  if (parts.BYDAY && freq === 'WEEKLY') {
    const days = parts.BYDAY.split(',').map((d) => DAY_CODES.indexOf(d.replace(/^[+-]?\d+/, '')));
    if (days.every((d) => d >= 0)) rule.byDay = days;
  }
  return rule;
}

/** Occurrence start times (local wall-clock arithmetic, so DST keeps the hour). */
function expand(start: number, rule: Rule, from: number, to: number, maxOut = 120): number[] {
  const out: number[] = [];
  const s = new Date(start);
  let produced = 0;
  const limit = (t: number) => (rule.until !== undefined && t > rule.until + 999) || (rule.count !== undefined && produced >= rule.count) || t > to;
  for (let k = 0; k < 5000 && out.length < maxOut; k++) {
    let candidates: Date[];
    if (rule.freq === 'WEEKLY' && rule.byDay?.length) {
      const weekStart = new Date(s.getFullYear(), s.getMonth(), s.getDate() - s.getDay() + k * 7 * rule.interval, s.getHours(), s.getMinutes(), s.getSeconds());
      candidates = [...rule.byDay].sort().map((d) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + d, s.getHours(), s.getMinutes(), s.getSeconds()));
      candidates = candidates.filter((c) => c.getTime() >= start);
    } else {
      const n = k * rule.interval;
      const c =
        rule.freq === 'DAILY'
          ? new Date(s.getFullYear(), s.getMonth(), s.getDate() + n, s.getHours(), s.getMinutes(), s.getSeconds())
          : rule.freq === 'WEEKLY'
            ? new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7 * n, s.getHours(), s.getMinutes(), s.getSeconds())
            : rule.freq === 'MONTHLY'
              ? new Date(s.getFullYear(), s.getMonth() + n, s.getDate(), s.getHours(), s.getMinutes(), s.getSeconds())
              : new Date(s.getFullYear() + n, s.getMonth(), s.getDate(), s.getHours(), s.getMinutes(), s.getSeconds());
      // skip Feb 30 style overflows
      candidates = c.getDate() === s.getDate() || rule.freq === 'DAILY' || rule.freq === 'WEEKLY' ? [c] : [];
    }
    let stop = false;
    for (const c of candidates) {
      const t = c.getTime();
      if (limit(t)) {
        stop = true;
        break;
      }
      produced++;
      if (t >= from) out.push(t);
    }
    if (stop) break;
  }
  return out;
}

export interface IcsOptions {
  /** recurring events are expanded between these times (default: 30 days ago … 1 year ahead) */
  from?: number;
  to?: number;
}

export function parseIcs(text: string, opts: IcsOptions = {}): ParsedEvent[] {
  const now = Date.now();
  const from = opts.from ?? now - 30 * 86400_000;
  const to = opts.to ?? now + 365 * 86400_000;
  const events: ParsedEvent[] = [];
  let cur: Prop[] | null = null;
  let depth = 0; // skip nested VALARM etc.
  for (const line of unfold(text)) {
    const up = line.trim().toUpperCase();
    if (up === 'BEGIN:VEVENT') {
      cur = [];
      depth = 0;
      continue;
    }
    if (!cur) continue;
    if (up.startsWith('BEGIN:')) {
      depth++;
      continue;
    }
    if (up.startsWith('END:') && up !== 'END:VEVENT') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (up === 'END:VEVENT') {
      events.push(...toEvents(cur, from, to));
      cur = null;
      continue;
    }
    if (depth > 0) continue;
    const p = parseLine(line);
    if (p) cur.push(p);
  }
  return events.sort((a, b) => a.start - b.start);
}

function toEvents(props: Prop[], from: number, to: number): ParsedEvent[] {
  const get = (n: string) => props.find((p) => p.name === n);
  const ds = get('DTSTART');
  const start = ds ? parseIcsDate(ds) : null;
  if (!start) return [];
  if (/^CANCELLED$/i.test(get('STATUS')?.value ?? '')) return [];
  const de = get('DTEND');
  const dur = get('DURATION');
  let end = de ? parseIcsDate(de)?.time : undefined;
  if (end === undefined && dur) {
    const d = parseDuration(dur.value);
    if (d !== null) end = start.time + d;
  }
  if (end === undefined || end < start.time) end = start.allDay ? start.time + 86400_000 : start.time + 3600_000;
  const length = end - start.time;
  const base: ParsedEvent = {
    title: unescapeText(get('SUMMARY')?.value ?? '') || 'Untitled Event',
    start: start.time,
    end,
    allDay: start.allDay || undefined,
    location: unescapeText(get('LOCATION')?.value ?? '') || undefined,
    notes: unescapeText(get('DESCRIPTION')?.value ?? '').slice(0, 2000) || undefined,
  };
  const rr = get('RRULE');
  const rule = rr ? parseRule(rr.value) : null;
  if (!rule) return [base];
  const excluded = new Set(
    props
      .filter((p) => p.name === 'EXDATE')
      .flatMap((p) => p.value.split(',').map((v) => parseIcsDate({ ...p, value: v })?.time))
      .filter((t): t is number => t !== undefined),
  );
  return expand(start.time, rule, from, to)
    .filter((t) => !excluded.has(t))
    .map((t) => ({ ...base, start: t, end: t + length }));
}

/** Identity used to skip events that are already in the library when an .ics is imported again. */
export function eventKey(e: Pick<CalendarEvent, 'title' | 'start' | 'end'>): string {
  return `${e.title.toLowerCase().replace(/\s+/g, ' ').trim()}|${e.start}|${e.end}`;
}

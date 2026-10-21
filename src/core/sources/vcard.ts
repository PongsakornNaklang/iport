/**
 * vCard (.vcf) import — versions 2.1, 3.0 and 4.0 as exported by Apple
 * Contacts, Google Contacts and Android. Pure string parsing.
 */
import type { Contact } from '../types';

export type ParsedContact = Omit<Contact, 'id'>;

interface Prop {
  name: string;
  params: Record<string, string[]>;
  value: string;
}

/** Undo RFC line folding (CRLF + space/tab) and vCard 2.1 quoted-printable soft breaks. */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n?/g, '\n').split('\n');
  const lines: string[] = [];
  for (const line of raw) {
    const prev = lines.length - 1;
    if ((line.startsWith(' ') || line.startsWith('\t')) && prev >= 0) lines[prev] += line.slice(1);
    else if (prev >= 0 && /ENCODING=QUOTED-PRINTABLE/i.test(lines[prev]) && lines[prev].endsWith('=')) lines[prev] = lines[prev].slice(0, -1) + line;
    else lines.push(line);
  }
  return lines.filter((l) => l.trim());
}

function decodeQP(s: string, charset = 'utf-8'): string {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=' && /^[0-9A-F]{2}$/i.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(s.charCodeAt(i) & 0xff);
  }
  try {
    return new TextDecoder(charset).decode(new Uint8Array(bytes));
  } catch {
    return new TextDecoder().decode(new Uint8Array(bytes));
  }
}

function unescapeText(s: string): string {
  return s.replace(/\\([nN,;\\:])/g, (_m, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

/** Split on unescaped `sep`. */
function splitEsc(s: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      cur += s[i] + s[i + 1];
      i++;
    } else if (s[i] === sep) {
      out.push(cur);
      cur = '';
    } else cur += s[i];
  }
  out.push(cur);
  return out;
}

function parseLine(line: string): Prop | null {
  // the value starts at the first ":" that is not inside a quoted parameter
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
  const head = splitEsc(line.slice(0, colon), ';');
  const name = head[0].replace(/^item\d+\./i, '').toUpperCase();
  const params: Record<string, string[]> = {};
  for (const p of head.slice(1)) {
    const eq = p.indexOf('=');
    const k = (eq < 0 ? 'TYPE' : p.slice(0, eq)).toUpperCase();
    const v = eq < 0 ? p : p.slice(eq + 1);
    (params[k] ??= []).push(...v.replace(/"/g, '').split(',').map((x) => x.trim()).filter(Boolean));
  }
  let value = line.slice(colon + 1);
  if ((params.ENCODING ?? []).some((e) => /quoted-printable/i.test(e))) value = decodeQP(value, params.CHARSET?.[0]);
  return { name, params, value };
}

const LABELS: Record<string, string> = {
  cell: 'mobile',
  mobile: 'mobile',
  iphone: 'iPhone',
  home: 'home',
  work: 'work',
  main: 'main',
  fax: 'fax',
  pager: 'pager',
  other: 'other',
  internet: '',
  pref: '',
  voice: '',
};

function labelOf(p: Prop): string {
  const types = (p.params.TYPE ?? []).map((t) => t.toLowerCase());
  const named = types.map((t) => LABELS[t] ?? t).filter(Boolean);
  if (types.includes('fax')) return named.includes('work') ? 'work fax' : named.includes('home') ? 'home fax' : 'fax';
  return named[0] ?? (p.name === 'EMAIL' ? 'home' : 'mobile');
}

function birthday(v: string): string | undefined {
  const s = v.trim();
  let m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^--(\d{2})-?(\d{2})$/); // no year (vCard 4)
  if (m) return `--${m[1]}-${m[2]}`; // ISO 8601 "no year" form
  return undefined;
}

export function parseVCards(text: string): ParsedContact[] {
  const out: ParsedContact[] = [];
  let cur: Prop[] | null = null;
  for (const line of unfold(text)) {
    const up = line.trim().toUpperCase();
    if (up === 'BEGIN:VCARD') {
      cur = [];
      continue;
    }
    if (up === 'END:VCARD') {
      if (cur) {
        const c = toContact(cur);
        if (c) out.push(c);
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const p = parseLine(line);
    if (p) cur.push(p);
  }
  return out;
}

function toContact(props: Prop[]): ParsedContact | null {
  const get = (n: string) => props.find((p) => p.name === n);
  const c: ParsedContact = { firstName: '', lastName: '', phones: [], emails: [] };
  const n = get('N');
  if (n) {
    const [last = '', first = '', middle = ''] = splitEsc(n.value, ';').map((x) => unescapeText(x).trim());
    c.lastName = last;
    c.firstName = [first, middle].filter(Boolean).join(' ');
  }
  const fn = get('FN') ? unescapeText(get('FN')!.value).trim() : '';
  if (!c.firstName && !c.lastName && fn) {
    const parts = fn.split(/\s+/);
    if (parts.length > 1) {
      c.lastName = parts.pop()!;
      c.firstName = parts.join(' ');
    } else c.firstName = fn;
  }
  const org = get('ORG');
  if (org) c.company = splitEsc(org.value, ';').map((x) => unescapeText(x).trim()).filter(Boolean).join(', ') || undefined;
  for (const p of props) {
    const v = unescapeText(p.value).trim();
    if (!v) continue;
    if (p.name === 'TEL') c.phones.push({ label: labelOf(p), value: v.replace(/^tel:/i, '') });
    else if (p.name === 'EMAIL') c.emails.push({ label: labelOf(p), value: v.replace(/^mailto:/i, '') });
  }
  const adr = get('ADR');
  if (adr) {
    const [, , street = '', city = '', region = '', zip = '', country = ''] = splitEsc(adr.value, ';').map((x) => unescapeText(x).trim());
    const line2 = [city, region, zip].filter(Boolean).join(' ');
    c.address = [street, line2, country].filter(Boolean).join('\n') || undefined;
  }
  const bday = get('BDAY');
  if (bday) c.birthday = birthday(bday.value);
  const note = get('NOTE');
  if (note) c.notes = unescapeText(note.value).trim() || undefined;
  if (!c.firstName && !c.lastName && !c.company && !c.phones.length && !c.emails.length) return null;
  return c;
}

/** Identity used to skip contacts that are already in the library when a .vcf is imported again. */
export function contactKey(c: Pick<Contact, 'firstName' | 'lastName' | 'company' | 'phones' | 'emails'>): string {
  const norm = (s: string | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const digits = (s: string) => s.replace(/[^\d+]/g, '');
  const name = norm(`${c.firstName} ${c.lastName}`) || norm(c.company);
  const first = c.phones[0] ? digits(c.phones[0].value) : norm(c.emails[0]?.value);
  return `${name}|${first}`;
}

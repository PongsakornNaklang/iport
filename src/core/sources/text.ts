/** Small string helpers used by the source parsers (no DOM needed). */

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  copy: '©',
  reg: '®',
  trade: '™',
  middot: '·',
  bull: '•',
  eacute: 'é',
  egrave: 'è',
  aacute: 'á',
  agrave: 'à',
  oacute: 'ó',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
  szlig: 'ß',
  ntilde: 'ñ',
  ccedil: 'ç',
  deg: '°',
  euro: '€',
  pound: '£',
};

/** Decode XML/HTML character references (`&amp;`, `&#39;`, `&#x1F600;`, common named ones). */
export function decodeEntities(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return m;
      try {
        return String.fromCodePoint(code);
      } catch {
        return m;
      }
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** HTML → plain text with paragraph breaks kept. */
export function stripHtml(html: string | undefined, maxLength = 4000): string {
  if (!html) return '';
  let s = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s)
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s.length > maxLength ? `${s.slice(0, maxLength - 1)}…` : s;
}

/**
 * "1:02:03" → 3723, "3:45" → 225, "225.4" → 225.4, 90 → 90.
 * Returns undefined for anything unparseable or non-positive.
 */
export function parseClock(v: string | number | undefined | null): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : undefined;
  const s = v.trim();
  if (!s) return undefined;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    return n > 0 ? n : undefined;
  }
  if (/^\d+(:\d{1,2}){1,2}(\.\d+)?$/.test(s)) {
    const n = s.split(':').reduce((acc, p) => acc * 60 + parseFloat(p), 0);
    return n > 0 ? n : undefined;
  }
  return undefined;
}

/** "say-my-name" → "Say My Name" */
export function prettifySlug(slug: string): string {
  let s = slug;
  try {
    s = decodeURIComponent(slug);
  } catch {
    /* keep raw */
  }
  return s
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)(\p{Ll})/gu, (_m, sp: string, c: string) => sp + c.toUpperCase());
}

/** File name of a URL path without extension: ".../01%20Song.mp3?x" → "01 Song" */
export function fileTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop() ?? u.hostname;
    return decodeURIComponent(last).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ').trim() || u.hostname;
  } catch {
    return url;
  }
}

/** Parse a year out of "2019-05-02", "c. 1928", 1999… */
export function parseYear(v: unknown): number | undefined {
  if (typeof v === 'number') return v > 1000 && v < 3000 ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const m = v.match(/\b(1[0-9]{3}|2[0-9]{3})\b/);
  return m ? parseInt(m[1], 10) : undefined;
}

export function firstString(v: unknown): string | undefined {
  if (Array.isArray(v)) return firstString(v[0]);
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number') return String(v);
  return undefined;
}

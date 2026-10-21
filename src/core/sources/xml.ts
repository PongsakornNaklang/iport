/**
 * A small, forgiving XML parser (string → element tree). Enough for RSS /
 * Atom feeds, and it runs anywhere (tests run in Node, where there is no
 * DOMParser). Not validating: unknown entities are kept, unclosed tags are
 * closed at their parent's end.
 */
import { decodeEntities } from './text';

export interface XmlEl {
  /** tag name as written, e.g. "itunes:image" */
  name: string;
  attrs: Record<string, string>;
  children: XmlEl[];
  /** concatenated direct text + CDATA (entities decoded) */
  text: string;
}

const NAME = /[A-Za-z_:][-A-Za-z0-9_:.]*/y;
const ATTR = /\s*([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>/=`]+)))?/y;

export function parseXml(src: string): XmlEl {
  const root: XmlEl = { name: '#document', attrs: {}, children: [], text: '' };
  const stack: XmlEl[] = [root];
  let i = src.charCodeAt(0) === 0xfeff ? 1 : 0;
  const n = src.length;
  const top = () => stack[stack.length - 1];

  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) {
      top().text += decodeEntities(src.slice(i));
      break;
    }
    if (lt > i) top().text += decodeEntities(src.slice(i, lt));
    i = lt;

    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i + 9);
      top().text += src.slice(i + 9, end < 0 ? n : end);
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (src.startsWith('<?', i)) {
      const end = src.indexOf('?>', i + 2);
      i = end < 0 ? n : end + 2;
      continue;
    }
    if (src.startsWith('<!', i)) {
      // DOCTYPE, possibly with an internal subset [...]
      let j = i + 2;
      let depth = 0;
      while (j < n) {
        const c = src[j];
        if (c === '[') depth++;
        else if (c === ']') depth--;
        else if (c === '>' && depth <= 0) break;
        j++;
      }
      i = j + 1;
      continue;
    }
    if (src[i + 1] === '/') {
      NAME.lastIndex = i + 2;
      const m = NAME.exec(src);
      const close = src.indexOf('>', i);
      i = close < 0 ? n : close + 1;
      if (!m) continue;
      const name = m[0];
      // pop to the matching open tag (tolerate unclosed children)
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].name === name) {
          stack.length = k;
          break;
        }
      }
      continue;
    }
    NAME.lastIndex = i + 1;
    const m = NAME.exec(src);
    if (!m) {
      // a stray "<" in text
      top().text += '<';
      i++;
      continue;
    }
    const el: XmlEl = { name: m[0], attrs: {}, children: [], text: '' };
    let j = NAME.lastIndex;
    for (;;) {
      ATTR.lastIndex = j;
      const a = ATTR.exec(src);
      if (!a || a.index !== j || !a[1]) break;
      el.attrs[a[1]] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? '');
      j = ATTR.lastIndex;
    }
    const close = src.indexOf('>', j);
    const selfClosing = close > 0 && src[close - 1] === '/';
    i = close < 0 ? n : close + 1;
    top().children.push(el);
    if (!selfClosing) stack.push(el);
  }
  return root;
}

const lc = (s: string) => s.toLowerCase();

/** First direct child with this (case-insensitive) tag name. */
export function child(el: XmlEl | undefined, name: string): XmlEl | undefined {
  if (!el) return undefined;
  const want = lc(name);
  return el.children.find((c) => lc(c.name) === want);
}

export function childrenNamed(el: XmlEl | undefined, name: string): XmlEl[] {
  if (!el) return [];
  const want = lc(name);
  return el.children.filter((c) => lc(c.name) === want);
}

/** Trimmed text of the first child among `names` that has any. */
export function textOf(el: XmlEl | undefined, ...names: string[]): string | undefined {
  for (const n of names) {
    const t = child(el, n)?.text.trim();
    if (t) return t;
  }
  return undefined;
}

export function attrOf(el: XmlEl | undefined, name: string, attr: string): string | undefined {
  const c = child(el, name);
  if (!c) return undefined;
  const want = lc(attr);
  for (const [k, v] of Object.entries(c.attrs)) if (lc(k) === want && v.trim()) return v.trim();
  return undefined;
}

/** Depth-first search for the first element with this name. */
export function find(el: XmlEl, name: string): XmlEl | undefined {
  const want = lc(name);
  const visit = (e: XmlEl): XmlEl | undefined => {
    if (lc(e.name) === want) return e;
    for (const c of e.children) {
      const r = visit(c);
      if (r) return r;
    }
    return undefined;
  };
  return visit(el);
}

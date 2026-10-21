/** Pull JSON blobs that pages embed in <script> tags (pure, testable). */

/** Decode a JavaScript single/double-quoted string body (handles \xHH, \uHHHH, \n …). */
export function decodeJsString(s: string): string {
  return s.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|u\{[0-9a-fA-F]+\}|.)/g, (_m, e: string) => {
    if (e[0] === 'x') return String.fromCharCode(parseInt(e.slice(1), 16));
    if (e[0] === 'u') return String.fromCodePoint(parseInt(e.replace(/[u{}]/g, ''), 16));
    return ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' } as Record<string, string>)[e] ?? e;
  });
}

/**
 * Find `marker` and parse the JSON object/array literal that follows it,
 * matching braces while respecting strings. Also handles the
 * `= '…escaped JSON…'` form some pages use.
 */
export function extractJsonAfter(html: string, marker: string | RegExp): unknown | null {
  let from: number;
  if (typeof marker === 'string') {
    const i = html.indexOf(marker);
    if (i < 0) return null;
    from = i + marker.length;
  } else {
    const re = new RegExp(marker.source, marker.flags.replace('g', ''));
    const m = re.exec(html);
    if (!m) return null;
    from = m.index + m[0].length;
  }
  // skip whitespace
  while (from < html.length && /\s/.test(html[from])) from++;
  const open = html[from];
  if (open === "'" || open === '"') {
    // JSON inside a JS string literal
    let j = from + 1;
    while (j < html.length && html[j] !== open) j += html[j] === '\\' ? 2 : 1;
    try {
      return JSON.parse(decodeJsString(html.slice(from + 1, j)));
    } catch {
      return null;
    }
  }
  if (open !== '{' && open !== '[') return null;
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  for (let i = from; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(from, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

type Obj = Record<string, unknown>;

/** Visit every object under `root` that is the value of one of `keys`. */
export function collect(root: unknown, keys: string[], limit = 2000): { key: string; value: Obj }[] {
  const want = new Set(keys);
  const out: { key: string; value: Obj }[] = [];
  const stack: unknown[] = [root];
  let seen = 0;
  while (stack.length && out.length < limit && seen < 2_000_000) {
    const node = stack.pop();
    seen++;
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) stack.push(node[i]);
      continue;
    }
    const entries = Object.entries(node as Obj);
    for (let i = entries.length - 1; i >= 0; i--) {
      const [k, v] = entries[i];
      if (want.has(k) && v && typeof v === 'object' && !Array.isArray(v)) out.push({ key: k, value: v as Obj });
      else stack.push(v);
    }
  }
  // stack order is depth-first left-to-right; collected order matches document order
  return out;
}

/** Safe nested property access: dig(o, 'a', 0, 'b') */
export function dig(o: unknown, ...path: (string | number)[]): unknown {
  let cur = o;
  for (const p of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[p];
  }
  return cur;
}

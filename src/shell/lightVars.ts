/**
 * The light and view the stage hands the device every frame (--lx, --vx…).
 *
 * Set on the turning element, these would be inherited by everything inside
 * the iPod, and a custom property that changes on an ancestor makes the
 * browser recompute the style of every element below it: thousands of them
 * (a whole iOS Home Screen, a case's hundreds of pieces), every frame, just
 * for the few sheens and edges that read them. So they are written straight
 * onto the elements that use them instead: whatever the stylesheets' rules
 * that mention one of them match, and elements whose own style mentions one.
 * The rest of the iPod is left alone.
 */

const NAMES = ['--rx', '--ry', '--lx', '--ly', '--elx', '--ely', '--vx', '--vy', '--vz'] as const;
export type LightVar = (typeof NAMES)[number];

/** a rule or inline style that reads `name` */
const reads = (name: string) => new RegExp(`var\\(\\s*${name}\\s*[,)]`);
const READS = Object.fromEntries(NAMES.map((n) => [n, reads(n)])) as Record<LightVar, RegExp>;
/** pseudo-elements: their element is the one to give the values to */
const PSEUDO = /::?(?:before|after|first-line|first-letter|marker|placeholder|selection|backdrop|-webkit-[\w-]+|-moz-[\w-]+)/g;

function collect(rules: CSSRuleList, out: Record<LightVar, Set<string>>) {
  for (const r of Array.from(rules)) {
    if (r instanceof CSSStyleRule) {
      const css = r.style.cssText;
      if (css.includes('var(')) {
        const names = NAMES.filter((n) => READS[n].test(css));
        if (names.length) {
          for (const part of r.selectorText.split(',')) {
            const sel = part.replace(PSEUDO, '').trim();
            if (sel) for (const n of names) out[n].add(sel);
          }
        }
      }
      if (r.cssRules?.length) collect(r.cssRules, out);
    } else if ('cssRules' in r && (r as CSSGroupingRule).cssRules) {
      collect((r as CSSGroupingRule).cssRules, out);
    }
  }
}

let sheetsSeen = -1;
let selectors = Object.fromEntries(NAMES.map((n) => [n, `[style*="var(${n}"]`])) as Record<LightVar, string>;

/** for each value, the elements that read it (recomputed when stylesheets are added: a device's CSS loads with it) */
function readerSelectors(): Record<LightVar, string> {
  const sheets = document.styleSheets;
  if (sheets.length === sheetsSeen) return selectors;
  sheetsSeen = sheets.length;
  const found = Object.fromEntries(NAMES.map((n) => [n, new Set<string>()])) as Record<LightVar, Set<string>>;
  for (const sheet of Array.from(sheets)) {
    try {
      collect(sheet.cssRules, found);
    } catch {
      /* a sheet from another origin can't be read */
    }
  }
  const probe = document.createDocumentFragment();
  const valid = (s: string) => {
    try {
      probe.querySelector(s);
      return true;
    } catch {
      return false;
    }
  };
  selectors = Object.fromEntries(NAMES.map((n) => [n, [`[style*="var(${n}"]`, ...[...found[n]].filter(valid)].join(',')])) as Record<LightVar, string>;
  return selectors;
}

export class LightVars {
  private root: HTMLElement | null = null;
  /** for each value, the elements that read it */
  private readers = new Map<LightVar, HTMLElement[]>();
  private values = new Map<LightVar, string>();
  private dirty = true;
  private frames = 0;
  private observer: MutationObserver | null = null;
  private pending = 0;

  /** the element the device sits in (the stage's turning element) */
  attach(root: HTMLElement | null) {
    if (root === this.root) return;
    this.observer?.disconnect();
    this.root = root;
    this.readers.clear();
    this.dirty = true;
    if (!root || typeof MutationObserver === 'undefined') return;
    // new screens, a case put on, a class that turns a sheen on: look again
    this.observer = new MutationObserver(() => {
      this.dirty = true;
      if (!this.pending) this.pending = requestAnimationFrame(() => ((this.pending = 0), this.refresh()));
    });
    this.observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  detach() {
    this.observer?.disconnect();
    this.observer = null;
    cancelAnimationFrame(this.pending);
    this.pending = 0;
    this.root = null;
    this.readers.clear();
  }

  /** Set a value on every element that reads it. */
  set(name: LightVar, value: string) {
    if (this.values.get(name) === value) return;
    this.values.set(name, value);
    for (const el of this.readers.get(name) ?? []) el.style.setProperty(name, value);
  }

  /** Once a frame while the iPod moves: every so often, look for readers again. */
  tick() {
    if (++this.frames % 90 === 0) this.dirty = true;
    if (this.dirty) this.refresh();
  }

  private refresh() {
    this.dirty = false;
    const root = this.root;
    if (!root) return;
    const sel = readerSelectors();
    for (const name of NAMES) {
      const next = Array.from(root.querySelectorAll<HTMLElement>(sel[name]));
      const had = new Set(this.readers.get(name));
      const v = this.values.get(name);
      if (v !== undefined) for (const el of next) if (!had.has(el)) el.style.setProperty(name, v);
      this.readers.set(name, next);
    }
  }
}

/**
 * Calculator (iOS 15, portrait). Immediate entry with operator precedence,
 * repeated "=", %, ±, C/AC, swipe the display to delete a digit, long-press
 * to copy, and the computer keyboard works while the app is in front.
 */
import { useEffect, useRef, useState } from 'react';
import { isTypingTarget } from '../../../shell/keyboard';
import { playTap } from '../../../core/sound/click';
import { localPoint, suppressNextClick } from '../os/gesture';
import { os, usePrefs } from '../os/store';
import { useApp } from '../os/ui';

type Op = '+' | '−' | '×' | '÷';
type Tok = number | Op;

interface CalcState {
  display: string;
  stack: Tok[];
  entering: boolean;
  last: { op: Op; val: number } | null;
  active: Op | null;
  error: boolean;
}

const INIT: CalcState = { display: '0', stack: [], entering: false, last: null, active: null, error: false };
const isOp = (t: Tok): t is Op => typeof t === 'string';
const high = (o: Op) => o === '×' || o === '÷';

function apply(a: number, op: Op, b: number): number {
  switch (op) {
    case '+':
      return a + b;
    case '−':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return a / b;
  }
}

/** Evaluate [n, op, n, op, n…] honouring × ÷ before + −. */
function evaluate(toks: Tok[]): number {
  const t = [...toks];
  // × and ÷ first
  for (let i = 1; i < t.length - 1; ) {
    const o = t[i];
    if (isOp(o) && high(o)) {
      t.splice(i - 1, 3, apply(t[i - 1] as number, o, t[i + 1] as number));
    } else i += 2;
  }
  let r = t[0] as number;
  for (let i = 1; i < t.length - 1; i += 2) r = apply(r, t[i] as Op, t[i + 1] as number);
  return r;
}

/** iOS-style number formatting: 9 significant digits, grouping, e-notation. */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return 'Error';
  if (Object.is(n, -0)) return '-0';
  const a = Math.abs(n);
  if (a !== 0 && (a >= 1e9 || a < 1e-8)) {
    const [m, e] = n.toExponential(5).split('e');
    return `${m.replace(/\.?0+$/, '')}e${Number(e)}`;
  }
  const intDigits = a < 1 ? 1 : Math.floor(Math.log10(a)) + 1;
  const dec = Math.max(0, 9 - intDigits);
  let s = n.toFixed(dec);
  if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  return group(s);
}

function group(raw: string): string {
  const neg = raw.startsWith('-');
  const body = neg ? raw.slice(1) : raw;
  const [i, d] = body.split('.');
  const gi = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + gi + (d !== undefined ? `.${d}` : '');
}

function reduce(s: CalcState, key: string): CalcState {
  if (s.error && key !== 'AC' && key !== 'C') s = INIT;
  const x = Number(s.display.replace(/,/g, ''));
  if (/^[0-9]$/.test(key) || key === '.') {
    if (!s.entering) return { ...s, display: key === '.' ? '0.' : key, entering: true, active: null };
    if (key === '.' && s.display.includes('.')) return s;
    if (s.display.replace(/[-.]/g, '').length >= 9) return s;
    const d = s.display === '0' && key !== '.' ? key : s.display === '-0' && key !== '.' ? `-${key}` : s.display + key;
    return { ...s, display: d, active: null };
  }
  switch (key) {
    case 'AC':
      return INIT;
    case 'C':
      return { ...s, display: '0', entering: false, error: false };
    case '±': {
      const d = s.display.startsWith('-') ? s.display.slice(1) : `-${s.display}`;
      return { ...s, display: s.entering ? d : fmt(-x).replace(/,/g, ''), entering: s.entering };
    }
    case '%': {
      const st = s.stack;
      const lastOp = st[st.length - 1];
      const base = st.length >= 2 && isOp(lastOp) && !high(lastOp) ? (st[st.length - 2] as number) : null;
      const v = base != null ? (base * x) / 100 : x / 100;
      return { ...s, display: raw(v), entering: false };
    }
    case '+':
    case '−':
    case '×':
    case '÷': {
      const op = key as Op;
      let st = [...s.stack];
      if (st.length && isOp(st[st.length - 1]) && !s.entering) {
        st[st.length - 1] = op;
        return { ...s, stack: st, active: op };
      }
      st.push(x);
      let shown = x;
      if (high(op)) {
        // collapse the trailing × ÷ chain
        let j = st.length - 1;
        while (j >= 2 && isOp(st[j - 1]) && high(st[j - 1] as Op)) j -= 2;
        shown = evaluate(st.slice(j));
        st = [...st.slice(0, j), shown];
      } else {
        shown = evaluate(st);
        st = [shown];
      }
      st.push(op);
      return { ...s, stack: st, display: raw(shown), entering: false, active: op, error: !Number.isFinite(shown) };
    }
    case '=': {
      if (!s.stack.length) {
        if (!s.last) return { ...s, entering: false };
        const r = apply(x, s.last.op, s.last.val);
        return { ...s, display: raw(r), entering: false, active: null, error: !Number.isFinite(r) };
      }
      const st = [...s.stack, x];
      const op = s.stack[s.stack.length - 1] as Op;
      const r = evaluate(st);
      return { display: raw(r), stack: [], entering: false, last: { op, val: x }, active: null, error: !Number.isFinite(r) };
    }
    case '⌫': {
      if (!s.entering) return s;
      const d = s.display.length > 1 && s.display !== '-0' ? s.display.slice(0, -1) : '0';
      return { ...s, display: d === '-' ? '0' : d };
    }
  }
  return s;
}

/** number → display string without grouping (kept raw while editing) */
function raw(n: number): string {
  return fmt(n).replace(/,/g, '');
}

export default function Calculator() {
  const [s, setS] = useState<CalcState>(INIT);
  const app = useApp();
  const clicks = usePrefs((p) => p.keyboardClicks);
  const press = (k: string) => {
    if (clicks) playTap();
    setS((cur) => reduce(cur, k));
  };
  const pressRef = useRef(press);
  pressRef.current = press;

  useEffect(() => {
    if (!app.active) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const map: Record<string, string> = { '+': '+', '-': '−', '*': '×', x: '×', '/': '÷', Enter: '=', '=': '=', Escape: 'AC', Backspace: '⌫', '%': '%', '.': '.', ',': '.' };
      const k = /^[0-9]$/.test(e.key) ? e.key : map[e.key];
      if (!k) return;
      e.preventDefault();
      e.stopPropagation();
      pressRef.current(k);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [app.active]);

  const shown = s.error ? 'Error' : s.entering ? group(s.display) : group(s.display);
  const len = shown.replace(/[,.]/g, '').length + (shown.includes('e') ? 2 : 0);
  const size = len <= 6 ? 78 : len === 7 ? 68 : len === 8 ? 60 : 53;
  const clear = s.entering || (s.display !== '0' && !s.error) ? 'C' : 'AC';

  // swipe the display to delete the last digit, long-press to copy
  const sw = useRef<{ x: number; y: number; t: number } | null>(null);
  const lp = useRef<number | undefined>(undefined);
  return (
    <div className="t7k">
      <div
        className="t7k-display"
        onPointerDown={(e) => {
          const p = localPoint(e.currentTarget, e.clientX, e.clientY);
          sw.current = { x: p.x, y: p.y, t: performance.now() };
          window.clearTimeout(lp.current);
          const el = e.currentTarget;
          lp.current = window.setTimeout(() => {
            sw.current = null;
            suppressNextClick(600);
            const r = el.getBoundingClientRect();
            const scr = el.closest('.t7-screen') as HTMLElement;
            const y = localPoint(scr, r.left, r.bottom).y;
            os.showMenu(
              [
                {
                  label: 'Copy',
                  glyph: 'square.on.square',
                  onPress: () => {
                    void navigator.clipboard?.writeText(shown.replace(/,/g, '')).catch(() => {});
                  },
                },
              ],
              y - 10,
            );
          }, 550);
        }}
        onPointerMove={(e) => {
          if (!sw.current) return;
          const p = localPoint(e.currentTarget, e.clientX, e.clientY);
          if (Math.abs(p.x - sw.current.x) > 8 || Math.abs(p.y - sw.current.y) > 8) window.clearTimeout(lp.current);
        }}
        onPointerUp={(e) => {
          window.clearTimeout(lp.current);
          const st = sw.current;
          sw.current = null;
          if (!st) return;
          const p = localPoint(e.currentTarget, e.clientX, e.clientY);
          if (Math.abs(p.x - st.x) > 30 && Math.abs(p.y - st.y) < 40) press('⌫');
        }}
      >
        <span style={{ fontSize: size }}>{shown}</span>
      </div>
      <div className="t7k-keys">
        <Key label={clear} kind="fn" onPress={() => press(clear)} />
        <Key label="+/−" kind="fn" onPress={() => press('±')} />
        <Key label="%" kind="fn" onPress={() => press('%')} />
        <Key label="÷" kind="op" on={s.active === '÷'} onPress={() => press('÷')} />
        {['7', '8', '9'].map((d) => (
          <Key key={d} label={d} onPress={() => press(d)} />
        ))}
        <Key label="×" kind="op" on={s.active === '×'} onPress={() => press('×')} />
        {['4', '5', '6'].map((d) => (
          <Key key={d} label={d} onPress={() => press(d)} />
        ))}
        <Key label="−" kind="op" on={s.active === '−'} onPress={() => press('−')} />
        {['1', '2', '3'].map((d) => (
          <Key key={d} label={d} onPress={() => press(d)} />
        ))}
        <Key label="+" kind="op" on={s.active === '+'} onPress={() => press('+')} />
        <Key label="0" wide onPress={() => press('0')} />
        <Key label="." onPress={() => press('.')} />
        <Key label="=" kind="op" onPress={() => press('=')} />
      </div>
    </div>
  );
}

function Key({ label, kind = 'num', on, wide, onPress }: { label: string; kind?: 'num' | 'fn' | 'op'; on?: boolean; wide?: boolean; onPress: () => void }) {
  return (
    <button className={`t7k-key ${kind} ${on ? 'on' : ''} ${wide ? 'wide' : ''}`} onClick={onPress}>
      <span>{label}</span>
    </button>
  );
}

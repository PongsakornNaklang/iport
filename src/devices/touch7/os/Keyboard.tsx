/**
 * The iOS keyboard. It slides up whenever a text field on the screen has the
 * focus, and types into that field: letters (Shift once for a capital,
 * twice for caps lock), numbers and symbols, delete (hold to repeat),
 * space and return, with the key popping up under the finger and the
 * QuickType bar above. A computer's own keyboard keeps working too.
 *
 * The keys never take the focus, so the field keeps its caret. Typed text
 * goes in with setRangeText plus an input event, which React sees as typing.
 */
import { useEffect, useRef, useState } from 'react';
import { playTap } from '../../../core/sound/click';
import { usePrefs } from './store';

type Field = HTMLInputElement | HTMLTextAreaElement;
type Layer = 'abc' | '123' | '#+=';

const ROWS: Record<Layer, string[][]> = {
  abc: [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], ['z', 'x', 'c', 'v', 'b', 'n', 'm']],
  '123': [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'], ['.', ',', '?', '!', "'"]],
  '#+=': [['[', ']', '{', '}', '#', '%', '^', '*', '+', '='], ['_', '\\', '|', '~', '<', '>', '€', '£', '¥', '•'], ['.', ',', '?', '!', "'"]],
};

/** what a field counts as for typing */
export function isTextField(el: EventTarget | null): el is Field {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly;
  if (!(el instanceof HTMLInputElement) || el.readOnly) return false;
  return ['text', 'search', 'email', 'url', 'tel', 'password', 'number', ''].includes(el.type);
}

function insert(el: Field, text: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  el.setRangeText(text, start, end, 'end');
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function backspace(el: Field) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  if (start !== end) el.setRangeText('', start, end, 'end');
  else if (start > 0) {
    // a whole emoji / surrogate pair at once
    const before = el.value.slice(0, start);
    const last = Array.from(before).pop() ?? '';
    el.setRangeText('', start - last.length, start, 'end');
  } else return;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** the word being typed, for the QuickType bar */
function currentWord(el: Field | null): string {
  if (!el) return '';
  const before = el.value.slice(0, el.selectionStart ?? el.value.length);
  return before.match(/[\p{L}\p{N}']+$/u)?.[0] ?? '';
}

export function Keyboard({ field }: { field: Field | null }) {
  const clicks = usePrefs((s) => s.keyboardClicks);
  const [layer, setLayer] = useState<Layer>('abc');
  const [shift, setShift] = useState<'off' | 'once' | 'lock'>('once');
  const [pop, setPop] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const lastShift = useRef(0);
  const repeat = useRef<{ t?: number; i?: number }>({});
  const shown = useRef<Field | null>(null);
  if (field) shown.current = field;
  const el = field ?? shown.current;

  // a new field starts with a capital, on letters
  useEffect(() => {
    if (!field) return;
    setLayer('abc');
    setShift(field.value.length === 0 && field.type !== 'email' && field.type !== 'url' ? 'once' : 'off');
  }, [field]);
  // keep the QuickType word current while typing on a real keyboard too
  useEffect(() => {
    if (!field) return;
    const on = () => setTick((n) => n + 1);
    field.addEventListener('input', on);
    field.addEventListener('keyup', on);
    return () => {
      field.removeEventListener('input', on);
      field.removeEventListener('keyup', on);
    };
  }, [field]);
  useEffect(() => () => stopRepeat(), []);

  const tap = () => clicks && playTap();
  const type = (k: string) => {
    if (!el) return;
    const ch = layer === 'abc' && shift !== 'off' ? k.toUpperCase() : k;
    insert(el, ch);
    if (shift === 'once') setShift('off');
    // after a sentence ends, a capital again
    if (layer !== 'abc' && (k === "'" || k === ' ')) setLayer('abc');
  };
  const space = () => {
    if (!el) return;
    // a double space ends the sentence
    const v = el.value;
    const at = el.selectionStart ?? v.length;
    if (v[at - 1] === ' ' && /[\p{L}\p{N}]/u.test(v[at - 2] ?? '')) {
      el.setRangeText('. ', at - 1, at, 'end');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      setShift('once');
    } else {
      insert(el, ' ');
      if (/[.!?]$/.test(v.slice(0, at))) setShift('once');
    }
    if (layer !== 'abc') setLayer('abc');
  };
  const ret = () => {
    if (!el) return;
    if (el instanceof HTMLTextAreaElement) {
      insert(el, '\n');
      setShift('once');
      return;
    }
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    el.form?.requestSubmit?.();
  };
  const startRepeat = () => {
    stopRepeat();
    if (el) backspace(el);
    repeat.current.t = window.setTimeout(() => {
      repeat.current.i = window.setInterval(() => {
        if (el) backspace(el);
        tap();
      }, 90);
    }, 450);
  };
  function stopRepeat() {
    window.clearTimeout(repeat.current.t);
    window.clearInterval(repeat.current.i);
  }
  const pressShift = () => {
    const now = performance.now();
    if (now - lastShift.current < 320) setShift('lock');
    else setShift((s) => (s === 'off' ? 'once' : 'off'));
    lastShift.current = now;
  };

  /** keys never take the focus away from the field */
  const hold = (e: React.PointerEvent) => e.preventDefault();
  const letterKey = (k: string) => {
    const label = layer === 'abc' && shift !== 'off' ? k.toUpperCase() : k;
    return (
      <button
        key={k}
        className="t7-kb-key"
        onPointerDown={(e) => {
          hold(e);
          tap();
          setPop(k);
        }}
        onPointerUp={() => {
          setPop(null);
          type(k);
        }}
        onPointerLeave={() => setPop((p) => (p === k ? null : p))}
      >
        {label}
        {pop === k && <span className="t7-kb-pop">{label}</span>}
      </button>
    );
  };

  const rows = ROWS[layer];
  const search = el instanceof HTMLInputElement && (el.type === 'search' || el.enterKeyHint === 'search');
  const go = el instanceof HTMLInputElement && (el.type === 'url' || el.enterKeyHint === 'go');
  const word = currentWord(el);
  return (
    <div className={`t7-kb ${field ? 'on' : ''}`} onPointerDown={hold} onContextMenu={(e) => e.preventDefault()}>
      <div className="t7-kb-qt">
        <span />
        <span className="t7-kb-qt-word">{word ? `“${word}”` : ''}</span>
        <span />
      </div>
      <div className="t7-kb-row">{rows[0].map(letterKey)}</div>
      <div className="t7-kb-row t7-kb-row2">{rows[1].map(letterKey)}</div>
      <div className="t7-kb-row">
        {layer === 'abc' ? (
          <button
            className={`t7-kb-key t7-kb-fn t7-kb-shift ${shift !== 'off' ? 'on' : ''} ${shift === 'lock' ? 'lock' : ''}`}
            aria-label="shift"
            onPointerDown={(e) => {
              hold(e);
              tap();
              pressShift();
            }}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path d="M10 3 3 10.5h4V16h6v-5.5h4z" fill={shift !== 'off' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              {shift === 'lock' && <path d="M7 18h6" stroke="currentColor" strokeWidth="1.6" />}
            </svg>
          </button>
        ) : (
          <button
            className="t7-kb-key t7-kb-fn t7-kb-sym"
            onPointerDown={(e) => {
              hold(e);
              tap();
              setLayer(layer === '123' ? '#+=' : '123');
            }}
          >
            {layer === '123' ? '#+=' : '123'}
          </button>
        )}
        <div className={`t7-kb-mid ${layer === 'abc' ? '' : 't7-kb-mid-wide'}`}>{rows[2].map(letterKey)}</div>
        <button
          className="t7-kb-key t7-kb-fn t7-kb-del"
          aria-label="delete"
          onPointerDown={(e) => {
            hold(e);
            tap();
            startRepeat();
          }}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
        >
          <svg viewBox="0 0 24 18" width="22" height="17" aria-hidden="true">
            <path d="M7 1h15v16H7L1 9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M11 5.5l7 7M18 5.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="t7-kb-row t7-kb-bottom">
        <button
          className="t7-kb-key t7-kb-fn t7-kb-123"
          onPointerDown={(e) => {
            hold(e);
            tap();
            setLayer(layer === 'abc' ? '123' : 'abc');
          }}
        >
          {layer === 'abc' ? '123' : 'ABC'}
        </button>
        <button
          className="t7-kb-key t7-kb-space"
          onPointerDown={(e) => {
            hold(e);
            tap();
          }}
          onPointerUp={space}
        >
          space
        </button>
        <button
          className={`t7-kb-key t7-kb-fn t7-kb-return ${search || go ? 'blue' : ''}`}
          onPointerDown={(e) => {
            hold(e);
            tap();
          }}
          onPointerUp={ret}
        >
          {search ? 'search' : go ? 'go' : 'return'}
        </button>
      </div>
    </div>
  );
}

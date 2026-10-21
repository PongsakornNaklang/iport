import { useMemo, useState, type ReactNode } from 'react';
import { useInput, useOS } from './core';
import { ListView, type Row } from './ListView';

/** A row that toggles On/Off in place, like Settings ▸ Sound Check. */
export function toggleRow(label: string, value: boolean, set: (v: boolean) => void): Row {
  return { key: label, label, detail: value ? 'On' : 'Off', onSelect: () => set(!value) };
}

/** A row that cycles through values in place, like Settings ▸ Repeat. */
export function cycleRow<T>(label: string, value: T, choices: { value: T; label: string }[], set: (v: T) => void): Row {
  const i = Math.max(0, choices.findIndex((c) => c.value === value));
  return { key: label, label, detail: choices[i]?.label ?? '', onSelect: () => set(choices[(i + 1) % choices.length].value) };
}

/** Pick one value from a list (✓ on the current one); goes back after picking. */
export function ChoiceList<T>({
  choices,
  value,
  onPick,
  stay,
}: {
  choices: { value: T; label: string }[];
  value: T;
  onPick: (v: T) => void;
  /** stay on the list after picking */
  stay?: boolean;
}) {
  const os = useOS();
  const rows = useMemo<Row[]>(
    () =>
      choices.map((c, i) => ({
        key: `${i}:${c.label}`,
        label: c.label,
        check: c.value === value,
        onSelect: () => {
          onPick(c.value);
          if (!stay) os.nav.pop();
        },
      })),
    [choices, value, onPick, os, stay],
  );
  const initial = Math.max(0, choices.findIndex((c) => c.value === value));
  return <ListView rows={rows} initial={initial} />;
}

/** Centered message (empty states, About pages…). */
export function MessageScreen({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <div className="cl-message">
      {title && <b>{title}</b>}
      {children && <span>{children}</span>}
    </div>
  );
}

/** A scrollable block of text (Notes, Legal, lyrics…): the wheel scrolls it. */
export function TextScreen({ text, title }: { text: string; title?: string }) {
  const os = useOS();
  const lines = useMemo(() => wrapText(text, os.width - 24), [text, os.width]);
  const visible = Math.floor((os.height - os.hdr - 12) / 17);
  const [topState, setTop] = useStateClamp(0, Math.max(0, lines.length - visible));
  useInput((e) => {
    if (e.type === 'scroll') {
      setTop(topState + e.steps);
      return true;
    }
    if (e.type === 'click' && e.button === 'select') return true;
    return false;
  });
  const scroll = lines.length > visible;
  return (
    <div className={`cl-text ${scroll ? 'cl-list-scroll' : ''}`}>
      {title && <div className="cl-text-title">{title}</div>}
      <div className="cl-text-body" style={{ transform: `translateY(${-topState * 17}px)` }}>
        {lines.map((l, i) => (
          <div key={i}>{l || ' '}</div>
        ))}
      </div>
      {scroll && (
        <div className="cl-scrollbar">
          <div
            className="cl-scrollthumb"
            style={{
              height: Math.max(14, (visible / lines.length) * (os.height - os.hdr)),
              top: (topState / Math.max(1, lines.length - visible)) * (os.height - os.hdr - Math.max(14, (visible / lines.length) * (os.height - os.hdr))),
            }}
          />
        </div>
      )}
    </div>
  );
}

function useStateClamp(initial: number, max: number): [number, (v: number) => void] {
  const [v, setV] = useState(initial);
  const c = Math.max(0, Math.min(max, v));
  return [c, (x: number) => setV(Math.max(0, Math.min(max, x)))];
}

let measureCtx: CanvasRenderingContext2D | null = null;
/** Word-wrap text to a pixel width using the list body font. */
export function wrapText(text: string, width: number, font = '400 13px "Helvetica Neue", Helvetica, Arial, sans-serif'): string[] {
  if (!measureCtx) {
    const c = document.createElement('canvas');
    measureCtx = c.getContext('2d');
  }
  const g = measureCtx;
  const out: string[] = [];
  if (!g) return text.split('\n');
  g.font = font;
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/);
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (g.measureText(test).width > width && line) {
        out.push(line);
        line = w;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

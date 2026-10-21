/**
 * Reminders (iOS 15): smart lists (Today, Scheduled, All, Flagged), the
 * Reminders list with inline add, check off, flag, due today, delete.
 */
import { useEffect, useRef, useState } from 'react';
import { uid } from '../../../core/util/id';
import { Glyph } from '../os/glyphs';
import { os, usePrefs, type Prefs } from '../os/store';
import { NavStack, Page, SearchField, TextButton, useNav } from '../os/ui';
import { makeLP } from './music/common';
import { sameDay } from './shared';

type R = Prefs['reminders'][number];
type Filter = 'today' | 'scheduled' | 'all' | 'flagged' | 'list';

const META: Record<Filter, { title: string; color: string; glyph: string }> = {
  today: { title: 'Today', color: '#007aff', glyph: 'calendar' },
  scheduled: { title: 'Scheduled', color: '#ff3b30', glyph: 'calendar' },
  all: { title: 'All', color: '#5b5b60', glyph: 'tray.fill' },
  flagged: { title: 'Flagged', color: '#ff9500', glyph: 'flag.fill' },
  list: { title: 'Reminders', color: '#ff9500', glyph: 'list.bullet' },
};

function match(f: Filter, r: R): boolean {
  if (f === 'today') return !!r.due && (sameDay(new Date(r.due), new Date()) || r.due < Date.now());
  if (f === 'scheduled') return !!r.due;
  if (f === 'flagged') return !!r.flagged;
  return true;
}

const set = (list: R[]) => usePrefs.getState().set('reminders', list);
const patch = (id: string, p: Partial<R>) => set(usePrefs.getState().reminders.map((r) => (r.id === id ? { ...r, ...p } : r)));

export default function Reminders() {
  return (
    <div className="t7r-root">
      <NavStack root={<Lists />} rootTitle="Lists" />
    </div>
  );
}

function Lists() {
  const nav = useNav()!;
  const list = usePrefs((s) => s.reminders);
  const [q, setQ] = useState('');
  const open = (f: Filter) => nav.push(<ListPage filter={f} />, META[f].title);
  const count = (f: Filter) => list.filter((r) => !r.done && match(f, r)).length;
  if (q.trim()) {
    const hits = list.filter((r) => r.text.toLowerCase().includes(q.trim().toLowerCase()));
    return (
      <Page title="" large={false} bg="grouped" search={<div style={{ paddingTop: 6 }}><SearchField value={q} onChange={setQ} /></div>}>
        {hits.map((r) => (
          <Row key={r.id} r={r} color={META.list.color} />
        ))}
      </Page>
    );
  }
  return (
    <Page
      title=""
      large={false}
      bg="grouped"
      right={<TextButton onPress={() => os.toast('Edit Lists', 'list.bullet')}>Edit</TextButton>}
      search={<SearchField value={q} onChange={setQ} />}
      bottom={
        <>
          <button className="t7r-new" onClick={() => nav.push(<ListPage filter="list" autoAdd />, 'Reminders')}>
            <Glyph name="plus.circle.fill" size={22} />
            New Reminder
          </button>
          <TextButton onPress={() => os.toast('Lists sync with iCloud', 'icloud')}>Add List</TextButton>
        </>
      }
    >
      <div className="t7r-smart">
        {(['today', 'scheduled', 'all', 'flagged'] as Filter[]).map((f) => (
          <div key={f} className="t7r-card" onClick={() => open(f)}>
            <span className="ic" style={{ background: META[f].color }}>
              <Glyph name={META[f].glyph} size={16} />
            </span>
            <span className="n">{f === 'all' ? list.filter((r) => !r.done).length : count(f)}</span>
            <span className="t">{META[f].title}</span>
          </div>
        ))}
      </div>
      <div className="t7r-h">My Lists</div>
      <div className="t7n-card">
        <div className="t7n-folder" onClick={() => open('list')}>
          <span className="t7r-lic" style={{ background: META.list.color }}>
            <Glyph name="list.bullet" size={15} />
          </span>
          <span className="t7n-fname">Reminders</span>
          <span className="t7n-fcount">{list.filter((r) => !r.done).length}</span>
          <Glyph name="chevron.right" size={14} className="t7-cell-chev" />
        </div>
      </div>
    </Page>
  );
}

function ListPage({ filter, autoAdd }: { filter: Filter; autoAdd?: boolean }) {
  const all = usePrefs((s) => s.reminders);
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(!!autoAdd);
  const [text, setText] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const m = META[filter];
  const items = all.filter((r) => match(filter, r) && (showDone || !r.done || recent.includes(r.id)));
  useEffect(() => {
    if (adding) window.setTimeout(() => input.current?.focus({ preventScroll: true }), 400);
  }, [adding]);
  const commit = (keepGoing: boolean) => {
    const t = text.trim();
    if (t) {
      set([
        ...usePrefs.getState().reminders,
        { id: uid('rem'), text: t, done: false, flagged: filter === 'flagged' || undefined, due: filter === 'today' || filter === 'scheduled' ? Date.now() : undefined },
      ]);
    }
    setText('');
    if (!keepGoing || !t) setAdding(false);
  };
  return (
    <Page
      title={m.title}
      className={`t7r-list t7r-${filter}`}
      right={
        <button
          className="t7-gbtn"
          aria-label="More"
          onClick={() =>
            os.showMenu(
              [
                { label: showDone ? 'Hide Completed' : 'Show Completed', glyph: 'eye', onPress: () => setShowDone(!showDone) },
                { label: 'Clear Completed', glyph: 'trash', destructive: true, onPress: () => set(usePrefs.getState().reminders.filter((r) => !r.done)) },
              ],
              64,
            )
          }
        >
          <Glyph name="ellipsis.circle" size={22} />
        </button>
      }
      bottom={
        <button className="t7r-new" style={{ ['--t7-tint' as string]: m.color }} onClick={() => setAdding(true)}>
          <Glyph name="plus.circle.fill" size={22} />
          New Reminder
        </button>
      }
    >
      {items.map((r) => (
        <Row
          key={r.id}
          r={r}
          color={m.color}
          onToggle={(done) => {
            if (done) {
              setRecent((x) => [...x, r.id]);
              window.setTimeout(() => setRecent((x) => x.filter((y) => y !== r.id)), 1500);
            }
          }}
        />
      ))}
      {adding && (
        <div className="t7r-row">
          <span className="t7r-check" style={{ borderColor: 'var(--t7-label3)' }} />
          <input
            ref={input}
            className="t7r-in"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit(true);
              if (e.key === 'Escape') commit(false);
            }}
            onBlur={() => commit(false)}
            spellCheck={false}
          />
        </div>
      )}
      {!items.length && !adding && <div className="t7r-empty">{filter === 'list' ? 'No Reminders' : `No ${m.title} Reminders`}</div>}
    </Page>
  );
}

function Row({ r, color, onToggle }: { r: R; color: string; onToggle?: (done: boolean) => void }) {
  return (
    <div
      className={`t7r-row ${r.done ? 'done' : ''}`}
      {...makeLP((y) =>
        os.showMenu(
          [
            { label: r.flagged ? 'Unflag' : 'Flag', glyph: 'flag.fill', onPress: () => patch(r.id, { flagged: !r.flagged }) },
            { label: r.due ? 'Remove Due Date' : 'Remind Me Today', glyph: 'calendar', onPress: () => patch(r.id, { due: r.due ? undefined : Date.now() }) },
            { label: 'Delete', glyph: 'trash', destructive: true, onPress: () => set(usePrefs.getState().reminders.filter((x) => x.id !== r.id)) },
          ],
          y,
          r.text,
        ),
      )}
    >
      <button
        className="t7r-check"
        style={r.done ? { borderColor: color, background: `radial-gradient(circle, ${color} 0 6.5px, transparent 7.5px)` } : undefined}
        onClick={() => {
          patch(r.id, { done: !r.done });
          onToggle?.(!r.done);
        }}
        aria-label={r.done ? 'Mark as not completed' : 'Mark as completed'}
      />
      <div className="t7r-main">
        <div className="t">{r.text}</div>
        {r.due && <div className={`d ${r.due < Date.now() - 86400_000 ? 'late' : ''}`}>{sameDay(new Date(r.due), new Date()) ? 'Today' : new Date(r.due).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}</div>}
      </div>
      {r.flagged && <Glyph name="flag.fill" size={14} className="t7r-flag" />}
    </div>
  );
}

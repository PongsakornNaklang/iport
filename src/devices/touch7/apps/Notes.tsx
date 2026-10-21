/**
 * Notes (iOS 15): Folders → Notes list → editor. Notes are shared with the
 * other iPod models (title = first line, body = the rest).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLibrary } from '../../../core/library/store';
import type { Note } from '../../../core/types';
import { Glyph } from '../os/glyphs';
import { os } from '../os/store';
import { Empty, NavStack, Page, SearchField, TextButton, useNav, type NavApi } from '../os/ui';
import { makeLP } from './music/common';
import { listDate, useIntent } from './shared';

const text = (n: Note) => (n.body ? `${n.title}\n${n.body}` : n.title);
const snippet = (n: Note) => n.body.split('\n').find((l) => l.trim())?.trim() ?? 'No additional text';

export default function Notes() {
  const api = useRef<NavApi | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready || !api.current) return;
    api.current.push(<NotesList />, 'Notes');
    setReady(true);
  }, [ready]);
  useIntent((d) => {
    if (d === 'new') api.current?.push(<Editor id={null} />, '');
  });
  return (
    <div className="t7n-root">
      <NavStack root={<Folders />} rootTitle="Folders" onApi={(a) => (api.current = a)} />
    </div>
  );
}

function Folders() {
  const nav = useNav()!;
  const count = useLibrary((s) => s.notes.length);
  return (
    <Page
      title="Folders"
      bg="grouped"
      right={<TextButton>Edit</TextButton>}
      bottom={
        <>
          <button className="t7-gbtn" aria-label="New Folder" onClick={() => os.toast('Folders sync with iCloud', 'folder.fill')}>
            <Glyph name="folder.badge.plus" size={24} />
          </button>
          <span />
          <button className="t7-gbtn" aria-label="New Note" onClick={() => nav.push(<Editor id={null} />, '')}>
            <Glyph name="square.and.pencil" size={23} />
          </button>
        </>
      }
    >
      <div className="t7n-sechead">On My iPod</div>
      <div className="t7n-card">
        <div className="t7n-folder" onClick={() => nav.push(<NotesList />, 'Notes')}>
          <Glyph name="folder" size={24} className="t7n-fg" />
          <span className="t7n-fname">Notes</span>
          <span className="t7n-fcount">{count}</span>
          <Glyph name="chevron.right" size={14} className="t7-cell-chev" />
        </div>
      </div>
    </Page>
  );
}

function NotesList() {
  const nav = useNav()!;
  const notes = useLibrary((s) => s.notes);
  const [q, setQ] = useState('');
  const list = useMemo(
    () =>
      [...notes]
        .filter((n) => !q.trim() || text(n).toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [notes, q],
  );
  return (
    <Page
      title="Notes"
      bg="grouped"
      right={
        <button
          className="t7-gbtn"
          aria-label="More"
          onClick={() =>
            os.showMenu(
              [
                { label: 'View as Gallery', glyph: 'square.grid.2x2.fill', disabled: true },
                { label: 'Select Notes', glyph: 'checkmark.circle.fill', disabled: true },
              ],
              64,
            )
          }
        >
          <Glyph name="ellipsis.circle" size={22} />
        </button>
      }
      search={<SearchField value={q} onChange={setQ} />}
      bottom={
        <>
          <span />
          <span className="t7n-count">{notes.length ? `${notes.length} Note${notes.length === 1 ? '' : 's'}` : 'No Notes'}</span>
          <button className="t7-gbtn" aria-label="New Note" onClick={() => nav.push(<Editor id={null} />, '')}>
            <Glyph name="square.and.pencil" size={23} />
          </button>
        </>
      }
    >
      {list.length > 0 && (
        <div className="t7n-card">
          {list.map((n) => (
            <div
              key={n.id}
              className="t7n-row"
              onClick={() => nav.push(<Editor id={n.id} />, n.title)}
              {...makeLP((y) =>
                os.showMenu(
                  [
                    {
                      label: 'Copy',
                      glyph: 'square.on.square',
                      onPress: () => void navigator.clipboard?.writeText(text(n)).catch(() => {}),
                    },
                    { label: 'Delete', glyph: 'trash', destructive: true, onPress: () => useLibrary.getState().removeNote(n.id) },
                  ],
                  y,
                  n.title || 'New Note',
                ),
              )}
            >
              <div className="t7n-row-t">{n.title || 'New Note'}</div>
              <div className="t7n-row-s">
                <span>{listDate(n.updatedAt, true)}</span> {snippet(n)}
              </div>
            </div>
          ))}
        </div>
      )}
      {!list.length && <Empty title={q ? 'No Results' : 'No Notes'} text={q ? undefined : 'Tap the compose button to write your first note.'} />}
    </Page>
  );
}

function Editor({ id: initial }: { id: string | null }) {
  const nav = useNav()!;
  const note = useLibrary((s) => (initial ? s.notes.find((n) => n.id === initial) : undefined));
  const [value, setValue] = useState(() => (note ? text(note) : ''));
  const [focused, setFocused] = useState(false);
  const idRef = useRef<string | null>(initial);
  const ta = useRef<HTMLTextAreaElement>(null);
  const when = note?.updatedAt ?? Date.now();

  useEffect(() => {
    if (!initial) {
      const t = window.setTimeout(() => ta.current?.focus({ preventScroll: true }), 420);
      return () => window.clearTimeout(t);
    }
  }, [initial]);
  const valueRef = useRef(value);
  // drop empty notes when leaving
  useEffect(
    () => () => {
      const id = idRef.current;
      if (id && !valueRef.current.trim()) useLibrary.getState().removeNote(id);
    },
    [],
  );

  const save = (v: string) => {
    setValue(v);
    valueRef.current = v;
    if (!idRef.current && !v.trim()) return;
    // title = first non-empty line, body = everything after it
    const lines = v.replace(/^\s*\n/, '').split('\n');
    const [first, ...rest] = lines;
    idRef.current = useLibrary.getState().upsertNote({ id: idRef.current ?? undefined, title: first.trim() || 'New Note', body: rest.join('\n') });
  };
  const del = () => {
    if (idRef.current) useLibrary.getState().removeNote(idRef.current);
    idRef.current = null;
    nav.pop();
  };
  return (
    <Page
      title=""
      large={false}
      bg="plain"
      noScroll
      className="t7n-editor"
      right={
        focused ? (
          <TextButton bold onPress={() => ta.current?.blur()}>
            Done
          </TextButton>
        ) : (
          <>
            <button className="t7-gbtn" aria-label="Share" onClick={() => void navigator.clipboard?.writeText(value).then(() => os.toast('Copied'), () => {})}>
              <Glyph name="square.and.arrow.up" size={21} />
            </button>
            <button
              className="t7-gbtn"
              aria-label="More"
              onClick={() =>
                os.showMenu(
                  [
                    { label: 'Copy', glyph: 'square.on.square', onPress: () => void navigator.clipboard?.writeText(value).catch(() => {}) },
                    { label: 'Delete', glyph: 'trash', destructive: true, onPress: del },
                  ],
                  64,
                )
              }
            >
              <Glyph name="ellipsis.circle" size={22} />
            </button>
          </>
        )
      }
      bottom={
        <>
          <button className="t7-gbtn" aria-label="Checklist" onClick={() => save(`${value}${value && !value.endsWith('\n') ? '\n' : ''}○ `)}>
            <Glyph name="checklist" size={22} />
          </button>
          <button className="t7-gbtn" aria-label="Camera" onClick={() => os.toast('Scan documents with an iPhone', 'camera.fill')}>
            <Glyph name="camera.fill" size={22} />
          </button>
          <button className="t7-gbtn" aria-label="Markup" onClick={() => os.toast('Markup', 'pencil')}>
            <Glyph name="pencil.tip.crop.circle" size={22} />
          </button>
          <button
            className="t7-gbtn"
            aria-label="New Note"
            onClick={() => {
              nav.pop();
              window.setTimeout(() => nav.push(<Editor id={null} />, ''), 420);
            }}
          >
            <Glyph name="square.and.pencil" size={23} />
          </button>
        </>
      }
    >
      <div className="t7n-date">
        {new Date(when).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at {new Date(when).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
      </div>
      <textarea
        ref={ta}
        className="t7n-text"
        value={value}
        spellCheck={false}
        onChange={(e) => save(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </Page>
  );
}

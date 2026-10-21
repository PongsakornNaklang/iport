import { useMemo, useState } from 'react';
import { useLibrary } from '@/core/library/store';
import type { Note } from '@/core/types';
import { IconPlus, IconTrash } from '../../icons';
import { IconNote } from '../icons';
import { Confirm, Empty, SearchField, Sheet } from '../ui';

function when(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

export function Notes() {
  const notes = useLibrary((s) => s.notes);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Note | 'new' | null>(null);
  const list = useMemo(() => {
    const w = q.trim().toLowerCase();
    return [...notes].filter((n) => !w || `${n.title}\n${n.body}`.toLowerCase().includes(w)).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, q]);

  return (
    <>
      <div className="lib-row-flex">
        <div className="grow">
          <SearchField value={q} onChange={setQ} placeholder="Search notes" live />
        </div>
        <button className="btn primary" onClick={() => setEditing('new')}>
          <IconPlus /> New Note
        </button>
      </div>
      {notes.length === 0 ? (
        <Empty icon={<IconNote />} title="No notes">
          Notes show up in the iPod’s Extras → Notes, like the text files you could copy to a real iPod.
        </Empty>
      ) : (
        <div className="list" style={{ marginTop: 10 }}>
          {list.map((n) => (
            <div key={n.id} className="list-item lib-row lib-row-plain clickable" onClick={() => setEditing(n)}>
              <div className="li-text">
                <div className="li-title">{n.title || 'New Note'}</div>
                <div className="li-sub">
                  <span style={{ color: 'var(--ui-text-3)' }}>{when(n.updatedAt)}</span> {n.body.replace(/\s+/g, ' ').slice(0, 90)}
                </div>
              </div>
              <span className="lib-chev">›</span>
            </div>
          ))}
        </div>
      )}
      {editing && <NoteEditor note={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function NoteEditor({ note, onClose }: { note: Note | null; onClose: () => void }) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [confirm, setConfirm] = useState(false);
  const save = () => {
    if (!title.trim() && !body.trim()) return onClose();
    useLibrary.getState().upsertNote({ id: note?.id, title: title.trim(), body });
    onClose();
  };
  return (
    <Sheet
      title={note ? 'Edit Note' : 'New Note'}
      onClose={onClose}
      actions={
        <button className="btn small primary" onClick={save}>
          Save
        </button>
      }
    >
      <div className="field">
        <label>Title</label>
        <input className="input" value={title} placeholder="First line of the note" autoFocus={!note} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label>Note</label>
        <textarea className="input" style={{ minHeight: 260 }} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      {note && (
        <button className="btn danger" onClick={() => setConfirm(true)}>
          <IconTrash /> Delete Note
        </button>
      )}
      {confirm && note && (
        <Confirm
          title="Delete this note?"
          message={note.title}
          confirm="Delete"
          danger
          onConfirm={() => {
            useLibrary.getState().removeNote(note.id);
            onClose();
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </Sheet>
  );
}

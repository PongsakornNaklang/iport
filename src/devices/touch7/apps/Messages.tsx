/**
 * Messages (iOS 15), on this iPod only: conversations are kept on the device.
 * Write to a contact (or any name or number) and they answer after a moment
 * of "typing…", in Thai or English like you wrote; an answer that comes while
 * you're elsewhere arrives as a notification.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useLibrary } from '../../../core/library/store';
import { uid } from '../../../core/util/id';
import { useSettings } from '../../../core/settings/store';
import { formatClock } from '../../../core/util/format';
import { playTone } from '../../../core/sound/click';
import { Glyph } from '../os/glyphs';
import { os, useOS } from '../os/store';
import { NavStack, Page, SearchField, Sheet, SheetHeader, TextButton, TextInput, useNav, type NavApi } from '../os/ui';
import { useIntent } from './shared';

// ------------------------------------------------------------------ data

interface Msg {
  id: string;
  me: boolean;
  text: string;
  time: number;
}
interface Thread {
  id: string;
  name: string;
  msgs: Msg[];
  unread: number;
  /** when they read your last message */
  readAt?: number;
}

const useMessages = create<{
  threads: Thread[];
  /** who is typing a reply right now (thread ids) */
  typing: string[];
}>()(
  persist(() => ({ threads: [] as Thread[], typing: [] as string[] }), {
    name: 'iport-touch7-messages',
    version: 1,
    partialize: (s) => ({ threads: s.threads }),
  }),
);
const M = () => useMessages.getState();

/** the conversation on screen, if any (no notification for it) */
let openThread: string | null = null;

function findOrCreate(name: string): string {
  const key = name.trim();
  const hit = M().threads.find((t) => t.name.toLowerCase() === key.toLowerCase());
  if (hit) return hit.id;
  const t: Thread = { id: uid('th'), name: key, msgs: [], unread: 0 };
  useMessages.setState({ threads: [t, ...M().threads] });
  return t.id;
}

function update(id: string, fn: (t: Thread) => Thread) {
  useMessages.setState({ threads: M().threads.map((t) => (t.id === id ? fn(t) : t)) });
}

/** most recent conversation first */
function bump(id: string) {
  const ts = M().threads;
  const t = ts.find((x) => x.id === id);
  if (t) useMessages.setState({ threads: [t, ...ts.filter((x) => x !== t)] });
}

const replyTimers = new Map<string, number[]>();

function send(id: string, text: string) {
  const body = text.trim();
  if (!body) return;
  update(id, (t) => ({ ...t, msgs: [...t.msgs, { id: uid('m'), me: true, text: body, time: Date.now() }], readAt: undefined }));
  bump(id);
  // the swoosh
  playTone(880, 50, { volume: 0.05, type: 'sine' });
  playTone(1320, 70, { volume: 0.04, delayMs: 45, type: 'sine' });
  scheduleReply(id, body);
}

/** They read it, type for a moment and answer (one answer for a quick run of messages). */
function scheduleReply(id: string, last: string) {
  for (const t of replyTimers.get(id) ?? []) window.clearTimeout(t);
  const read = 900 + Math.random() * 900;
  const typingFor = 1200 + Math.min(2600, last.length * 40) + Math.random() * 800;
  const timers = [
    window.setTimeout(() => {
      update(id, (t) => ({ ...t, readAt: Date.now() }));
      useMessages.setState({ typing: [...new Set([...M().typing, id])] });
    }, read),
    window.setTimeout(() => {
      useMessages.setState({ typing: M().typing.filter((x) => x !== id) });
      const text = replyTo(last);
      update(id, (t) => ({ ...t, msgs: [...t.msgs, { id: uid('m'), me: false, text, time: Date.now() }], unread: openThread === id ? 0 : t.unread + 1 }));
      bump(id);
      const st = useOS.getState();
      const looking = openThread === id && st.app === 'messages' && st.screenOn && !st.locked;
      if (looking) playTone(1046, 60, { volume: 0.05, type: 'triangle' });
      else os.notify('messages', M().threads.find((t) => t.id === id)?.name ?? 'Message', text);
    }, read + typingFor),
  ];
  replyTimers.set(id, timers);
}

const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

function replyTo(text: string): string {
  const t = text.toLowerCase();
  if (/[฀-๿]/.test(text)) {
    if (/สวัสดี|หวัดดี|ดีจ้า/.test(t)) return pick(['สวัสดีจ้า สบายดีไหม', 'หวัดดี! ว่าไง', 'ดีจ้า 😊']);
    if (/ขอบคุณ|ขอบใจ/.test(t)) return pick(['ยินดีจ้า', 'ไม่เป็นไรเลย 😊']);
    if (/กิน|ข้าว/.test(t)) return pick(['ยังเลย หิวมาก 😋', 'กินแล้ว แล้วเธอล่ะ', 'ไปกินด้วยกันไหม']);
    if (/[?？]|ไหม|มั้ย|หรือเปล่า|อะไร|ที่ไหน|เมื่อไร|ยังไง/.test(t)) return pick(['ได้สิ', 'ยังไม่แน่ใจ เดี๋ยวบอกนะ', 'คิดว่าน่าจะได้', 'ไม่รู้เหมือนกัน 😅']);
    return pick(['โอเค', 'ได้เลย 👍', '555', 'จริงดิ', 'เยี่ยมเลย', 'เดี๋ยวโทรหานะ', 'กำลังไป']);
  }
  if (/\b(hi|hello|hey|yo)\b/.test(t)) return pick(['Hey! How are you?', 'Hi! 👋', 'Hey, what’s up?']);
  if (/thank/.test(t)) return pick(['You’re welcome!', 'Anytime 😊']);
  if (/\?\s*$/.test(t)) return pick(['Yes!', 'Not sure yet, I’ll let you know.', 'Maybe later?', 'Sounds good to me.']);
  return pick(['Sounds good!', 'Haha 😄', 'On my way!', 'Nice! 👍', 'Okay!', 'That’s awesome.', 'Let me check and get back to you.']);
}

// ------------------------------------------------------------------ helpers

function initials(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (!w.length || /^[+\d]/.test(name.trim())) return '';
  return Array.from((w[0][0] ?? '') + (w.length > 1 ? (w[w.length - 1][0] ?? '') : '')).join('').toUpperCase();
}

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const ini = initials(name);
  return (
    <span className="t7m-avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {ini || <Glyph name="person.fill" size={size * 0.5} />}
    </span>
  );
}

function when(t: number, use24h: boolean): string {
  const d = new Date(t);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return formatClock(d, use24h);
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
}

// ------------------------------------------------------------------ app

export default function Messages() {
  const api = useRef<NavApi | null>(null);
  useIntent((d) => {
    // a notification tapped: straight into that conversation
    const t = M().threads.find((x) => x.name === d);
    if (t) {
      api.current?.popToRoot();
      window.setTimeout(() => api.current?.push(<Conversation id={t.id} />, ''), 20);
    }
  });
  return <NavStack root={<List />} rootTitle="Messages" onApi={(a) => (api.current = a)} />;
}

function List() {
  const nav = useNav()!;
  const threads = useMessages((s) => s.threads);
  const typing = useMessages((s) => s.typing);
  const use24h = useSettings((s) => s.use24h);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(false);
  const [compose, setCompose] = useState(false);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return threads.filter((t) => t.msgs.length && (!k || t.name.toLowerCase().includes(k) || t.msgs.some((m) => m.text.toLowerCase().includes(k))));
  }, [threads, q]);
  const open = (id: string) => nav.push(<Conversation id={id} />, '');
  return (
    <Page
      title="Messages"
      left={<TextButton onPress={() => setEditing((e) => !e)}>{editing ? 'Done' : 'Edit'}</TextButton>}
      right={
        <button className="t7-gbtn" aria-label="Compose" onClick={() => setCompose(true)}>
          <Glyph name="square.and.pencil" size={22} />
        </button>
      }
      search={<SearchField value={q} onChange={setQ} />}
    >
      {shown.length === 0 && <div className="t7m-empty">{q ? 'No Results' : 'No Messages'}</div>}
      {shown.map((t) => {
        const last = t.msgs[t.msgs.length - 1];
        return (
          <div key={t.id} className="t7m-row" onClick={() => !editing && open(t.id)}>
            {editing && (
              <button
                className="t7m-del"
                aria-label="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  useMessages.setState({ threads: M().threads.filter((x) => x.id !== t.id) });
                }}
              >
                <Glyph name="minus.circle.fill" size={22} />
              </button>
            )}
            <span className={`t7m-unread ${t.unread ? 'on' : ''}`} />
            <Avatar name={t.name} />
            <div className="t7m-row-main">
              <div className="t7m-row-top">
                <b>{t.name}</b>
                <span>
                  {when(last.time, use24h)}
                  <Glyph name="chevron.right" size={11} />
                </span>
              </div>
              <div className="t7m-row-text">{typing.includes(t.id) ? 'typing…' : last.text}</div>
            </div>
          </div>
        );
      })}
      <Sheet open={compose} onClose={() => setCompose(false)}>
        <Compose
          onClose={() => setCompose(false)}
          onPick={(name, first) => {
            setCompose(false);
            const id = findOrCreate(name);
            if (first) send(id, first);
            window.setTimeout(() => open(id), 260);
          }}
        />
      </Sheet>
    </Page>
  );
}

/** New Message: To: a contact (suggested as you type) or any name or number. */
function Compose({ onClose, onPick }: { onClose: () => void; onPick: (name: string, first: string) => void }) {
  const contacts = useLibrary((s) => s.contacts);
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('');
  const k = to.trim().toLowerCase();
  const matches = k
    ? contacts
        .map((c) => ({ c, name: `${c.firstName} ${c.lastName}`.trim() || c.company || '' }))
        .filter((x) => x.name && (x.name.toLowerCase().includes(k) || x.c.phones.some((p) => p.value.includes(k))))
        .slice(0, 6)
    : [];
  return (
    <div className="t7c-editor t7x-compose" data-kb-lift="">
      <SheetHeader title="New Message" right={<TextButton onPress={onClose}>Cancel</TextButton>} />
      <div className="t7x-to">
        <span>To:</span>
        <TextInput value={to} onChange={setTo} autoFocus onEnter={() => to.trim() && onPick(to, msg)} />
      </div>
      <div className="t7x-thread">
        {matches.map((m) => (
          <button key={m.c.id} className="t7m-suggest" onClick={() => onPick(m.name, msg)}>
            <Avatar name={m.name} size={32} />
            <span>
              <b>{m.name}</b>
              <small>{m.c.phones[0]?.value ?? m.c.emails[0]?.value ?? ''}</small>
            </span>
          </button>
        ))}
      </div>
      <MessageBar value={msg} onChange={setMsg} onSend={() => to.trim() && onPick(to, msg)} disabled={!to.trim()} />
    </div>
  );
}

function MessageBar({ value, onChange, onSend, disabled }: { value: string; onChange: (v: string) => void; onSend: () => void; disabled?: boolean }) {
  const can = !!value.trim() && !disabled;
  return (
    <div className="t7x-msgbar">
      <span className="t7x-plus">
        <Glyph name="camera.fill" size={16} />
      </span>
      <div className="t7x-msgin">
        <TextInput value={value} onChange={onChange} placeholder="iMessage" onEnter={() => can && onSend()} />
        <button
          className={`t7m-send ${can ? 'on' : ''}`}
          aria-label="Send"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => can && onSend()}
        >
          <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
            <circle cx="14" cy="14" r="13" fill="currentColor" />
            <path d="M14 20V8M9 12.5 14 7.5l5 5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Conversation({ id }: { id: string }) {
  const thread = useMessages((s) => s.threads.find((t) => t.id === id));
  const typing = useMessages((s) => s.typing.includes(id));
  const use24h = useSettings((s) => s.use24h);
  const [draft, setDraft] = useState('');
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    openThread = id;
    update(id, (t) => (t.unread ? { ...t, unread: 0 } : t));
    return () => {
      if (openThread === id) openThread = null;
    };
  }, [id]);
  const n = thread?.msgs.length ?? 0;
  useLayoutEffect(() => {
    const el = scroll.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [n, typing]);
  if (!thread) return null;
  const lastMine = [...thread.msgs].reverse().find((m) => m.me);
  const lastIsMine = thread.msgs[thread.msgs.length - 1]?.me;
  return (
    <Page
      title={thread.name}
      large={false}
      noScroll
      barAlways
      className="t7m-conv"
      titleView={
        <span className="t7m-head">
          <Avatar name={thread.name} size={30} />
          <small>
            {thread.name} <Glyph name="chevron.right" size={8} />
          </small>
        </span>
      }
    >
      <div className="t7m-body" data-kb-lift="">
        <div className="t7m-scroll" ref={scroll}>
          <div className="t7m-service">iMessage</div>
          {thread.msgs.map((m, i) => {
            const prev = thread.msgs[i - 1];
            const next = thread.msgs[i + 1];
            const stamp = !prev || m.time - prev.time > 15 * 60_000;
            const tail = !next || next.me !== m.me || next.time - m.time > 60_000;
            return (
              <div key={m.id}>
                {stamp && (
                  <div className="t7m-stamp">
                    {when(m.time, use24h) === formatClock(new Date(m.time), use24h) ? `Today ${formatClock(new Date(m.time), use24h)}` : `${when(m.time, use24h)} ${formatClock(new Date(m.time), use24h)}`}
                  </div>
                )}
                <div className={`t7m-msg ${m.me ? 'me' : 'them'} ${tail ? 'tail' : ''}`}>
                  <span>{m.text}</span>
                </div>
                {m === lastMine && lastIsMine && (
                  <div className="t7m-status">{thread.readAt ? `Read ${formatClock(new Date(thread.readAt), use24h)}` : 'Delivered'}</div>
                )}
              </div>
            );
          })}
          {typing && (
            <div className="t7m-msg them tail t7m-typing">
              <span>
                <i />
                <i />
                <i />
              </span>
            </div>
          )}
        </div>
        <MessageBar
          value={draft}
          onChange={setDraft}
          onSend={() => {
            send(id, draft);
            setDraft('');
          }}
        />
      </div>
    </Page>
  );
}

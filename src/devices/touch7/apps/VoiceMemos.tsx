/**
 * Voice Memos (iOS 15): record with the microphone (MediaRecorder) while a
 * live waveform scrolls, recordings list with an inline player.
 */
import { useEffect, useRef, useState } from 'react';
import { putBlob } from '../../../core/db';
import { useLibrary } from '../../../core/library/store';
import { player } from '../../../core/player/player';
import { formatTime } from '../../../core/util/format';
import { uid } from '../../../core/util/id';
import type { VoiceMemo } from '../../../core/types';
import { Glyph } from '../os/glyphs';
import { os } from '../os/store';
import { Empty, NavStack, Page, SearchField, Slider, TextButton, useApp } from '../os/ui';
import { useBlobUrl, useIntent } from './shared';

function memoDate(t: number): string {
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function VoiceMemos() {
  return (
    <div className="t7v-root">
      <NavStack root={<AllRecordings />} rootTitle="All Recordings" />
    </div>
  );
}

function AllRecordings() {
  const memos = useLibrary((s) => s.voiceMemos);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(false);
  const [recState, setRecState] = useState<'idle' | 'rec'>('idle');
  const rec = useRecorder(() => setRecState('idle'));
  const start = () => {
    setOpen(null);
    void rec.start().then((ok) => ok && setRecState('rec'));
  };
  useIntent((d) => d === 'record' && start());
  const list = [...memos].filter((m) => !q.trim() || m.name.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div className="t7v-wrap">
      <Page
        title="All Recordings"
        left={<span />}
        right={memos.length ? <TextButton onPress={() => setEdit(!edit)} bold={edit}>{edit ? 'Done' : 'Edit'}</TextButton> : undefined}
        search={<SearchField value={q} onChange={setQ} />}
        className="t7v-page"
      >
        {list.map((m) => (
          <MemoRow key={m.id} m={m} open={open === m.id} edit={edit} onToggle={() => setOpen(open === m.id ? null : m.id)} />
        ))}
        {!list.length && <Empty title={q ? 'No Results' : 'No Recordings'} text={q ? undefined : 'Tap the Record button to start a Voice Memo.'} />}
      </Page>
      <div className={`t7v-panel ${recState === 'rec' ? 'rec' : ''}`}>
        {recState === 'rec' && (
          <div className="t7v-live">
            <div className="t7v-live-name">{rec.name}</div>
            <div className="t7v-live-date">{memoDate(Date.now())}</div>
            <canvas ref={rec.canvas} width={576} height={120} className="t7v-wave" />
            <div className="t7v-live-time">{fmtRec(rec.elapsed)}</div>
          </div>
        )}
        <button className={`t7v-rec ${recState === 'rec' ? 'on' : ''}`} onClick={() => (recState === 'rec' ? rec.stop() : start())} aria-label={recState === 'rec' ? 'Stop' : 'Record'}>
          <span />
        </button>
      </div>
    </div>
  );
}

function fmtRec(ms: number): string {
  const cs = Math.floor(ms / 10) % 100;
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function useRecorder(onSaved: () => void) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [name, setName] = useState('New Recording');
  const st = useRef<{ mr: MediaRecorder; stream: MediaStream; chunks: Blob[]; t0: number; raf: number; ctx: AudioContext; levels: number[] } | null>(null);
  const app = useApp();

  const cleanup = () => {
    const s = st.current;
    if (!s) return;
    cancelAnimationFrame(s.raf);
    s.stream.getTracks().forEach((t) => t.stop());
    void s.ctx.close().catch(() => {});
  };
  useEffect(() => () => {
    // leaving the app saves the recording, like iOS
    if (st.current && st.current.mr.state !== 'inactive') st.current.mr.stop();
  }, []);
  useEffect(() => {
    if (!app.active && st.current && st.current.mr.state !== 'inactive') st.current.mr.stop();
  }, [app.active]);

  const start = async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      os.alert({ title: 'Recording Not Available', message: 'This browser can’t record audio.', actions: [{ label: 'OK' }] });
      return false;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      os.alert({ title: '“Voice Memos” Would Like to Access the Microphone', message: 'Allow microphone access in your browser to record voice memos.', actions: [{ label: 'OK' }] });
      return false;
    }
    player.pause();
    const n = useLibrary.getState().voiceMemos.filter((m) => /^New Recording/.test(m.name)).length + 1;
    const nm = n > 1 ? `New Recording ${n}` : 'New Recording';
    setName(nm);
    const mr = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const ctx = new AudioContext();
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    const s = { mr, stream, chunks, t0: performance.now(), raf: 0, ctx, levels: [] as number[] };
    st.current = s;
    let lastPush = 0;
    const draw = (now: number) => {
      s.raf = requestAnimationFrame(draw);
      setElapsed(now - s.t0);
      an.getFloatTimeDomainData(buf);
      let rms = 0;
      for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
      rms = Math.sqrt(rms / buf.length);
      if (now - lastPush > 50) {
        lastPush = now;
        s.levels.push(Math.min(1, rms * 6));
        if (s.levels.length > 200) s.levels.shift();
      }
      const c = canvas.current;
      const g = c?.getContext('2d');
      if (!c || !g) return;
      g.clearRect(0, 0, c.width, c.height);
      const mid = c.height / 2;
      const step = 6;
      const head = c.width * 0.66;
      g.fillStyle = '#ff3b30';
      g.fillRect(head, 0, 2, c.height);
      g.fillStyle = 'rgba(128,128,128,0.9)';
      for (let i = s.levels.length - 1, x = head - step; i >= 0 && x > 0; i--, x -= step) {
        const h = Math.max(2, s.levels[i] * c.height * 0.9);
        g.fillRect(x, mid - h / 2, 3, h);
      }
      g.fillStyle = 'rgba(128,128,128,0.35)';
      for (let x = head + step; x < c.width; x += step) g.fillRect(x, mid - 1, 3, 2);
    };
    s.raf = requestAnimationFrame(draw);
    mr.onstop = async () => {
      const dur = (performance.now() - s.t0) / 1000;
      cleanup();
      st.current = null;
      const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
      if (dur > 0.4 && blob.size) {
        const id = uid('vm');
        const key = `voice:${id}`;
        await putBlob(key, blob);
        useLibrary.getState().addVoiceMemo({ id, name: nm, blobKey: key, duration: dur, createdAt: Date.now() });
      }
      setElapsed(0);
      onSaved();
    };
    mr.start(250);
    return true;
  };
  const stop = () => {
    if (st.current && st.current.mr.state !== 'inactive') st.current.mr.stop();
  };
  return { start, stop, canvas, elapsed, name };
}

let current: HTMLAudioElement | null = null;

function MemoRow({ m, open, edit, onToggle }: { m: VoiceMemo; open: boolean; edit: boolean; onToggle: () => void }) {
  const url = useBlobUrl(open ? m.blobKey : undefined);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const dur = m.duration || 0;

  useEffect(() => {
    if (!open || !url) return;
    const a = new Audio(url);
    audio.current = a;
    let raf = 0;
    const tick = () => {
      setPos(a.currentTime);
      raf = requestAnimationFrame(tick);
    };
    a.onplay = () => {
      setPlaying(true);
      raf = requestAnimationFrame(tick);
    };
    a.onpause = () => {
      setPlaying(false);
      cancelAnimationFrame(raf);
    };
    a.onended = () => {
      setPlaying(false);
      setPos(0);
      cancelAnimationFrame(raf);
    };
    return () => {
      cancelAnimationFrame(raf);
      a.pause();
      if (current === a) current = null;
      audio.current = null;
      setPlaying(false);
      setPos(0);
    };
  }, [open, url]);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      current?.pause();
      current = a;
      player.pause();
      void a.play().catch(() => os.toast('Can’t play this recording', 'exclamationmark.triangle'));
    } else a.pause();
  };
  const seek = (t: number) => {
    const a = audio.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(dur, t));
    setPos(a.currentTime);
  };
  const del = () => useLibrary.getState().removeVoiceMemo(m.id);
  return (
    <div className={`t7v-row ${open ? 'open' : ''}`}>
      <div className="t7v-row-head" onClick={edit ? undefined : onToggle}>
        {edit && (
          <button className="t7c-del" onClick={del} aria-label="Delete">
            <Glyph name="minus.circle.fill" size={22} />
          </button>
        )}
        <div className="t7v-row-main">
          <div
            className="t7v-name"
            onClick={(e) => {
              if (!open) return;
              e.stopPropagation();
              os.alert({
                title: 'Rename Recording',
                input: { value: m.name },
                actions: [
                  { label: 'Cancel', style: 'cancel' },
                  { label: 'Save', onPress: (v) => v?.trim() && useLibrary.getState().renameVoiceMemo(m.id, v.trim()) },
                ],
              });
            }}
          >
            {m.name}
          </div>
          <div className="t7v-sub">
            <span>{memoDate(m.createdAt)}</span>
            {!open && <span>{formatTime(dur)}</span>}
          </div>
        </div>
      </div>
      {open && (
        <div className="t7v-player">
          <Slider className="t7v-scrub" value={dur ? pos / dur : 0} thumb onChange={(v) => seek(v * dur)} />
          <div className="t7v-times">
            <span>{formatTime(pos)}</span>
            <span>-{formatTime(Math.max(0, dur - pos))}</span>
          </div>
          <div className="t7v-ctrls">
            <button className="side" aria-label="Options" onClick={() => os.toast('Enhance Recording', 'waveform')}>
              <Glyph name="slider.horizontal.3" size={20} />
            </button>
            <button aria-label="Back 15 seconds" onClick={() => seek(pos - 15)}>
              <Glyph name="gobackward.15" size={26} />
            </button>
            <button className="big" aria-label={playing ? 'Pause' : 'Play'} onClick={toggle} disabled={!url}>
              <Glyph name={playing ? 'pause.fill' : 'play.fill'} size={34} />
            </button>
            <button aria-label="Forward 15 seconds" onClick={() => seek(pos + 15)}>
              <Glyph name="goforward.15" size={26} />
            </button>
            <button className="side del" aria-label="Delete" onClick={del}>
              <Glyph name="trash" size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

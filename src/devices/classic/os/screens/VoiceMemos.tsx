import { useEffect, useMemo, useRef, useState } from 'react';
import { putBlob } from '../../../../core/db';
import { useLibrary } from '../../../../core/library/store';
import { player, usePlayer } from '../../../../core/player/player';
import type { VoiceMemo } from '../../../../core/types';
import { formatTime } from '../../../../core/util/format';
import { uid } from '../../../../core/util/id';
import { useInput, useOS, type OSApi } from '../core';
import { ListView, type Row } from '../ListView';

/** Voice memos play through the shared player as 'voicememo' tracks. */
function playMemo(os: OSApi, m: VoiceMemo) {
  const lib = useLibrary.getState();
  const [t] = lib.addTracks([
    {
      id: `vm_${m.id}`,
      source: 'local',
      ref: m.blobKey,
      mediaType: 'voicememo',
      title: m.name,
      artist: 'Voice Memo',
      album: 'Voice Memos',
      duration: m.duration,
      addedAt: m.createdAt,
      playCount: 0,
      skipCount: 0,
    },
  ]);
  if (t) {
    player.playTracks([t.id], 0);
    os.nav.nowPlaying();
  }
}

export function VoiceMemosScreen() {
  const os = useOS();
  const memos = useLibrary((s) => s.voiceMemos);
  const current = usePlayer((s) => s.currentId);
  const rows = useMemo<Row[]>(
    () => [
      { key: '__rec', label: 'Start Recording', chevron: true, onSelect: () => os.nav.push({ title: 'Record', el: <Recorder /> }) },
      ...[...memos]
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((m) => ({
          key: m.id,
          label: m.name,
          detail: formatTime(m.duration),
          speaker: current === `vm_${m.id}`,
          onSelect: () => playMemo(os, m),
          onHold: () =>
            os.menu({
              title: m.name,
              options: [
                { label: 'Play', action: () => playMemo(os, m) },
                {
                  label: 'Delete',
                  action: () => {
                    useLibrary.getState().removeTracks([`vm_${m.id}`].filter((id) => useLibrary.getState().tracks[id]));
                    useLibrary.getState().removeVoiceMemo(m.id);
                  },
                },
                { label: 'Cancel' },
              ],
            }),
        })),
    ],
    [memos, current, os],
  );
  return <ListView rows={rows} />;
}

type RecState = 'idle' | 'starting' | 'recording' | 'paused' | 'error';

function Recorder() {
  const os = useOS();
  const [state, setState] = useState<RecState>('idle');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [sel, setSel] = useState(0);
  const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; chunks: Blob[]; t0: number; acc: number; raf: number; an: AnalyserNode | null; ctx: AudioContext | null } | null>(null);

  const cleanup = () => {
    const r = rec.current;
    if (!r) return;
    cancelAnimationFrame(r.raf);
    r.stream.getTracks().forEach((t) => t.stop());
    void r.ctx?.close();
    rec.current = null;
  };
  useEffect(() => cleanup, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setState('error');
      setError('Recording is not supported in this browser.');
      return;
    }
    setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      let an: AnalyserNode | null = null;
      let ctx: AudioContext | null = null;
      try {
        ctx = new AudioContext();
        an = ctx.createAnalyser();
        an.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(an);
      } catch {
        /* meter is optional */
      }
      rec.current = { mr, stream, chunks, t0: performance.now(), acc: 0, raf: 0, an, ctx };
      mr.start(250);
      setState('recording');
      const buf = new Uint8Array(128);
      const tick = () => {
        const r = rec.current;
        if (!r) return;
        r.raf = requestAnimationFrame(tick);
        if (r.mr.state === 'recording') setElapsed((r.acc + performance.now() - r.t0) / 1000);
        if (r.an) {
          r.an.getByteTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
          setLevel(peak / 128);
        }
      };
      tick();
    } catch (e) {
      setState('error');
      setError(e instanceof Error && e.name === 'NotAllowedError' ? 'Microphone access was denied.' : 'No microphone is available.');
    }
  };

  const pause = () => {
    const r = rec.current;
    if (!r) return;
    if (r.mr.state === 'recording') {
      r.mr.pause();
      r.acc += performance.now() - r.t0;
      setState('paused');
    } else if (r.mr.state === 'paused') {
      r.mr.resume();
      r.t0 = performance.now();
      setState('recording');
    }
  };

  const save = () => {
    const r = rec.current;
    if (!r) return;
    const duration = elapsed;
    r.mr.onstop = async () => {
      const blob = new Blob(r.chunks, { type: r.mr.mimeType || 'audio/webm' });
      const id = uid('vm');
      const key = `memo:${id}`;
      await putBlob(key, blob);
      const d = new Date();
      useLibrary.getState().addVoiceMemo({
        id,
        name: d.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
        blobKey: key,
        duration,
        createdAt: d.getTime(),
      });
      cleanup();
      os.hud('Voice Memo Saved');
      os.nav.pop();
    };
    r.mr.stop();
  };

  const options = state === 'idle' || state === 'error' ? ['Record'] : state === 'starting' ? [] : [state === 'paused' ? 'Resume' : 'Pause', 'Stop and Save'];
  useInput((e) => {
    if (e.type === 'scroll') {
      setSel((s) => Math.max(0, Math.min(options.length - 1, s + e.steps)));
      return true;
    }
    if ((e.type === 'click' && e.button === 'select') || (e.type === 'click' && e.button === 'play')) {
      const o = options[e.button === 'play' ? 0 : sel];
      if (o === 'Record') void start();
      else if (o === 'Pause' || o === 'Resume') pause();
      else if (o === 'Stop and Save') save();
      return true;
    }
    if (e.type === 'click' && e.button === 'menu' && rec.current) {
      os.menu({ title: 'Discard this recording?', options: [{ label: 'Discard', action: () => (cleanup(), os.nav.pop()) }, { label: 'Stop and Save', action: save }, { label: 'Cancel' }] });
      return true;
    }
    return false;
  });

  return (
    <div className="cl-rec">
      <div className="cl-rec-top">
        <span className={`cl-rec-dot ${state === 'recording' ? 'on' : ''}`} />
        <span className="cl-rec-time">{formatTime(elapsed)}</span>
      </div>
      <div className="cl-rec-meter">
        <div style={{ width: `${Math.min(100, level * 140)}%` }} />
      </div>
      {state === 'error' && <div className="cl-rec-error">{error}</div>}
      <div className="cl-rec-opts">
        {options.map((o, i) => (
          <div key={o} className={`cl-rec-opt ${i === Math.min(sel, options.length - 1) ? 'cl-sel' : ''}`}>
            {o}
          </div>
        ))}
      </div>
    </div>
  );
}

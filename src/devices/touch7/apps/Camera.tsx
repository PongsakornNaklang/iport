/**
 * Camera (iOS 15): live viewfinder from getUserMedia, PHOTO / SQUARE / VIDEO
 * modes (no flash: the iPod touch has none), front/back switch, shutter on screen or with the volume
 * buttons. Photos go to the Photos library, videos to TV ▸ Home Videos and
 * Photos ▸ Videos.
 */
import { useEffect, useRef, useState } from 'react';
import { putBlob } from '../../../core/db';
import { useLibrary } from '../../../core/library/store';
import { player } from '../../../core/player/player';
import { playTone } from '../../../core/sound/click';
import { uid } from '../../../core/util/id';
import type { Photo } from '../../../core/types';
import { Glyph } from '../os/glyphs';
import { os, useOS, useStatusBar } from '../os/store';
import { useApp } from '../os/ui';
import { useBlobUrl } from './shared';

type Mode = 'TIME-LAPSE' | 'SLO-MO' | 'VIDEO' | 'PHOTO' | 'SQUARE' | 'PANO';
const MODES: Mode[] = ['TIME-LAPSE', 'SLO-MO', 'VIDEO', 'PHOTO', 'SQUARE', 'PANO'];

function shutterSound() {
  playTone(2400, 30, { volume: 0.12, type: 'square' });
  playTone(1200, 60, { volume: 0.08, delayMs: 40, type: 'triangle' });
}

let photoSeq = (() => {
  try {
    return Number(localStorage.getItem('iport-t7-imgseq') || 1000);
  } catch {
    return 1000;
  }
})();

export default function Camera() {
  const app = useApp();
  const locked = useOS((s) => s.locked);
  const screenOn = useOS((s) => s.screenOn);
  const shutterSerial = useOS((s) => s.shutterSerial);
  const video = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('PHOTO');
  const [blink, setBlink] = useState(0);
  const [rec, setRec] = useState<{ t0: number; mr: MediaRecorder; chunks: Blob[] } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const photos = useLibrary((s) => s.photos);
  const last = [...photos].sort((a, b) => b.addedAt - a.addedAt)[0];
  const thumb = useBlobUrl(last?.blobKey);
  const live = app.active && !locked && screenOn;
  useStatusBar('camera', 'hidden', app.active);

  // start / stop the camera with the app
  useEffect(() => {
    if (!live) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera isn’t available in this browser.');
      return;
    }
    let alive = true;
    let s: MediaStream | null = null;
    setError(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then((st) => {
        if (!alive) {
          st.getTracks().forEach((t) => t.stop());
          return;
        }
        s = st;
        setStream(st);
      })
      .catch(() => alive && setError('Allow camera access in your browser to take pictures.'));
    return () => {
      alive = false;
      s?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [live, facing]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.srcObject = stream;
    if (stream) void v.play().catch(() => {});
  }, [stream]);

  useEffect(() => {
    if (!rec) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [rec]);
  // stop recording when leaving
  useEffect(() => {
    if (!live && rec) stopRec();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const capture = async () => {
    const v = video.current;
    if (!v || !stream || busy) return;
    setBusy(true);
    shutterSound();
    setBlink((b) => b + 1);
    const vw = v.videoWidth || 640;
    const vh = v.videoHeight || 480;
    // 3:4 portrait crop (or square)
    const ar = mode === 'SQUARE' ? 1 : 3 / 4;
    let cw = vw;
    let ch = cw / ar;
    if (ch > vh) {
      ch = vh;
      cw = ch * ar;
    }
    const c = document.createElement('canvas');
    c.width = Math.round(cw);
    c.height = Math.round(ch);
    const g = c.getContext('2d')!;
    if (facing === 'user') {
      g.translate(c.width, 0);
      g.scale(-1, 1);
    }
    g.drawImage(v, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.9));
    if (blob) {
      const id = uid('ph');
      const key = `photo:${id}`;
      await putBlob(key, blob);
      photoSeq++;
      try {
        localStorage.setItem('iport-t7-imgseq', String(photoSeq));
      } catch {
        /* private mode */
      }
      const p: Photo = { id, name: `IMG_${facing === 'user' ? 'F' : ''}${photoSeq}.JPG`, blobKey: key, width: c.width, height: c.height, addedAt: Date.now(), album: 'Camera' };
      useLibrary.getState().addPhotos([p]);
    }
    setBusy(false);
  };

  const startRec = () => {
    if (!stream || typeof MediaRecorder === 'undefined') {
      os.toast('Video recording isn’t supported here', 'video');
      return;
    }
    player.pause();
    const mr = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const t0 = Date.now();
    // poster frame for TV / Photos
    let poster: Blob | null = null;
    const v = video.current;
    if (v && v.videoWidth) {
      const c = document.createElement('canvas');
      c.width = 480;
      c.height = Math.round((480 * v.videoHeight) / v.videoWidth);
      const g = c.getContext('2d')!;
      if (facing === 'user') {
        g.translate(c.width, 0);
        g.scale(-1, 1);
      }
      g.drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((b) => (poster = b), 'image/jpeg', 0.8);
    }
    mr.onstop = async () => {
      const dur = (Date.now() - t0) / 1000;
      const blob = new Blob(chunks, { type: mr.mimeType || 'video/webm' });
      if (!blob.size || dur < 0.5) return;
      const id = uid('t');
      const key = `media:${id}`;
      await putBlob(key, blob);
      let artwork: string | undefined;
      if (poster) {
        await putBlob(`art:${id}`, poster);
        artwork = `idb:art:${id}`;
      }
      const d = new Date(t0);
      useLibrary.getState().addTracks([
        {
          id,
          source: 'local',
          ref: key,
          mediaType: 'movie',
          hasVideo: true,
          title: `Video ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
          artist: 'iPod Camera',
          album: 'Camera',
          genre: 'Home Video',
          duration: dur,
          artwork,
          addedAt: Date.now(),
          playCount: 0,
          skipCount: 0,
        },
      ]);
      os.toast('Saved to Home Videos', 'video.fill');
    };
    mr.start(500);
    setRec({ t0, mr, chunks });
    setNow(Date.now());
    playTone(1500, 120, { volume: 0.1 });
  };
  const stopRec = () => {
    if (!rec) return;
    if (rec.mr.state !== 'inactive') rec.mr.stop();
    setRec(null);
    playTone(1100, 120, { volume: 0.1 });
  };

  const shutter = () => {
    if (mode === 'VIDEO' || mode === 'SLO-MO' || mode === 'TIME-LAPSE') {
      if (rec) stopRec();
      else startRec();
      return;
    }
    if (mode === 'PANO') {
      os.toast('Move iPod continuously', 'arrow.left.arrow.right');
      return;
    }
    void capture();
  };

  // volume buttons
  const firstSerial = useRef(shutterSerial);
  useEffect(() => {
    if (shutterSerial === firstSerial.current) return;
    firstSerial.current = shutterSerial;
    shutter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shutterSerial]);

  const videoMode = mode === 'VIDEO' || mode === 'SLO-MO' || mode === 'TIME-LAPSE';
  const mi = MODES.indexOf(mode);
  const elapsed = rec ? Math.floor((now - rec.t0) / 1000) : 0;
  const swipe = useRef<{ x: number } | null>(null);
  return (
    <div className="t7cam">
      <div className={`t7cam-top ${rec ? 'rec' : ''}`}>
        {rec ? (
          <span className="t7cam-timer">
            {String(Math.floor(elapsed / 3600)).padStart(2, '0')}:{String(Math.floor(elapsed / 60) % 60).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
          </span>
        ) : (
          <>
            {/* no flash on the iPod touch: a spacer keeps the controls where they were */}
            <span className="t7cam-noflash" aria-hidden="true" />
            <button aria-label="Options" onClick={() => os.toast('Live Photos Off', 'circle.lefthalf.filled')}>
              <Glyph name="chevron.up" size={16} />
            </button>
            <button aria-label="Live Photos" onClick={() => os.toast('Live Photos Off', 'circle.lefthalf.filled')}>
              <span className="t7cam-live" />
            </button>
          </>
        )}
      </div>
      <div
        className={`t7cam-view ${mode === 'SQUARE' ? 'square' : ''} ${videoMode ? 'video' : ''}`}
        onPointerDown={(e) => (swipe.current = { x: e.clientX })}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s || rec) return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > 40) setMode(MODES[Math.max(0, Math.min(MODES.length - 1, mi + (dx < 0 ? 1 : -1)))]);
        }}
      >
        <video ref={video} className={facing === 'user' ? 'mirror' : ''} muted playsInline autoPlay />
        {error && (
          <div className="t7cam-err">
            <Glyph name="camera.fill" size={34} />
            <span>{error}</span>
          </div>
        )}
        {!error && !stream && live && <div className="t7cam-err dim">Opening camera…</div>}
        <div key={blink} className={`t7cam-blink ${blink ? 'go' : ''}`} />
      </div>
      <div className="t7cam-modes" style={{ transform: `translateX(${-(mi - 3) * 74}px)` }}>
        {MODES.map((m) => (
          <button key={m} className={m === mode ? 'on' : ''} onClick={() => !rec && setMode(m)}>
            {m}
          </button>
        ))}
      </div>
      <div className="t7cam-bottom">
        <button className="t7cam-thumb" aria-label="Photos" onClick={() => os.openAppWith('photos', 'latest')}>
          {thumb && <img src={thumb} alt="" draggable={false} />}
        </button>
        <button className={`t7cam-shutter ${videoMode ? 'video' : ''} ${rec ? 'rec' : ''}`} aria-label="Shutter" onClick={shutter} disabled={!stream}>
          <span />
        </button>
        <button className="t7cam-flip" aria-label="Switch Camera" disabled={!!rec} onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}>
          <Glyph name="camera.rotate" size={24} />
        </button>
      </div>
    </div>
  );
}

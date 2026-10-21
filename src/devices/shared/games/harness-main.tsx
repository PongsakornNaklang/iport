import { createRoot } from 'react-dom/client';
import { GamesHarness } from './Harness';
import { useLibrary } from '../../../core/library/store';
import type { Track } from '../../../core/types';

const q = new URLSearchParams(location.search);

function wav(freqs: number[], seconds: number): Blob {
  const sr = 22050;
  const n = Math.floor(sr * seconds);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = freqs[Math.floor(t * 4) % freqs.length];
    v.setInt16(44 + i * 2, Math.sin(2 * Math.PI * f * t) * 6000 * (0.6 + 0.4 * Math.sin(t * 8)), true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

if (q.get('seed')) {
  const titles = ['Clickwheel Blues', 'Firewire', 'Cover Flow Waltz', 'Hold Switch Hop', 'Shuffle Song', 'Nano Dreams', 'Dock Connector'];
  const add = () => {
    const tracks: Track[] = titles.map((title, i) => ({
      id: `seed${i}`,
      source: 'url',
      ref: URL.createObjectURL(wav([220 * (1 + i / 7), 330, 262 + i * 20, 392], 40)),
      mediaType: 'music',
      title,
      artist: `Test Artist ${i + 1}`,
      album: 'Harness',
      addedAt: Date.now(),
      playCount: 0,
      skipCount: 0,
    }));
    useLibrary.getState().addTracks(tracks);
  };
  if (useLibrary.getState().hydrated) add();
  else {
    const un = useLibrary.subscribe((s) => {
      if (s.hydrated) {
        un();
        add();
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <GamesHarness gameId={q.get('game') ?? 'brick'} color={!q.get('mono')} />,
);

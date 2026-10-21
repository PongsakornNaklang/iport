import { useEffect, useRef, type CSSProperties } from 'react';
import { registerHost } from './mediaHost';
import { getHtml5Element, usePlayer } from './player';

/**
 * Put exactly one <MediaLayer> inside a device screen and keep it mounted
 * for as long as the screen exists. YouTube / SoundCloud iframes live in it;
 * local video is painted into it. Toggle `visible` to show the picture
 * (Now Playing video, YouTube "artwork"), otherwise it stays hidden behind the UI.
 */
export function MediaLayer({
  visible,
  style,
  className,
  fit = 'contain',
}: {
  visible: boolean;
  style?: CSSProperties;
  className?: string;
  fit?: 'contain' | 'cover';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const kind = usePlayer((s) => s.kind);

  useEffect(() => {
    if (!ref.current) return;
    return registerHost(ref.current);
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      data-media-layer=""
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: visible ? '#000' : 'transparent',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
        transition: 'opacity 200ms',
        zIndex: visible ? 5 : -1,
        ...style,
      }}
    >
      {kind === 'html5' && visible && <VideoCanvas fit={fit} />}
    </div>
  );
}

/** Paints frames of the shared <video> element into a canvas. */
export function VideoCanvas({ fit = 'contain', style }: { fit?: 'contain' | 'cover'; style?: CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      const v = getHtml5Element();
      if (!c || !v) return;
      const w = c.clientWidth;
      const h = c.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      const g = c.getContext('2d');
      if (!g) return;
      g.fillStyle = '#000';
      g.fillRect(0, 0, c.width, c.height);
      if (!v.videoWidth || v.readyState < 2) return;
      const s = fit === 'contain' ? Math.min(c.width / v.videoWidth, c.height / v.videoHeight) : Math.max(c.width / v.videoWidth, c.height / v.videoHeight);
      const dw = v.videoWidth * s;
      const dh = v.videoHeight * s;
      try {
        g.drawImage(v, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
      } catch {
        /* frame not ready */
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [fit]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block', ...style }} />;
}

/** True when the current item has a picture (local video or YouTube). */
export function useHasVideo(): boolean {
  return usePlayer((s) => s.hasVideo);
}

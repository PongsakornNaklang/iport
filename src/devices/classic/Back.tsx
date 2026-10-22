import type { CSSProperties } from 'react';
import { Decals } from '../../shell/decals/Decals';
import type { Decal } from '../types';
import { APPLE_PATH } from './os/glyphs';
import { shade } from './color';

/**
 * The stainless steel back: mirror chrome whose reflections follow the
 * stage rotation (--lx / --ly), the Apple logo, the "iPod" wordmark,
 * engraving and the small print.
 */
export function ClassicBack({
  material,
  color,
  engraving,
  decals,
  capacity,
  model,
}: {
  material: string;
  color: string;
  engraving: [string, string];
  decals?: Decal[];
  capacity: string;
  model: string;
}) {
  const style = { ['--paint' as string]: color, ['--paint-hi' as string]: shade(color, 0.25), ['--paint-lo' as string]: shade(color, -0.3) } as CSSProperties;
  const lines = engraving.filter((l) => l && l.trim());
  return (
    <div className={`cl-back cl-back-${material}`} style={style}>
      <div className="cl-back-base" />
      <div className="cl-back-env" />
      <div className="cl-back-streak" />
      <div className="cl-back-glint" />
      <svg className="cl-back-logo" width="104" height="118" viewBox="10 0 150 170" aria-hidden>
        <defs>
          <linearGradient id="clLogoEtch" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.0)" />
            <stop offset="0.5" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <path d={APPLE_PATH} className="cl-logo-shape" />
        <path d={APPLE_PATH} fill="url(#clLogoEtch)" />
      </svg>
      <div className="cl-back-wordmark">iPod</div>
      {lines.length > 0 && (
        <div className="cl-back-engraving">
          {lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
      <Decals
        decals={decals}
        ink={material === 'painted' ? 'rgba(255,255,255,0.6)' : 'rgba(30,32,38,0.6)'}
        shadow={material === 'painted' ? '0 -1px 0 rgba(0,0,0,0.2)' : '0 1px 0 rgba(255,255,255,0.6), 0 -0.5px 0 rgba(0,0,0,0.25)'}
      />
      <div className="cl-back-print">
        <div>Designed by Apple in California. Assembled in China.</div>
        <div>
          Model No.: A1238 &nbsp;EMC No.: 2173 &nbsp;{capacity}
        </div>
        <div className="cl-back-marks">
          <Marks />
          <span>{model}LL/A</span>
        </div>
      </div>
    </div>
  );
}

/** Regulatory marks: CE, FC, the crossed-out bin. */
function Marks() {
  return (
    <svg width="62" height="11" viewBox="0 0 62 11" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.1">
        <path d="M7.2 1.6a4 4 0 1 0 0 7.8" />
        <path d="M14.4 1.6a4 4 0 1 0 0 7.8M10.6 5.5h3.6" />
        <path d="M22 1.4v8.2M22 1.4h4M22 5.3h3M28.5 1.6a4 4 0 1 0 0 7.8" />
        <path d="M40 2.6h6l-0.8 7.2h-4.4zM39.4 2.6h7.2M41.8 1.4h2.4M39 1.2l8 9.4M47 1.2l-8 9.4" />
        <rect x="52" y="1.4" width="8.5" height="8.2" rx="1.5" />
        <path d="M54 5.5l1.6 1.6 3-3.2" />
      </g>
    </svg>
  );
}

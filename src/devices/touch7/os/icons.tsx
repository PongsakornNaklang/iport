/**
 * iOS 15 app icons, drawn in SVG on a 60×60 grid.
 */
import { memo, useId, type ReactNode } from 'react';
import { useNow } from '../../../core/util/hooks';

export const APPLE_LOGO =
  'M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.197-2.12-9.973-3.17-14.34-3.17-4.58 0-9.492 1.05-14.746 3.17-5.262 2.13-9.501 3.24-12.742 3.35-4.929.21-9.842-1.96-14.746-6.52-3.13-2.73-7.045-7.41-11.735-14.04-5.032-7.08-9.169-15.29-12.41-24.65-3.471-10.11-5.211-19.9-5.211-29.378 0-10.857 2.346-20.221 7.045-28.068 3.693-6.303 8.606-11.275 14.755-14.925s12.793-5.51 19.948-5.629c3.915 0 9.049 1.211 15.429 3.591 6.362 2.388 10.447 3.599 12.238 3.599 1.339 0 5.877-1.416 13.57-4.239 7.275-2.618 13.415-3.702 18.445-3.275 13.63 1.1 23.87 6.473 30.68 16.153-12.19 7.386-18.22 17.731-18.1 31.002.11 10.337 3.86 18.939 11.23 25.769 3.34 3.17 7.07 5.62 11.22 7.36-.9 2.61-1.85 5.11-2.86 7.51zM119.11 7.24c0 8.102-2.96 15.667-8.86 22.669-7.12 8.324-15.732 13.134-25.071 12.375a25.222 25.222 0 0 1-.188-3.07c0-7.778 3.386-16.102 9.399-22.908 3.002-3.446 6.82-6.311 11.45-8.597 4.62-2.252 8.99-3.497 13.1-3.71.12 1.083.17 2.166.17 3.24z';

let SFX = '';
const u = (id: string) => `url(#${id}${SFX})`;

const lg = (id: string, a: string, b: string, x2 = 0, y2 = 1) => (
  <linearGradient id={id + SFX} x1="0" y1="0" x2={x2} y2={y2}>
    <stop offset="0" stopColor={a} />
    <stop offset="1" stopColor={b} />
  </linearGradient>
);

function Svg({ children, bg }: { children?: ReactNode; bg?: string }) {
  return (
    <svg viewBox="0 0 60 60" width="100%" height="100%" style={{ display: 'block' }}>
      {bg && <rect width="60" height="60" fill={bg} />}
      {children}
    </svg>
  );
}

function CalendarIcon() {
  const now = useNow(60_000);
  const day = now.toLocaleDateString('en-US', { weekday: 'long' });
  return (
    <Svg bg="#fff">
      <text x="30" y="16.5" textAnchor="middle" fontSize="8.6" fontWeight="500" fill="#ff3b30" fontFamily="-apple-system, 'SF Pro Text', Helvetica, Arial">
        {day}
      </text>
      <text x="30" y="47" textAnchor="middle" fontSize="31" fontWeight="300" fill="#000" fontFamily="-apple-system, 'SF Pro Display', Helvetica, Arial" letterSpacing="-1">
        {now.getDate()}
      </text>
    </Svg>
  );
}

function ClockIcon() {
  const now = useNow(1000);
  const s = now.getSeconds();
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  const hand = (deg: number, len: number, w: number, color: string, back = 0) => (
    <line x1="30" y1={30 + back} x2="30" y2={30 - len} stroke={color} strokeWidth={w} strokeLinecap="round" transform={`rotate(${deg} 30 30)`} />
  );
  return (
    <Svg bg="#000">
      <circle cx="30" cy="30" r="25.5" fill="#fff" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = ((i + 1) * 30 * Math.PI) / 180;
        return (
          <text key={i} x={30 + Math.sin(a) * 19.5} y={30 - Math.cos(a) * 19.5 + 2.6} textAnchor="middle" fontSize="7" fill="#000" fontFamily="-apple-system, Helvetica, Arial">
            {i + 1}
          </text>
        );
      })}
      {Array.from({ length: 60 }, (_, i) => (
        <line key={i} x1="30" y1="5.6" x2="30" y2={i % 5 ? 6.6 : 7.2} stroke="#888" strokeWidth=".5" transform={`rotate(${i * 6} 30 30)`} />
      ))}
      {hand(h * 30, 12, 2.2, '#000')}
      {hand(m * 6, 19, 1.6, '#000')}
      {hand(s * 6, 21, 0.7, '#ff9500', 5)}
      <circle cx="30" cy="30" r="1.6" fill="#ff9500" />
      <circle cx="30" cy="30" r=".6" fill="#fff" />
    </Svg>
  );
}

const PETALS = ['#f9c12e', '#f79a30', '#ee5545', '#d7448f', '#9b5fc0', '#4b7fe0', '#41b8c8', '#7cc451'];

const ICONS: Record<string, () => ReactNode> = {
  messages: () => (
    <Svg>
      <defs>{lg('msg', '#6ef37f', '#0dbd2c')}</defs>
      <rect width="60" height="60" fill={u('msg')} />
      <path fill="#fff" d="M30 12.5c-10.8 0-19.5 7.3-19.5 16.3 0 5.3 3 10 7.7 13-.2 2.4-1.4 4.8-3.6 6.7 3.8-.2 7.3-1.6 9.8-3.6 1.8.4 3.6.6 5.6.6 10.8 0 19.5-7.3 19.5-16.3S40.8 12.5 30 12.5Z" />
    </Svg>
  ),
  facetime: () => (
    <Svg>
      <defs>{lg('ft', '#6ef37f', '#0dbd2c')}</defs>
      <rect width="60" height="60" fill={u('ft')} />
      <rect x="10.5" y="20" width="26" height="20" rx="5.2" fill="#fff" />
      <path fill="#fff" d="m39 27.6 8.4-5.6c.9-.6 2.1 0 2.1 1.1v13.8c0 1.1-1.2 1.7-2.1 1.1L39 32.4z" />
    </Svg>
  ),
  mail: () => (
    <Svg>
      <defs>{lg('ml', '#21c0fd', '#1a69f2')}</defs>
      <rect width="60" height="60" fill={u('ml')} />
      <rect x="10" y="17" width="40" height="27" rx="3.5" fill="#fff" />
      <path d="M11 18.5 30 33l19-14.5" fill="none" stroke="#1e8cf6" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m11 42.5 14-11.5M49 42.5 35 31" fill="none" stroke="#bcd9f8" strokeWidth="1.3" />
    </Svg>
  ),
  safari: () => (
    <Svg bg="#fff">
      <defs>{lg('sf', '#1fd2fc', '#1b6ff0')}</defs>
      <circle cx="30" cy="30" r="24.5" fill={u('sf')} />
      {Array.from({ length: 72 }, (_, i) => (
        <line key={i} x1="30" y1="7.8" x2="30" y2={i % 2 ? 9.6 : 10.6} stroke="#fff" strokeWidth={i % 6 ? 0.45 : 0.9} transform={`rotate(${i * 5} 30 30)`} />
      ))}
      <g transform="rotate(45 30 30)">
        <path d="M30 12.5 33 30h-6z" fill="#ff3b30" />
        <path d="M30 47.5 27 30h6z" fill="#fff" />
      </g>
    </Svg>
  ),
  music: () => (
    <Svg>
      <defs>{lg('mu', '#fb5c74', '#fa233b')}</defs>
      <rect width="60" height="60" fill={u('mu')} />
      <path
        fill="#fff"
        d="M41.6 12.3 23.7 16c-1 .2-1.6 1-1.6 2v20.1a6.3 6.3 0 0 0-3.4-1c-3.4 0-6.2 2.4-6.2 5.3s2.6 4.9 5.5 4.9c3.6 0 6.3-2.6 6.3-6.4V25l15.5-3.2v12.6a6.3 6.3 0 0 0-3.4-1c-3.4 0-6.2 2.4-6.2 5.3s2.6 4.9 5.5 4.9c3.6 0 6.3-2.6 6.3-6.4V14c0-1.1-.9-1.9-2-1.7Z"
      />
    </Svg>
  ),
  calendar: () => <CalendarIcon />,
  photos: () => (
    <Svg bg="#fff">
      <g style={{ mixBlendMode: 'multiply' }}>
        {PETALS.map((c, i) => (
          <ellipse key={i} cx="30" cy="18.5" rx="6.6" ry="11.4" fill={c} opacity=".88" transform={`rotate(${i * 45} 30 30)`} style={{ mixBlendMode: 'multiply' }} />
        ))}
      </g>
    </Svg>
  ),
  camera: () => (
    <Svg>
      <defs>
        {lg('cm', '#eeeef0', '#a5a5ab')}
        {lg('cmb', '#3a3a3c', '#1c1c1e')}
      </defs>
      <rect width="60" height="60" fill={u('cm')} />
      <path fill={u('cmb')} d="M9 22.5c0-1.9 1.6-3.5 3.5-3.5H19l2.3-3.3c.5-.7 1.3-1.2 2.2-1.2h11c.9 0 1.7.5 2.2 1.2L39 19h8.5c1.9 0 3.5 1.6 3.5 3.5V42c0 1.9-1.6 3.5-3.5 3.5h-35A3.5 3.5 0 0 1 9 42Z" />
      <circle cx="30" cy="32" r="9.6" fill="#8e8e93" />
      <circle cx="30" cy="32" r="7.6" fill="#1c1c1e" />
      <circle cx="30" cy="32" r="4.4" fill="#2f3e57" />
      <circle cx="28.4" cy="30.3" r="1.4" fill="#9fb4d4" opacity=".7" />
      <rect x="42" y="22.5" width="4.5" height="2.4" rx="1" fill="#8e8e93" />
    </Svg>
  ),
  clock: () => <ClockIcon />,
  maps: () => (
    <Svg bg="#efe9dc">
      <path d="M0 0h26l-6 20L0 27z" fill="#b8dc9c" />
      <path d="M34 60l9-22 17 6v16z" fill="#b8dc9c" />
      <path d="M-2 40 62 18" stroke="#fff" strokeWidth="5" />
      <path d="M18 -2 34 62" stroke="#f6c443" strokeWidth="6" />
      <path d="M18 -2 34 62" stroke="#f9dd8a" strokeWidth="2" />
      <path d="M-2 52 62 36" stroke="#fff" strokeWidth="3" />
      <path d="M44 -2c-6 20-4 40 10 64" fill="none" stroke="#5aa2f2" strokeWidth="7" />
      <g transform="translate(9 31)">
        <path d="M0 0h12v6c0 3.5-2.7 6-6 7-3.3-1-6-3.5-6-7z" fill="#fff" />
        <path d="M1 1h10v5.6c0 3-2.2 5-5 6-2.8-1-5-3-5-6z" fill="#2154b8" />
        <path d="M1 1h10v3H1z" fill="#d93b3b" />
        <text x="6" y="9.5" textAnchor="middle" fontSize="4.6" fontWeight="700" fill="#fff" fontFamily="Helvetica, Arial">280</text>
      </g>
      <circle cx="44" cy="15" r="7.5" fill="#fff" />
      <circle cx="44" cy="15" r="6" fill="#1b7cf5" />
      <path d="m40.6 16 7-3.4-3.4 7-.8-2.8z" fill="#fff" />
    </Svg>
  ),
  weather: () => (
    <Svg>
      <defs>
        {lg('we', '#1c6bd8', '#59b8f7')}
        <radialGradient id={'wsun' + SFX} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffe14d" />
          <stop offset="1" stopColor="#ffc40a" />
        </radialGradient>
      </defs>
      <rect width="60" height="60" fill={u('we')} />
      <circle cx="22" cy="23" r="9.5" fill={u('wsun')} />
      <path fill="#fff" d="M22.5 46h21a7.5 7.5 0 0 0 1-14.9 10 10 0 0 0-18.8-2.6A8.8 8.8 0 0 0 22.5 46Z" />
    </Svg>
  ),
  reminders: () => (
    <Svg bg="#fff">
      {[
        ['#0a7aff', 17],
        ['#ff3b30', 30],
        ['#ff9500', 43],
      ].map(([c, y]) => (
        <g key={String(c)}>
          <circle cx="15" cy={y as number} r="4.6" fill="none" stroke={c as string} strokeWidth="1.4" />
          <circle cx="15" cy={y as number} r="3" fill={c as string} />
          <rect x="24" y={(y as number) - 0.6} width="27" height="1.2" fill="#d1d1d6" />
        </g>
      ))}
    </Svg>
  ),
  notes: () => (
    <Svg bg="#fff">
      <defs>{lg('nt', '#ffe35b', '#fcc419')}</defs>
      <rect width="60" height="17" fill={u('nt')} />
      <path d="M0 17h60" stroke="#e8b50f" strokeWidth=".8" />
      {Array.from({ length: 30 }, (_, i) => (
        <circle key={i} cx={1 + i * 2} cy="19.4" r=".5" fill="#c7c7cc" />
      ))}
      <path d="M5 30h50M5 40h50M5 50h50" stroke="#d6d6db" strokeWidth=".9" />
    </Svg>
  ),
  books: () => (
    <Svg>
      <defs>{lg('bk', '#ffa02e', '#ff6a00')}</defs>
      <rect width="60" height="60" fill={u('bk')} />
      <path fill="#fff" d="M28.6 19.4c-3.7-2.6-9.3-3.6-15.6-2.8v24.2c6.2-.7 11.8.3 15.6 2.9zM31.4 19.4c3.7-2.6 9.3-3.6 15.6-2.8v24.2c-6.2-.7-11.8.3-15.6 2.9z" />
    </Svg>
  ),
  appstore: () => (
    <Svg>
      <defs>{lg('as', '#1ac6fb', '#1d6ff2')}</defs>
      <rect width="60" height="60" fill={u('as')} />
      <g stroke="#fff" strokeWidth="4.2" strokeLinecap="round" fill="none">
        <path d="M27.5 15.5 16.5 41" />
        <path d="M32.5 15.5 46 44" />
        <path d="M14 35.5h20.5" />
        <path d="M41 35.5h5.5" />
      </g>
    </Svg>
  ),
  podcasts: () => (
    <Svg>
      <defs>{lg('pc', '#d36ef7', '#8a2ccd')}</defs>
      <rect width="60" height="60" fill={u('pc')} />
      <circle cx="30" cy="25.5" r="5" fill="#fff" />
      <rect x="26.8" y="33" width="6.4" height="16" rx="3.2" fill="#fff" />
      <path d="M21.3 34.2a12 12 0 1 1 17.4 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M18.8 41.6a19 19 0 1 1 22.4 0" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </Svg>
  ),
  tv: () => (
    <Svg>
      <defs>{lg('tvb', '#2c2c2e', '#000')}</defs>
      <rect width="60" height="60" fill={u('tvb')} />
      <path d={APPLE_LOGO} fill="#fff" transform="translate(11.5 21) scale(.098)" />
      <text x="30" y="38" fontSize="20" fontWeight="600" fill="#fff" fontFamily="-apple-system, 'SF Pro Display', Helvetica, Arial" letterSpacing="-.5">
        tv
      </text>
    </Svg>
  ),
  home: () => (
    <Svg>
      <defs>{lg('hm', '#ffb733', '#ff8a00')}</defs>
      <rect width="60" height="60" fill={u('hm')} />
      <path fill="#fff" d="M30 13.5 11.5 28.6c-.9.8-.3 2.2.9 2.2H15v14c0 .9.7 1.6 1.6 1.6h9.2V36.6h8.4v9.8h9.2c.9 0 1.6-.7 1.6-1.6v-14h2.6c1.2 0 1.8-1.4.9-2.2L42 21V15h-4.2v2.6z" />
    </Svg>
  ),
  itunes: () => (
    <Svg>
      <defs>{lg('it', '#f54ec4', '#a33cf0')}</defs>
      <rect width="60" height="60" fill={u('it')} />
      <path fill="#fff" d="m30 12.5 5 11.2 12.2 1.3-9.1 8.2 2.6 12-10.7-6.2-10.7 6.2 2.6-12-9.1-8.2 12.2-1.3z" />
    </Svg>
  ),
  findmy: () => (
    <Svg>
      <defs>
        {lg('fm', '#67e17a', '#29b444')}
      </defs>
      <rect width="60" height="60" fill={u('fm')} />
      <circle cx="30" cy="30" r="20" fill="none" stroke="#fff" strokeWidth="2.6" opacity=".95" />
      <circle cx="30" cy="30" r="12.5" fill="none" stroke="#fff" strokeWidth="2.6" opacity=".95" />
      <circle cx="30" cy="30" r="6.2" fill="#fff" />
      <circle cx="30" cy="30" r="4" fill="#2fbd4a" />
    </Svg>
  ),
  contacts: () => (
    <Svg>
      <defs>{lg('ct', '#f2f2f4', '#c9c9ce')}</defs>
      <rect width="60" height="60" fill={u('ct')} />
      <rect x="51" y="8" width="5" height="10" fill="#ff3b30" />
      <rect x="51" y="19" width="5" height="10" fill="#ff9500" />
      <rect x="51" y="30" width="5" height="10" fill="#34c759" />
      <rect x="51" y="41" width="5" height="10" fill="#007aff" />
      <circle cx="27" cy="24" r="8.6" fill="#8e8e93" />
      <path fill="#8e8e93" d="M11.5 47c.8-8.4 7.3-13.2 15.5-13.2S41.7 38.6 42.5 47z" />
    </Svg>
  ),
  calculator: () => (
    <Svg>
      <defs>{lg('ca', '#4a4a4c', '#1c1c1e')}</defs>
      <rect width="60" height="60" fill={u('ca')} />
      <rect x="9" y="9" width="19" height="19" rx="4" fill="#a5a5a5" />
      <rect x="32" y="9" width="19" height="19" rx="4" fill="#ff9f0a" />
      <rect x="9" y="32" width="19" height="19" rx="4" fill="#5d5d5f" />
      <rect x="32" y="32" width="19" height="19" rx="4" fill="#ff9f0a" />
      <path d="M13.5 18.5h10" stroke="#1c1c1e" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M41.5 13.5v10M36.5 18.5h10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M15 38l7 7M22 38l-7 7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M36.5 39.5h10M36.5 44.5h10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </Svg>
  ),
  voicememos: () => (
    <Svg bg="#000">
      <defs>{lg('vm', '#ff453a', '#fff', 1, 0)}</defs>
      {[3, 6, 10, 17, 24, 30, 22, 14, 26, 34, 28, 18, 11, 20, 15, 8, 5, 3].map((h, i) => (
        <rect key={i} x={6.2 + i * 2.75} y={30 - h / 2} width="1.5" height={h} rx=".75" fill={i < 9 ? '#ff453a' : '#fff'} />
      ))}
    </Svg>
  ),
  settings: () => (
    <Svg>
      <defs>
        {lg('st', '#d8d8dc', '#8e8e93')}
        {lg('stg', '#636366', '#3a3a3c')}
      </defs>
      <rect width="60" height="60" fill={u('st')} />
      <g transform="translate(30 30)">
        {Array.from({ length: 36 }, (_, i) => (
          <rect key={i} x="-1.4" y="-24" width="2.8" height="5" rx=".8" fill="#48484a" transform={`rotate(${i * 10})`} />
        ))}
        <circle r="20.5" fill={u('stg')} />
        <circle r="17.2" fill="#d1d1d6" />
        <circle r="15.6" fill="#8e8e93" />
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x="-2.1" y="-14.5" width="4.2" height="9" rx="1.4" fill="#4a4a4c" transform={`rotate(${i * 45})`} />
        ))}
        <circle r="7.6" fill="#4a4a4c" />
        <circle r="4.2" fill="#c7c7cc" />
      </g>
    </Svg>
  ),
  files: () => (
    <Svg bg="#fff">
      <defs>{lg('fl', '#4fb2ff', '#1f7bf2')}</defs>
      <path fill="#1d73e8" d="M10 18.5c0-1.4 1.1-2.5 2.5-2.5H24l3.5 4h20c1.4 0 2.5 1.1 2.5 2.5v19c0 1.4-1.1 2.5-2.5 2.5h-35A2.5 2.5 0 0 1 10 41.5z" />
      <path fill={u('fl')} d="M10 25c0-1.4 1.1-2.5 2.5-2.5h35c1.4 0 2.5 1.1 2.5 2.5v17c0 1.4-1.1 2.5-2.5 2.5h-35A2.5 2.5 0 0 1 10 42z" />
    </Svg>
  ),
  shortcuts: () => (
    <Svg>
      <defs>
        <linearGradient id={'sc' + SFX} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5f8c" />
          <stop offset=".5" stopColor="#8f4ff0" />
          <stop offset="1" stopColor="#2b6ff3" />
        </linearGradient>
      </defs>
      <rect width="60" height="60" fill={u('sc')} />
      <rect x="17" y="13" width="22" height="22" rx="6" fill="#fff" opacity=".55" transform="rotate(45 28 24)" />
      <rect x="21" y="23" width="22" height="22" rx="6" fill="#fff" opacity=".95" transform="rotate(45 32 34)" />
    </Svg>
  ),
  translate: () => (
    <Svg>
      <defs>{lg('tr', '#1a1a2e', '#04040a')}</defs>
      <rect width="60" height="60" fill={u('tr')} />
      <path fill="#0a84ff" d="M10 12h22a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3H19l-6 5v-5h-3a3 3 0 0 1-3-3V15a3 3 0 0 1 3-3Z" />
      <text x="21" y="28.5" textAnchor="middle" fontSize="15" fontWeight="600" fill="#fff" fontFamily="-apple-system, Helvetica, Arial">A</text>
      <path fill="#fff" d="M50 26H28a3 3 0 0 0-3 3v15a3 3 0 0 0 3 3h13l6 5v-5h3a3 3 0 0 0 3-3V29a3 3 0 0 0-3-3Z" />
      <text x="39" y="42.5" textAnchor="middle" fontSize="13" fontWeight="600" fill="#000" fontFamily="'Hiragino Sans', 'Noto Sans CJK SC', sans-serif">文</text>
    </Svg>
  ),
  tips: () => (
    <Svg>
      <defs>{lg('tp', '#ffd84a', '#ffb800')}</defs>
      <rect width="60" height="60" fill={u('tp')} />
      <path fill="#fff" d="M30 11.5a13 13 0 0 0-7.6 23.6c1.4 1 2.1 2.4 2.1 4.1v1.3h11v-1.3c0-1.7.7-3.1 2.1-4.1A13 13 0 0 0 30 11.5Z" />
      <rect x="24.5" y="42.5" width="11" height="2.6" rx="1.3" fill="#fff" />
      <rect x="26" y="46.6" width="8" height="2.6" rx="1.3" fill="#fff" />
    </Svg>
  ),
};

export const AppIconArt = memo(function AppIconArt({ id }: { id: string }) {
  const f = ICONS[id];
  SFX = '_' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return <>{f ? f() : <Svg bg="#8e8e93" />}</>;
});

export function AppIcon({ id, size = 60, className }: { id: string; size?: number; className?: string }) {
  return (
    <div className={`t7-appicon ${className ?? ''}`} style={{ width: size, height: size, borderRadius: size * 0.2237 }}>
      <AppIconArt id={id} />
    </div>
  );
}

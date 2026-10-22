/**
 * A front view of each iPod, drawn in its own colors, for the model shelf.
 * Drawn in the model's own px (its `size`), so at one scale the iPods keep
 * their real sizes next to each other.
 */
import { useId } from 'react';
import { CLASSIC_LAYOUT, type Appearance, type DeviceModel } from '../devices/types';

const ICONS = ['#34c759', '#0a84ff', '#ff9f0a', '#ff375f', '#5e5ce6', '#ffd60a', '#30b0c7', '#bf5af2', '#ff453a', '#64d2ff', '#a2845e', '#8e8e93'];
const THEMES: Record<string, string> = { classic: '#3d7fd6', graphite: '#6c7177', red: '#c4262e', green: '#3f9a49' };

export function ModelArt({ model, appearance, height }: { model: DeviceModel; appearance?: Appearance; height: number }) {
  const uid = useId().replace(/:/g, '');
  const { width: W, height: H } = model.size;
  const c = { ...model.finishes[0].colors, ...appearance?.colors };
  const o = { ...model.finishes[0].options, ...appearance?.options };
  const shine = `${uid}-shine`;
  const screen = `${uid}-screen`;

  const body = (r: number, fill: string) => (
    <>
      <rect width={W} height={H} rx={r} fill={fill} />
      <rect x={1.5} y={1.5} width={W - 3} height={H - 3} rx={r - 1.5} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={3} />
    </>
  );
  const gloss = (r: number) => <rect width={W} height={H} rx={r} fill={`url(#${shine})`} pointerEvents="none" />;

  let art: React.ReactNode;
  if (model.family === 'touch') {
    const sx = (W - 320) / 2;
    const sy = 111;
    art = (
      <>
        {body(54, c.back)}
        <rect x={4} y={4} width={W - 8} height={H - 8} rx={50} fill={c.front} />
        <rect x={sx} y={sy} width={320} height={568} fill={`url(#${screen})`} />
        {Array.from({ length: 20 }, (_, i) => (
          <rect key={i} x={sx + 18 + (i % 4) * 75} y={sy + 34 + Math.floor(i / 4) * 92} width={58} height={58} rx={13} fill={ICONS[i % ICONS.length]} />
        ))}
        <rect x={sx + 8} y={sy + 568 - 92} width={304} height={84} rx={22} fill="rgba(255,255,255,0.28)" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={sx + 18 + i * 75} y={sy + 568 - 79} width={58} height={58} rx={13} fill={ICONS[(i * 5 + 2) % ICONS.length]} />
        ))}
        <circle cx={W / 2} cy={735} r={29} fill="none" stroke="rgba(128,128,128,0.55)" strokeWidth={3} />
        <rect x={W / 2 - 26} y={52} width={52} height={7} rx={3.5} fill="rgba(110,110,110,0.5)" />
        <circle cx={W / 2 - 52} cy={56} r={6} fill="rgba(60,60,70,0.7)" />
        {gloss(54)}
      </>
    );
  } else if (model.family === 'nano-touch') {
    const sx = (W - 240) / 2;
    const sy = 60;
    art = (
      <>
        {body(38, c.body)}
        <rect x={7} y={7} width={W - 14} height={H - 14} rx={32} fill={c.front} />
        <rect x={sx} y={sy} width={240} height={432} fill={`url(#${screen})`} />
        <text x={W / 2} y={sy + 46} textAnchor="middle" fontSize={30} fontWeight={300} fill="#fff" fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif">
          9:41
        </text>
        {Array.from({ length: 6 }, (_, i) => (
          <circle key={i} cx={sx + 46 + (i % 3) * 74} cy={sy + 130 + Math.floor(i / 3) * 110} r={30} fill={ICONS[(i * 2 + 1) % ICONS.length]} />
        ))}
        <circle cx={sx + 108} cy={sy + 410} r={4} fill="#fff" />
        <circle cx={sx + 132} cy={sy + 410} r={4} fill="rgba(255,255,255,0.4)" />
        <circle cx={W / 2} cy={sy + 432 + 48} r={24} fill={c.home} stroke="rgba(0,0,0,0.18)" strokeWidth={2} />
        <rect x={W / 2 - 9} y={sy + 432 + 39} width={18} height={18} rx={5} fill="none" stroke="rgba(128,128,128,0.6)" strokeWidth={2} />
        {gloss(38)}
      </>
    );
  } else if (model.family === 'shuffle') {
    const cx = W / 2;
    const cy = H / 2 + 6;
    const ink = c.symbols;
    art = (
      <>
        {body(30, c.body)}
        <circle cx={cx} cy={cy} r={118} fill={c.pad} stroke="rgba(0,0,0,0.12)" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={44} fill={c.pad} stroke="rgba(0,0,0,0.14)" strokeWidth={2} />
        <path d={`M${cx - 14} ${cy - 84}h28M${cx} ${cy - 98}v28M${cx - 14} ${cy + 84}h28`} stroke={ink} strokeWidth={6} strokeLinecap="round" />
        <path
          d={`M${cx + 70} ${cy - 13}l16 13-16 13zM${cx + 86} ${cy - 13}l16 13-16 13z M${cx - 70} ${cy - 13}l-16 13 16 13zM${cx - 86} ${cy - 13}l-16 13 16 13z`}
          fill={ink}
        />
        <path d={`M${cx - 18} ${cy - 12}l16 12-16 12zM${cx + 4} ${cy - 12}h5v24h-5zM${cx + 13} ${cy - 12}h5v24h-5z`} fill={ink} />
        {gloss(30)}
      </>
    );
  } else {
    // a Click Wheel iPod: its own screen window and wheel (registry `clickWheel`)
    const L = model.clickWheel ?? CLASSIC_LAYOUT;
    const cx = W / 2;
    const wy = L.wheel.cy;
    const r = L.wheel.size / 2;
    const rc = L.wheel.center / 2;
    const mono = model.id === 'mini2';
    const theme = mono ? '#3b4650' : (THEMES[String(o.theme)] ?? THEMES.classic);
    const lw = L.lcd.w;
    const lh = L.lcd.h;
    const lx = (W - lw) / 2;
    const ly = L.window.top + (L.window.h - lh) / 2;
    const rowH = lh / 9;
    const portrait = lh > lw;
    const k = r / 118; // label size, relative to the classic's wheel
    art = (
      <>
        {body(L.radius, c.front)}
        <rect x={(W - L.window.w) / 2} y={L.window.top} width={L.window.w} height={L.window.h} rx={6} fill="#0c0d10" />
        <rect x={lx} y={ly} width={lw} height={lh} fill={mono ? '#b9c6c9' : '#f4f6f9'} />
        <rect x={lx} y={ly} width={lw} height={rowH} fill={mono ? '#a4b2b6' : '#e4e7ec'} />
        <rect x={lx} y={ly + rowH} width={portrait || mono ? lw : lw / 2} height={rowH * 1.2} fill={theme} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x={lx + lw * 0.04}
            y={ly + rowH * (2.6 + i * 1.05)}
            width={(portrait || mono ? lw * 0.5 : lw * 0.28) * (1 - (i % 3) * 0.2)}
            height={rowH * 0.32}
            rx={rowH * 0.16}
            fill={mono ? '#5d6a70' : '#b7bcc4'}
          />
        ))}
        {!portrait && !mono && <rect x={lx + lw / 2} y={ly + rowH} width={lw / 2} height={lh - rowH} fill={`url(#${screen})`} />}
        <circle cx={cx} cy={wy} r={r} fill={c.wheel} stroke="rgba(0,0,0,0.14)" strokeWidth={2} />
        <circle cx={cx} cy={wy} r={rc} fill={c.center} stroke="rgba(0,0,0,0.16)" strokeWidth={2} />
        <g transform={`translate(${cx} ${wy}) scale(${k}) translate(${-cx} ${-wy})`}>
          <text
            x={cx}
            y={wy - 86}
            textAnchor="middle"
            fontSize={22}
            fontWeight={700}
            letterSpacing={2}
            fill={c.labels}
            fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
          >
            MENU
          </text>
          <path
            d={`M${cx + 84} ${wy - 10}l12 10-12 10zM${cx + 96} ${wy - 10}l12 10-12 10zM${cx + 108} ${wy - 10}h4v20h-4z M${cx - 84} ${wy - 10}l-12 10 12 10zM${cx - 96} ${wy - 10}l-12 10 12 10zM${cx - 108} ${wy - 10}h-4v20h4z M${cx - 14} ${wy + 80}l14 10-14 10zM${cx + 4} ${wy + 80}h4v20h-4zM${cx + 12} ${wy + 80}h4v20h-4z`}
            fill={c.labels}
          />
        </g>
        {gloss(L.radius)}
      </>
    );
  }

  const screenStops =
    model.family === 'clickwheel'
      ? ['#f2a65a', '#d1495b', '#3d2c5a']
      : model.family === 'nano-touch'
        ? ['#3a6ff7', '#7b3fe4', '#18132e']
        : ['#2fb3ff', '#1e5bd8', '#0d1f63'];

  return (
    <svg className="model-art" width={(W / H) * height} height={height} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <linearGradient id={shine} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id={screen} x1="0" y1="0" x2="0.3" y2="1">
          {screenStops.map((s, i) => (
            <stop key={s} offset={i / (screenStops.length - 1)} stopColor={s} />
          ))}
        </linearGradient>
      </defs>
      {art}
    </svg>
  );
}

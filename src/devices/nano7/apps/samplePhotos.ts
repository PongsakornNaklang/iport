/**
 * A handful of drawn landscape "photos" so Photos has something to show on
 * a fresh iPod (the real one ships empty; ours shows these until you add
 * your own pictures in the Library panel). Plain SVG, generated once.
 */

export interface SamplePhoto {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const svg = (w: number, h: number, body: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;

function lg(id: string, stops: [number, string][], x2 = 0, y2 = 1): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
}

function ridge(w: number, base: number, amp: number, seed: number, steps = 9): string {
  const r = rng(seed);
  let d = `M0 ${base}`;
  for (let i = 0; i <= steps; i++) d += ` L${(w / steps) * i} ${base - r() * amp}`;
  return `${d} L${w} ${base + 400} L0 ${base + 400}Z`;
}

function sunset(): string {
  const W = 640;
  const H = 427;
  let waves = '';
  for (let i = 0; i < 14; i++) waves += `<rect x="${250 - i * 9 + (i % 3) * 7}" y="${262 + i * 11}" width="${140 + i * 18}" height="2.4" fill="#ffd68a" opacity="${0.75 - i * 0.045}"/>`;
  return svg(
    W,
    H,
    `<defs>${lg('s', [[0, '#2b1a4d'], [0.45, '#d6456a'], [0.8, '#ff9a4a'], [1, '#ffd27a']])}${lg('w', [[0, '#5a2c5e'], [1, '#160f2b']])}</defs>
<rect width="${W}" height="260" fill="url(#s)"/><circle cx="320" cy="240" r="46" fill="#ffe3a0"/><circle cx="320" cy="240" r="80" fill="#ffd27a" opacity="0.25"/>
<rect y="256" width="${W}" height="${H - 256}" fill="url(#w)"/>${waves}`,
  );
}

function mountains(): string {
  const W = 640;
  const H = 427;
  return svg(
    W,
    H,
    `<defs>${lg('s', [[0, '#5aa4e6'], [1, '#d9eefb']])}</defs><rect width="${W}" height="${H}" fill="url(#s)"/>
<path d="M60 300 L230 92 L300 170 L360 120 L560 300Z" fill="#7b8fa8"/><path d="M230 92 L262 132 L246 130 L232 150 L214 128 L198 132Z" fill="#fff"/><path d="M360 120 L392 156 L372 152 L356 166 L344 150Z" fill="#fff"/>
<path d="${ridge(W, 300, 70, 3)}" fill="#4f6b88"/><path d="${ridge(W, 350, 50, 7)}" fill="#2f4a5f"/><path d="${ridge(W, 390, 30, 11, 14)}" fill="#1c3040"/>`,
  );
}

function dunes(): string {
  const W = 640;
  const H = 427;
  return svg(
    W,
    H,
    `<defs>${lg('s', [[0, '#f6c27a'], [1, '#fde7c2']])}${lg('d1', [[0, '#e0904a'], [1, '#b4602e']], 1, 1)}${lg('d2', [[0, '#c46a34'], [1, '#8a3f1c']], 1, 1)}</defs>
<rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="480" cy="110" r="34" fill="#fff6dc"/>
<path d="M0 260 C140 190 260 200 380 250 S560 280 640 230 L640 427 L0 427Z" fill="url(#d1)"/>
<path d="M0 330 C120 280 230 290 330 330 S520 380 640 320 L640 427 L0 427Z" fill="url(#d2)"/>
<path d="M330 330 C430 300 520 330 640 320" fill="none" stroke="#f3b27a" stroke-width="2" opacity="0.6"/>`,
  );
}

function aurora(): string {
  const W = 427;
  const H = 640;
  const r = rng(42);
  let stars = '';
  for (let i = 0; i < 90; i++) stars += `<circle cx="${(r() * W).toFixed(1)}" cy="${(r() * 420).toFixed(1)}" r="${(r() * 1.2 + 0.3).toFixed(2)}" fill="#fff" opacity="${(r() * 0.7 + 0.3).toFixed(2)}"/>`;
  let trees = '';
  for (let x = -10; x < W + 20; x += 16 + r() * 10) {
    const h = 50 + r() * 70;
    trees += `<path d="M${x} ${H} L${x + 11} ${H - h - 70} L${x + 22} ${H}Z" fill="#05090f"/>`;
  }
  return svg(
    W,
    H,
    `<defs>${lg('s', [[0, '#030714'], [0.6, '#0b1f3a'], [1, '#123a4a']])}<filter id="b"><feGaussianBlur stdDeviation="14"/></filter></defs>
<rect width="${W}" height="${H}" fill="url(#s)"/>${stars}
<g filter="url(#b)" opacity="0.85"><path d="M-20 300 C80 180 180 260 260 150 S380 120 460 60 L460 120 C380 170 320 230 260 250 S100 300 -20 380Z" fill="#3df0a0"/><path d="M-20 360 C100 280 220 320 300 240 S420 220 460 180 L460 220 C400 260 320 300 260 320 S80 390 -20 420Z" fill="#20b3c8" opacity="0.7"/></g>
${trees}`,
  );
}

function city(): string {
  const W = 640;
  const H = 427;
  const r = rng(9);
  let b = '';
  for (let x = 0; x < W; ) {
    const w = 34 + r() * 50;
    const h = 120 + r() * 210;
    const y = H - h;
    b += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${r() > 0.5 ? '#141a33' : '#1b2246'}"/>`;
    for (let wy = y + 10; wy < H - 10; wy += 13)
      for (let wx = x + 6; wx < x + w - 8; wx += 10) if (r() > 0.55) b += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="5" height="7" fill="${r() > 0.3 ? '#ffd57a' : '#9fd3ff'}" opacity="${(0.55 + r() * 0.45).toFixed(2)}"/>`;
    x += w + 3;
  }
  return svg(W, H, `<defs>${lg('s', [[0, '#0a0d24'], [0.7, '#2d2160'], [1, '#7a3a7c']])}</defs><rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="510" cy="80" r="22" fill="#f4f1e6"/>${b}`);
}

function beach(): string {
  const W = 640;
  const H = 427;
  return svg(
    W,
    H,
    `<defs>${lg('s', [[0, '#3fa8f0'], [1, '#bfe6ff']])}${lg('sea', [[0, '#1b9fc2'], [1, '#5fe0d6']])}${lg('sand', [[0, '#f7e2b5'], [1, '#e9c88a']])}</defs>
<rect width="${W}" height="${H}" fill="url(#s)"/><ellipse cx="150" cy="70" rx="70" ry="16" fill="#fff" opacity="0.8"/><ellipse cx="420" cy="110" rx="90" ry="14" fill="#fff" opacity="0.6"/>
<rect y="210" width="${W}" height="110" fill="url(#sea)"/><path d="M0 300 C160 284 330 316 640 290 L640 427 L0 427Z" fill="url(#sand)"/>
<path d="M0 300 C160 284 330 316 640 290" fill="none" stroke="#fff" stroke-width="4" opacity="0.8"/>
<path d="M520 427 C512 340 500 270 470 210" fill="none" stroke="#5a3b22" stroke-width="9"/>
<g fill="#1f6b3a"><path d="M470 210 C430 190 400 200 380 225 C410 205 440 205 470 212Z"/><path d="M470 210 C500 180 540 180 570 200 C540 192 505 196 472 214Z"/><path d="M470 210 C450 170 420 160 395 165 C425 172 450 185 468 214Z"/><path d="M470 210 C490 165 520 150 548 152 C518 162 495 182 474 214Z"/><path d="M470 210 C470 240 455 262 440 272 C455 250 462 232 466 212Z"/></g>`,
  );
}

function lavender(): string {
  const W = 640;
  const H = 427;
  let rows = '';
  for (let i = -8; i <= 8; i++) rows += `<path d="M320 200 L${320 + i * 90} ${H} L${320 + i * 90 + 45} ${H}Z" fill="${i % 2 ? '#7a4cc0' : '#9a6ad8'}"/>`;
  return svg(
    W,
    H,
    `<defs>${lg('s', [[0, '#f7b77a'], [0.6, '#f9d9b0'], [1, '#e7d4ef']])}</defs><rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="320" cy="186" r="30" fill="#fff3d9"/>
<rect y="196" width="${W}" height="10" fill="#4a7a52"/>${rows}<circle cx="560" cy="190" r="16" fill="#3f6b46"/><rect x="557" y="196" width="6" height="12" fill="#3f2a1d"/>`,
  );
}

function lake(): string {
  const W = 640;
  const H = 427;
  const ridgeTop = ridge(W, 210, 90, 21, 12);
  return svg(
    W,
    H,
    `<defs>${lg('s', [[0, '#8fd0ff'], [1, '#e8f6ff']])}${lg('l', [[0, '#5b8fb0'], [1, '#2b5672']])}</defs>
<rect width="${W}" height="${H}" fill="url(#s)"/><path d="${ridgeTop}" fill="#2f6b4f"/><path d="${ridge(W, 220, 40, 5, 20)}" fill="#1f4d39"/>
<rect y="222" width="${W}" height="${H - 222}" fill="url(#l)"/><g transform="translate(0 444) scale(1 -1)" opacity="0.35"><path d="${ridge(W, 220, 40, 5, 20)}" fill="#163a2a"/></g>
<rect y="222" width="${W}" height="2" fill="#dff3ff" opacity="0.6"/><rect x="120" y="290" width="200" height="1.5" fill="#fff" opacity="0.35"/><rect x="380" y="330" width="160" height="1.5" fill="#fff" opacity="0.3"/>`,
  );
}

function bloom(): string {
  const W = 427;
  const H = 640;
  let petals = '';
  for (let i = 0; i < 14; i++) petals += `<ellipse cx="213" cy="210" rx="34" ry="120" fill="${i % 2 ? '#ff6f91' : '#ff8fa8'}" opacity="0.9" transform="rotate(${(i * 360) / 14} 213 330)"/>`;
  return svg(
    W,
    H,
    `<defs><radialGradient id="bg" cx="0.5" cy="0.5" r="0.7"><stop offset="0" stop-color="#4f7d3a"/><stop offset="1" stop-color="#0f2410"/></radialGradient><radialGradient id="c" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#e09a12"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>${petals}<circle cx="213" cy="330" r="46" fill="url(#c)"/>`,
  );
}

function canyon(): string {
  const W = 427;
  const H = 640;
  return svg(
    W,
    H,
    `<defs>${lg('s', [[0, '#6ab8f2'], [1, '#d6ecfa']])}</defs><rect width="${W}" height="${H}" fill="url(#s)"/>
<path d="M0 140 L90 150 L120 260 L60 640 L0 640Z" fill="#c4612e"/><path d="M427 120 L330 140 L300 280 L360 640 L427 640Z" fill="#b5532a"/>
<path d="M90 150 L120 260 L150 640 L60 640Z" fill="#8e3d1c"/><path d="M330 140 L300 280 L270 640 L360 640Z" fill="#7a3216"/>
<path d="M120 260 L150 640 L270 640 L300 280 C260 300 160 300 120 260Z" fill="#e58a4a"/><path d="M175 640 C190 520 230 430 214 330 C240 430 236 540 260 640Z" fill="#4aa0b8" opacity="0.8"/>`,
  );
}

let cache: SamplePhoto[] | null = null;

export function samplePhotos(): SamplePhoto[] {
  if (cache) return cache;
  const list: [string, () => string, number, number][] = [
    ['Sunset', sunset, 640, 427],
    ['Mountains', mountains, 640, 427],
    ['Aurora', aurora, 427, 640],
    ['Dunes', dunes, 640, 427],
    ['City Lights', city, 640, 427],
    ['Beach', beach, 640, 427],
    ['Bloom', bloom, 427, 640],
    ['Lavender', lavender, 640, 427],
    ['Lake', lake, 640, 427],
    ['Canyon', canyon, 427, 640],
  ];
  cache = list.map(([name, f, width, height], i) => ({ id: `sample-${i}`, name, url: f(), width, height }));
  return cache;
}

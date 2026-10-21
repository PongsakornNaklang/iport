import type { CSSProperties, ReactNode } from 'react';

/**
 * SF Symbols-style glyphs drawn as SVG (24×24 grid). `currentColor` everywhere
 * so they inherit the text color.
 */
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const F = { fill: 'currentColor' } as const;

const G: Record<string, ReactNode> = {
  'chevron.left': <path {...S} strokeWidth={2.6} d="M15 4 7 12l8 8" />,
  'chevron.right': <path {...S} strokeWidth={2.2} d="m9 5 7 7-7 7" />,
  'chevron.down': <path {...S} strokeWidth={2.6} d="m5 9 7 6 7-6" />,
  'chevron.up': <path {...S} strokeWidth={2.6} d="m5 15 7-6 7 6" />,
  'play.fill': <path {...F} d="M7 4.2v15.6c0 .8.9 1.3 1.6.9l12.2-7.8c.6-.4.6-1.3 0-1.7L8.6 3.3C7.9 2.9 7 3.4 7 4.2Z" />,
  'pause.fill': (
    <g {...F}>
      <rect x="5.5" y="3.5" width="4.6" height="17" rx="1.2" />
      <rect x="13.9" y="3.5" width="4.6" height="17" rx="1.2" />
    </g>
  ),
  'stop.fill': <rect {...F} x="5" y="5" width="14" height="14" rx="2.5" />,
  'forward.fill': (
    <g {...F}>
      <path d="M1.5 6.3v11.4c0 .7.8 1.1 1.4.7l8.3-5.7c.5-.4.5-1.1 0-1.5L2.9 5.6c-.6-.4-1.4 0-1.4.7Z" />
      <path d="M12 6.3v11.4c0 .7.8 1.1 1.4.7l8.3-5.7c.5-.4.5-1.1 0-1.5l-8.3-5.6c-.6-.4-1.4 0-1.4.7Z" />
    </g>
  ),
  'backward.fill': (
    <g {...F} transform="matrix(-1 0 0 1 24 0)">
      <path d="M1.5 6.3v11.4c0 .7.8 1.1 1.4.7l8.3-5.7c.5-.4.5-1.1 0-1.5L2.9 5.6c-.6-.4-1.4 0-1.4.7Z" />
      <path d="M12 6.3v11.4c0 .7.8 1.1 1.4.7l8.3-5.7c.5-.4.5-1.1 0-1.5l-8.3-5.6c-.6-.4-1.4 0-1.4.7Z" />
    </g>
  ),
  shuffle: (
    <g {...S} strokeWidth={2}>
      <path d="M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 4.8c1 1.6 2.3 2.6 4.3 2.6H20" />
      <path d="M3 17h3.5c1.7 0 2.8-.7 3.7-1.9M13.8 8.9c.9-1.2 2-1.9 3.7-1.9H20" />
      <path d="m17.5 4.5 2.8 2.5-2.8 2.5M17.5 14.5l2.8 2.5-2.8 2.5" />
    </g>
  ),
  repeat: (
    <g {...S} strokeWidth={2}>
      <path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H20M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H4" />
      <path d="m17 3 3 3-3 3M7 21l-3-3 3-3" />
    </g>
  ),
  'repeat.1': (
    <g>
      <g {...S} strokeWidth={2}>
        <path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H20M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H4" />
        <path d="m17 3 3 3-3 3M7 21l-3-3 3-3" />
      </g>
      <path {...F} d="M11.2 9.6h1.6v5.2h-1.4v-3.6l-1 .6V10.4z" />
    </g>
  ),
  'list.bullet': (
    <g>
      <g {...F}>
        <circle cx="4.5" cy="6" r="1.5" />
        <circle cx="4.5" cy="12" r="1.5" />
        <circle cx="4.5" cy="18" r="1.5" />
      </g>
      <path {...S} d="M9 6h12M9 12h12M9 18h12" />
    </g>
  ),
  'quote.bubble': (
    <g>
      <path {...S} d="M4.5 4h15A2.5 2.5 0 0 1 22 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-5 4v-4H4.5A2.5 2.5 0 0 1 2 14.5v-8A2.5 2.5 0 0 1 4.5 4Z" />
      <path {...F} d="M7.5 8.5h3v2.4c0 1.4-.7 2.4-2 2.9l-.4-.8c.7-.3 1-.8 1-1.5H7.5zM13.5 8.5h3v2.4c0 1.4-.7 2.4-2 2.9l-.4-.8c.7-.3 1-.8 1-1.5h-1.6z" />
    </g>
  ),
  'quote.bubble.fill': (
    <g>
      <path {...F} d="M4.5 4h15A2.5 2.5 0 0 1 22 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-5 4v-4H4.5A2.5 2.5 0 0 1 2 14.5v-8A2.5 2.5 0 0 1 4.5 4Z" />
    </g>
  ),
  airplayaudio: (
    <g>
      <path {...S} d="M7.5 17.5a8 8 0 1 1 9 0M9.6 14.6a4.5 4.5 0 1 1 4.8 0" />
      <path {...F} d="M12 14.5 17 21H7z" />
    </g>
  ),
  'speaker.fill': <path {...F} d="M3 9.2v5.6c0 .6.4 1 1 1h3l4.6 4c.6.5 1.4.1 1.4-.7V4.9c0-.8-.8-1.2-1.4-.7L7 8.2H4c-.6 0-1 .4-1 1Z" />,
  'speaker.wave.3.fill': (
    <g>
      <path {...F} d="M1.5 9.2v5.6c0 .6.4 1 1 1h3l4.6 4c.6.5 1.4.1 1.4-.7V4.9c0-.8-.8-1.2-1.4-.7L5.5 8.2h-3c-.6 0-1 .4-1 1Z" />
      <path {...S} strokeWidth={1.8} d="M14.5 9a4 4 0 0 1 0 6M17.2 6.5a7.5 7.5 0 0 1 0 11M19.9 4a11 11 0 0 1 0 16" />
    </g>
  ),
  'speaker.slash.fill': (
    <g>
      <path {...F} d="M3 9.2v5.6c0 .6.4 1 1 1h3l4.6 4c.6.5 1.4.1 1.4-.7V4.9c0-.8-.8-1.2-1.4-.7L7 8.2H4c-.6 0-1 .4-1 1Z" />
      <path {...S} d="m16 9 6 6M22 9l-6 6" />
    </g>
  ),
  ellipsis: (
    <g {...F}>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </g>
  ),
  plus: <path {...S} strokeWidth={2.4} d="M12 4v16M4 12h16" />,
  minus: <path {...S} strokeWidth={2.4} d="M4 12h16" />,
  magnifyingglass: <path {...S} strokeWidth={2.4} d="M10.5 3.5a7 7 0 1 1 0 14 7 7 0 0 1 0-14ZM15.6 15.6 21 21" />,
  heart: <path {...S} d="M12 20.5s-8.5-5-8.5-11A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 8.5 3.1c0 6-8.5 11-8.5 11Z" />,
  'heart.fill': <path {...F} d="M12 20.5s-8.5-5-8.5-11A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 8.5 3.1c0 6-8.5 11-8.5 11Z" />,
  'hand.thumbsdown': <path {...S} d="M7 14V4M7 14l4 7c1.5 0 2.4-1 2-2.5l-1-3.5h6a2 2 0 0 0 2-2.4l-1.4-6.5A2 2 0 0 0 16.6 5H7M3 4h4v10H3z" />,
  'music.note': <path {...F} d="M18 3v12.2a3.3 3.3 0 1 1-2-3V7.4l-7 1.8v9a3.3 3.3 0 1 1-2-3V6.4c0-.5.3-.9.8-1L17 3c.5-.2 1 .2 1 .7Z" />,
  'music.note.list': (
    <g>
      <path {...F} d="M21 7v10a2.8 2.8 0 1 1-1.8-2.6V7.8l-4.6 1.1V7.4z" />
      <path {...S} d="M3 6h10M3 11h10M3 16h7" />
    </g>
  ),
  'music.mic': (
    <g>
      <circle {...S} cx="15.5" cy="8.5" r="5" />
      <path {...S} d="m11.8 11.8-8 8.5M8 13l3 3" />
    </g>
  ),
  'square.stack': (
    <g {...S}>
      <rect x="4" y="8" width="16" height="13" rx="2.5" />
      <path d="M6.5 5h11M9 2h6" />
    </g>
  ),
  'music.mic.person': <circle cx="12" cy="12" r="1" />,
  person: (
    <g {...S}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" />
    </g>
  ),
  'person.crop.circle': (
    <g {...S}>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="10" r="3.2" />
      <path d="M6 18.5c1.5-2.2 3.6-3.2 6-3.2s4.5 1 6 3.2" />
    </g>
  ),
  'person.2': (
    <g {...S}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.4 3.2-5.2 6.5-5.2s5.9 1.8 6.5 5.2" />
      <circle cx="17" cy="9" r="2.8" />
      <path d="M17 14.6c2.4 0 4.2 1.4 4.6 4" />
    </g>
  ),
  guitars: (
    <g {...S}>
      <path d="M15 3l6 6M18 6l-7.5 7.5" />
      <path d="M9 12.5c-2-.5-4 .5-5 2.5s0 4.5 2 5.5 4.5.5 5.5-1.5.5-3.5-.5-4" />
    </g>
  ),
  'music.quarternote.3': (
    <g {...S}>
      <path d="M8 18V5l11-2v13" />
      <circle cx="5.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </g>
  ),
  'person.2.square.stack': (
    <g {...S}>
      <rect x="4" y="8" width="16" height="13" rx="2.5" />
      <path d="M6.5 5h11" />
      <circle cx="12" cy="13" r="2" />
      <path d="M8.5 19c.5-1.6 1.8-2.4 3.5-2.4s3 .8 3.5 2.4" />
    </g>
  ),
  'arrow.down.circle': (
    <g {...S}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7v10M8 13l4 4 4-4" />
    </g>
  ),
  tv: (
    <g {...S}>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8 21h8" />
    </g>
  ),
  'play.rectangle': (
    <g>
      <rect {...S} x="2.5" y="4.5" width="19" height="15" rx="3" />
      <path {...F} d="M10 9v6l5-3z" />
    </g>
  ),
  'play.circle.fill': (
    <g>
      <circle {...F} cx="12" cy="12" r="10.5" />
      <path fill="#fff" d="M10 7.8v8.4l6.6-4.2z" />
    </g>
  ),
  'square.grid.2x2.fill': (
    <g {...F}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </g>
  ),
  dot_radiowaves: (
    <g>
      <circle {...F} cx="12" cy="12" r="2.2" />
      <path {...S} d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4" />
    </g>
  ),
  'rectangle.stack.fill': (
    <g {...F}>
      <rect x="3" y="8" width="18" height="13" rx="2.5" />
      <rect x="5.5" y="4.5" width="13" height="2" rx="1" />
      <rect x="8" y="1.5" width="8" height="1.8" rx=".9" />
    </g>
  ),
  airplane: <path {...F} d="M21.5 15.5v-1.8L13.5 9V3.8c0-1-.7-1.8-1.5-1.8s-1.5.8-1.5 1.8V9l-8 4.7v1.8l8-2.5v5.2L8 20v1.5l4-1 4 1V20l-2.5-1.8V13z" />,
  wifi: (
    <g>
      <path {...F} d="M12 20.5 9.2 17.4a4.1 4.1 0 0 1 5.6 0z" />
      <path {...S} strokeWidth={2.4} d="M6.4 13.8a8 8 0 0 1 11.2 0M3 10.3a12.6 12.6 0 0 1 18 0" />
    </g>
  ),
  bluetooth: <path {...S} strokeWidth={2.2} d="m6.5 7.5 11 9L12 21V3l5.5 4.5-11 9" />,
  antenna: (
    <g>
      <circle {...F} cx="12" cy="9" r="2" />
      <path {...S} d="M12 11v10M8 5.5a5 5 0 0 0 0 7M16 5.5a5 5 0 0 1 0 7" />
    </g>
  ),
  airdrop: (
    <g {...S}>
      <circle cx="12" cy="12" r="2" />
      <path d="M8.3 15.7a5.2 5.2 0 1 1 7.4 0M5.3 18.7a9.4 9.4 0 1 1 13.4 0" />
    </g>
  ),
  'moon.fill': <path {...F} d="M14.5 2.5a9.5 9.5 0 1 0 7 15.4A8 8 0 0 1 14.5 2.5Z" />,
  'lock.rotation': (
    <g>
      <path {...S} d="M20.3 13.5A8.5 8.5 0 1 1 18 6.2M18.5 2.5v4h-4" />
      <rect {...F} x="8.5" y="11" width="7" height="5.5" rx="1" />
      <path {...S} strokeWidth={1.6} d="M10 11V9.5a2 2 0 0 1 4 0V11" />
    </g>
  ),
  'sun.max.fill': (
    <g>
      <circle {...F} cx="12" cy="12" r="4.6" />
      <path {...S} d="M12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4M4.8 4.8l1.7 1.7M17.5 17.5l1.7 1.7M4.8 19.2l1.7-1.7M17.5 6.5l1.7-1.7" />
    </g>
  ),
  timer: (
    <g {...S}>
      <circle cx="12" cy="13" r="8.5" />
      <path d="M12 13V8M12 2v2M9.5 2h5" />
    </g>
  ),
  calculator: (
    <g>
      <rect {...S} x="4" y="2" width="16" height="20" rx="3" />
      <g {...F}>
        <rect x="7" y="5" width="10" height="4" rx="1" />
        <circle cx="8.5" cy="13" r="1.3" />
        <circle cx="12" cy="13" r="1.3" />
        <circle cx="15.5" cy="13" r="1.3" />
        <circle cx="8.5" cy="17.5" r="1.3" />
        <circle cx="12" cy="17.5" r="1.3" />
        <circle cx="15.5" cy="17.5" r="1.3" />
      </g>
    </g>
  ),
  'camera.fill': <path {...F} d="M4 7h3l1.6-2.2c.3-.5.8-.8 1.4-.8h4c.6 0 1.1.3 1.4.8L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm8 11a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0-1.8a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Z" />,
  'camera.rotate': (
    <g>
      <path {...S} d="M4 7h3l1.6-2.2c.3-.5.8-.8 1.4-.8h4c.6 0 1.1.3 1.4.8L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
      <path {...S} strokeWidth={1.6} d="M8.5 13a3.5 3.5 0 0 1 6.2-2.2M15.5 13.4a3.5 3.5 0 0 1-6.2 2.1M14.8 9v2h-2M9.2 17.3v-2h2" />
    </g>
  ),
  'circle.lefthalf.filled': (
    <g>
      <circle {...S} cx="12" cy="12" r="9" />
      <path {...F} d="M12 3a9 9 0 0 0 0 18z" />
    </g>
  ),
  'lock.fill': (
    <g>
      <rect {...F} x="5" y="10.5" width="14" height="11" rx="2.2" />
      <path {...S} strokeWidth={2.2} d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </g>
  ),
  'lock.open.fill': (
    <g>
      <rect {...F} x="3" y="10.5" width="14" height="11" rx="2.2" />
      <path {...S} strokeWidth={2.2} d="M14 10.5V7a4 4 0 0 1 8 0v1" />
    </g>
  ),
  checkmark: <path {...S} strokeWidth={2.6} d="m4.5 12.5 5 5 10-11" />,
  'checkmark.circle.fill': (
    <g>
      <circle {...F} cx="12" cy="12" r="10" />
      <path fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="m7.5 12.3 3 3 6-6.6" />
    </g>
  ),
  'plus.circle.fill': (
    <g>
      <circle {...F} cx="12" cy="12" r="10" />
      <path fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" d="M12 7.5v9M7.5 12h9" />
    </g>
  ),
  'minus.circle.fill': (
    <g>
      <circle {...F} cx="12" cy="12" r="10" />
      <path fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" d="M7.5 12h9" />
    </g>
  ),
  xmark: <path {...S} strokeWidth={2.4} d="m5.5 5.5 13 13M18.5 5.5l-13 13" />,
  'xmark.circle.fill': (
    <g>
      <circle {...F} cx="12" cy="12" r="10" />
      <path fill="none" stroke="var(--t7-xfill, #fff)" strokeWidth="2" strokeLinecap="round" d="m8.5 8.5 7 7M15.5 8.5l-7 7" />
    </g>
  ),
  trash: (
    <g {...S}>
      <path d="M3.5 6h17M9 6V3.5h6V6M5.5 6l1 14.5c.1 1 .9 1.5 1.8 1.5h7.4c.9 0 1.7-.5 1.8-1.5l1-14.5M10 10v8M14 10v8" />
    </g>
  ),
  'square.and.arrow.up': (
    <g {...S}>
      <path d="M8 9H6.5A1.5 1.5 0 0 0 5 10.5v9A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 17.5 9H16M12 15V2.5M8.5 6 12 2.5 15.5 6" />
    </g>
  ),
  'text.badge.plus': (
    <g {...S}>
      <path d="M3 6h10M3 11h10M3 16h7M18 13v8M14 17h8" />
    </g>
  ),
  'text.insert': (
    <g {...S}>
      <path d="M9 6h12M9 11h12M3 16h18M3 21h18M3 3.5 6.5 6 3 8.5z" />
    </g>
  ),
  'text.append': (
    <g {...S}>
      <path d="M3 4h18M3 9h18M3 14h12M3 19h12M17 16.5l3.5 2.5-3.5 2.5z" />
    </g>
  ),
  'mic.fill': (
    <g>
      <rect {...F} x="8.5" y="2" width="7" height="12.5" rx="3.5" />
      <path {...S} d="M5 11a7 7 0 0 0 14 0M12 18v4M8.5 22h7" />
    </g>
  ),
  'gobackward.15': (
    <g>
      <path {...S} d="M12 4a8.5 8.5 0 1 1-8.5 8.5M12 4V1.5L8.5 4 12 6.5z" />
      <text x="12" y="16" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" fontFamily="-apple-system, Helvetica, Arial">15</text>
    </g>
  ),
  'goforward.15': (
    <g>
      <path {...S} d="M12 4a8.5 8.5 0 1 0 8.5 8.5M12 4V1.5L15.5 4 12 6.5z" />
      <text x="12" y="16" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" fontFamily="-apple-system, Helvetica, Arial">15</text>
    </g>
  ),
  'arrow.up.left.and.arrow.down.right': <path {...S} d="M4 10V4h6M4 4l6.5 6.5M20 14v6h-6M20 20l-6.5-6.5" />,
  'rotate.right': (
    <g {...S}>
      <rect x="4" y="9" width="11" height="11" rx="2" />
      <path d="M10 4h4a6 6 0 0 1 6 6v2M17.5 9.5 20 12l2.5-2.5" />
    </g>
  ),
  gearshape: (
    <g {...S}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
      <circle cx="12" cy="12" r="7" />
    </g>
  ),
  photo: (
    <g>
      <rect {...S} x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path {...F} d="m4 18 5-6 3.5 4 2.5-3 5 5z" />
      <circle {...F} cx="16.5" cy="9" r="1.8" />
    </g>
  ),
  'photo.on.rectangle': (
    <g>
      <rect {...S} x="5.5" y="6.5" width="16" height="13" rx="2.5" />
      <path {...S} d="M3 16V5.5A2.5 2.5 0 0 1 5.5 3H18" />
      <path {...F} d="m7 18 4.5-5 3 3.4 2-2.4 3.5 4z" />
    </g>
  ),
  'heart.text.square': (
    <g>
      <rect {...S} x="3" y="3" width="18" height="18" rx="4" />
      <path {...F} d="M12 17s-5-3-5-6.5A2.8 2.8 0 0 1 12 9a2.8 2.8 0 0 1 5 1.5C17 14 12 17 12 17Z" />
    </g>
  ),
  'person.crop.square': (
    <g {...S}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 19c1-2.5 3-3.5 5.5-3.5s4.5 1 5.5 3.5" />
    </g>
  ),
  house: <path {...S} d="M3.5 11 12 3.5l8.5 7.5M5.5 9.5V20h5v-5.5h3V20h5V9.5" />,
  'house.fill': <path {...F} d="M12 2.8 2.6 11.1l1.3 1.5 1.1-1V20.5c0 .6.4 1 1 1h4.5V15h3v6.5H18c.6 0 1-.4 1-1v-8.9l1.1 1 1.3-1.5Z" />,
  folder: <path {...S} d="M3 7V5.5A1.5 1.5 0 0 1 4.5 4h5l2 2.5h8A1.5 1.5 0 0 1 21 8v10.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />,
  'folder.fill': <path {...F} d="M3 7V5.5A1.5 1.5 0 0 1 4.5 4h5l2 2.5h8A1.5 1.5 0 0 1 21 8v10.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />,
  globe: (
    <g {...S}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M2.5 12h19M12 2.5c3 3 3 16 0 19M12 2.5c-3 3-3 16 0 19" />
    </g>
  ),
  envelope: (
    <g {...S}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="m3 6 9 7 9-7" />
    </g>
  ),
  tray: <path {...S} d="M3 13.5 5.5 4.5h13l2.5 9V19a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19zM3 13.5h5.5a3.5 3.5 0 0 0 7 0H21" />,
  'paperplane': <path {...S} d="M21 3 10 14M21 3l-6.5 18-4.5-7-7-4.5z" />,
  'doc': <path {...S} d="M6 2.5h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1ZM14 2.5V7.5h5" />,
  'archivebox': (
    <g {...S}>
      <rect x="2.5" y="4" width="19" height="4.5" rx="1" />
      <path d="M4 8.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19V8.5M9.5 12.5h5" />
    </g>
  ),
  message: <path {...S} d="M12 3.5c5.2 0 9.5 3.5 9.5 7.8s-4.3 7.8-9.5 7.8c-1.2 0-2.3-.2-3.3-.5L4 20.5l1.3-3.8C3.5 15.3 2.5 13.4 2.5 11.3c0-4.3 4.3-7.8 9.5-7.8Z" />,
  'square.and.pencil': (
    <g {...S}>
      <path d="M19 13v6.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 19.5v-13A1.5 1.5 0 0 1 4.5 5H11" />
      <path d="M17.5 2.8a2 2 0 0 1 2.8 2.8L12 14l-3.7.9.9-3.7z" />
    </g>
  ),
  video: (
    <g>
      <rect {...F} x="2" y="6" width="13.5" height="12" rx="3" />
      <path {...F} d="m17 10.5 5-3.2v9.4l-5-3.2z" />
    </g>
  ),
  link: <path {...S} d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4l-1.4 1.4M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.4-1.4" />,
  clock: (
    <g {...S}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 6v6l4 2.5" />
    </g>
  ),
  'clock.fill': (
    <g>
      <circle {...F} cx="12" cy="12" r="10" />
      <path fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" d="M12 6.5V12l3.5 2.2" />
    </g>
  ),
  'alarm.fill': (
    <g>
      <circle {...F} cx="12" cy="13" r="8.5" />
      <path fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" d="M12 9v4.5l3 1.5" />
      <path {...S} d="M3 6.5 6.5 3M21 6.5 17.5 3" />
    </g>
  ),
  stopwatch: (
    <g>
      <circle {...F} cx="12" cy="13.5" r="8.5" />
      <path fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" d="M12 13.5V9" />
      <path {...S} d="M9.5 2h5M12 2v3" />
    </g>
  ),
  'timer.fill': (
    <g>
      <circle {...F} cx="12" cy="12" r="10" />
      <path fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" d="M12 12 8 8M12 3.5v2" />
    </g>
  ),
  'globe.fill': (
    <g>
      <circle {...F} cx="12" cy="12" r="10" />
      <path fill="none" stroke="#000" strokeWidth="1.5" d="M2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20" />
    </g>
  ),
  star: <path {...S} d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" />,
  'star.fill': <path {...F} d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" />,
  'info.circle': (
    <g>
      <circle {...S} cx="12" cy="12" r="9.5" />
      <path {...S} d="M12 11v6" />
      <circle {...F} cx="12" cy="7.5" r="1.3" />
    </g>
  ),
  'location.fill': <path {...F} d="M20.6 3.4 3.9 10.6c-.8.4-.7 1.6.2 1.8l7.2 1.3 1.3 7.2c.2.9 1.4 1 1.8.2L21.6 4.4c.3-.6-.4-1.3-1-1Z" />,
  location: <path {...S} d="M20.6 3.4 3.9 10.6c-.8.4-.7 1.6.2 1.8l7.2 1.3 1.3 7.2c.2.9 1.4 1 1.8.2L21.6 4.4c.3-.6-.4-1.3-1-1Z" />,
  'cloud.fill': <path {...F} d="M6.5 19h11a4.5 4.5 0 0 0 .6-9 6 6 0 0 0-11.5-1.3A5.2 5.2 0 0 0 6.5 19Z" />,
  'cloud.rain.fill': (
    <g>
      <path {...F} d="M6.5 15h11a4 4 0 0 0 .6-8 5.6 5.6 0 0 0-10.8-1.2A4.6 4.6 0 0 0 6.5 15Z" />
      <path {...S} d="m8 17.5-1 3M12 17.5l-1 3M16 17.5l-1 3" />
    </g>
  ),
  'cloud.bolt.fill': (
    <g>
      <path {...F} d="M6.5 15h11a4 4 0 0 0 .6-8 5.6 5.6 0 0 0-10.8-1.2A4.6 4.6 0 0 0 6.5 15Z" />
      <path {...F} d="m12.5 15.5-3 4h2.5l-1 3.5 4-5h-2.5l1-2.5z" />
    </g>
  ),
  'cloud.snow.fill': (
    <g>
      <path {...F} d="M6.5 15h11a4 4 0 0 0 .6-8 5.6 5.6 0 0 0-10.8-1.2A4.6 4.6 0 0 0 6.5 15Z" />
      <g {...F}>
        <circle cx="8" cy="19" r="1.2" />
        <circle cx="12" cy="20.5" r="1.2" />
        <circle cx="16" cy="19" r="1.2" />
      </g>
    </g>
  ),
  'cloud.fog.fill': (
    <g>
      <path {...F} d="M6.5 14h11a4 4 0 0 0 .6-8 5.6 5.6 0 0 0-10.8-1.2A4.6 4.6 0 0 0 6.5 14Z" />
      <path {...S} d="M4 17.5h16M6 21h12" />
    </g>
  ),
  'cloud.sun.fill': (
    <g>
      <circle fill="#ffd60a" cx="8" cy="8" r="4" />
      <path {...F} d="M8.5 20h10a3.8 3.8 0 0 0 .5-7.6 5 5 0 0 0-9.6-1A4.3 4.3 0 0 0 8.5 20Z" />
    </g>
  ),
  'cloud.moon.fill': (
    <g>
      <path fill="#e5e5ea" d="M9 2.5a6 6 0 1 0 4.8 9.6A5 5 0 0 1 9 2.5Z" />
      <path {...F} d="M8.5 20h10a3.8 3.8 0 0 0 .5-7.6 5 5 0 0 0-9.6-1A4.3 4.3 0 0 0 8.5 20Z" />
    </g>
  ),
  'moon.stars.fill': (
    <g {...F}>
      <path d="M12.5 3.5a8.5 8.5 0 1 0 8 11.3 7 7 0 0 1-8-11.3Z" />
      <path d="m18 3 .6 1.4L20 5l-1.4.6L18 7l-.6-1.4L16 5l1.4-.6z" />
    </g>
  ),
  wind: <path {...S} d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" />,
  drop: <path {...S} d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />,
  thermometer: <path {...S} d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0Z" />,
  'eye': (
    <g {...S}>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </g>
  ),
  'sunrise': <path {...S} d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0M12 3v6M9 6l3-3 3 3M4 11l1.5 1.5M20 11l-1.5 1.5" />,
  'calendar': (
    <g {...S}>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </g>
  ),
  'list.bullet.rectangle': (
    <g {...S}>
      <rect x="2.5" y="3.5" width="19" height="17" rx="3" />
      <path d="M7 8.5h.5M10 8.5h7M7 12h.5M10 12h7M7 15.5h.5M10 15.5h7" />
    </g>
  ),
  'flag.fill': <path {...F} d="M5 21V4c3-1.5 5.5-1 8 .3s5 1.6 7 .4v9.5c-2 1.2-4.5 .9-7-.4S8 12.5 5 14" />,
  'tray.fill': <path {...F} d="M3 13.5 5.5 4.5h13l2.5 9V19a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19zm5.5 0a3.5 3.5 0 0 0 7 0h4L17.3 6.5H6.7L4.5 13.5z" />,
  'book': <path {...S} d="M12 6c-2-1.5-5-2-8.5-1.5v14C7 18 10 18.5 12 20c2-1.5 5-2 8.5-1.5v-14C17 4 14 4.5 12 6Zm0 0v14" />,
  'bookmark': <path {...S} d="M6 3h12v18l-6-4-6 4z" />,
  'arrow.clockwise': <path {...S} d="M20 12a8 8 0 1 1-2.3-5.6M20 3.5v4h-4" />,
  'arrow.uturn.left': <path {...S} d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  'aA': (
    <g fill="currentColor">
      <text x="2" y="18" fontSize="11" fontFamily="-apple-system, Helvetica, Arial">A</text>
      <text x="9" y="18" fontSize="16" fontFamily="-apple-system, Helvetica, Arial">A</text>
    </g>
  ),
  'book.fill': <path {...F} d="M11.2 5.3C9.3 4 6.5 3.5 3.5 4v14.5c3-.4 5.8 0 7.7 1.3zM12.8 5.3c1.9-1.3 4.7-1.8 7.7-1.3v14.5c-3-.4-5.8 0-7.7 1.3z" />,
  'sidebar.squares.left': <rect {...S} x="3" y="4" width="18" height="16" rx="3" />,
  'hand.raised': <path {...S} d="M8 12V5a1.5 1.5 0 0 1 3 0v6V3.5a1.5 1.5 0 0 1 3 0V11V5a1.5 1.5 0 0 1 3 0v9c0 4-2.5 7-6.5 7-2.5 0-4-1.5-5.5-3.5L3 13.5c-.8-1 0-2.5 1.3-2.3.7.1 1.3.7 1.7 1.3L8 15" />,
  'bell.fill': <path {...F} d="M12 2.5a6 6 0 0 0-6 6v4.5L4 16.5v1h16v-1L18 13V8.5a6 6 0 0 0-6-6ZM9.5 19a2.5 2.5 0 0 0 5 0z" />,
  'speaker.wave.2.fill': (
    <g>
      <path {...F} d="M3 9.2v5.6c0 .6.4 1 1 1h3l4.6 4c.6.5 1.4.1 1.4-.7V4.9c0-.8-.8-1.2-1.4-.7L7 8.2H4c-.6 0-1 .4-1 1Z" />
      <path {...S} d="M16 9a4 4 0 0 1 0 6M18.8 6.5a7.5 7.5 0 0 1 0 11" />
    </g>
  ),
  'hourglass': <path {...S} d="M6 2.5h12M6 21.5h12M7 2.5c0 5 5 6.5 5 9.5s-5 4.5-5 9.5M17 2.5c0 5-5 6.5-5 9.5s5 4.5 5 9.5" />,
  'battery.100': (
    <g>
      <rect {...S} strokeWidth={1.4} x="1.5" y="7" width="19" height="10" rx="2.5" />
      <rect {...F} x="3.2" y="8.7" width="15.6" height="6.6" rx="1.2" />
      <path {...F} d="M21.8 10.2c.7.2 1.2.9 1.2 1.8s-.5 1.6-1.2 1.8z" />
    </g>
  ),
  'figure.stand': (
    <g {...S}>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M12 8v7M8 22l4-7 4 7M6 10.5h12" />
    </g>
  ),
  'hand.raised.fill': <path {...F} d="M8 12V5a1.5 1.5 0 0 1 3 0v6V3.5a1.5 1.5 0 0 1 3 0V11V5a1.5 1.5 0 0 1 3 0v9c0 4-2.5 7-6.5 7-2.5 0-4-1.5-5.5-3.5L3 13.5c-.8-1 0-2.5 1.3-2.3.7.1 1.3.7 1.7 1.3L8 15Z" />,
  'textformat.size': (
    <g fill="currentColor">
      <text x="1" y="19" fontSize="12" fontWeight="600" fontFamily="-apple-system, Helvetica, Arial">A</text>
      <text x="10" y="19" fontSize="17" fontWeight="600" fontFamily="-apple-system, Helvetica, Arial">A</text>
    </g>
  ),
  'app.badge': <rect {...F} x="4" y="4" width="16" height="16" rx="4" />,
  'switch.2': <path {...S} d="M3 7h10M17 7h4M3 17h4M11 17h10M15 4.5v5M9 14.5v5" />,
  sparkles: <path {...F} d="M10 2.5 11.6 8 17 9.6 11.6 11.2 10 16.7 8.4 11.2 3 9.6 8.4 8zM18 13l.9 2.6 2.6.9-2.6.9L18 20l-.9-2.6-2.6-.9 2.6-.9z" />,
  'hifispeaker': (
    <g {...S}>
      <rect x="5" y="2.5" width="14" height="19" rx="3" />
      <circle cx="12" cy="14.5" r="3.5" />
      <circle cx="12" cy="7" r="1.2" />
    </g>
  ),
  'square.on.square': (
    <g {...S}>
      <rect x="8" y="8" width="13" height="13" rx="2.5" />
      <path d="M16 5.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h.5" />
    </g>
  ),
  'rectangle.on.rectangle': (
    <g {...S}>
      <rect x="2.5" y="7" width="15" height="12" rx="2.5" />
      <path d="M6.5 4.5H19a2.5 2.5 0 0 1 2.5 2.5v9" />
    </g>
  ),
  'arrow.left.arrow.right': <path {...S} d="M4 8h16M16 4l4 4-4 4M20 16H4M8 12l-4 4 4 4" />,
  'waveform': <path {...S} d="M3 12h1M6.5 8v8M10 4v16M13.5 7v10M17 10v4M20.5 11v2" />,
  'pencil': <path {...S} d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />,
  'bed.double.fill': (
    <g {...F}>
      <path d="M3 18.5V8.2c0-.7.5-1.2 1.2-1.2s1.2.5 1.2 1.2V13h15.2c.8 0 1.4.6 1.4 1.4v4.1c0 .6-.5 1-1 1s-1-.4-1-1V17H5.4v1.5c0 .6-.5 1-1.2 1S3 19.1 3 18.5Z" />
      <circle cx="8.3" cy="10.3" r="2" />
      <path d="M11.4 8.6c0-.6.5-1.1 1.1-1.1h5.3c2 0 3.6 1.6 3.6 3.6V12h-10z" />
    </g>
  ),
  'folder.badge.plus': (
    <g>
      <path {...S} d="M3 7.5V18a2 2 0 0 0 2 2h9M3 7.5V6a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V12" />
      <path {...S} d="M19 15v6M16 18h6" />
    </g>
  ),
  'ellipsis.circle': (
    <g>
      <circle {...S} cx="12" cy="12" r="9.5" strokeWidth={1.7} />
      <g {...F}>
        <circle cx="7.6" cy="12" r="1.35" />
        <circle cx="12" cy="12" r="1.35" />
        <circle cx="16.4" cy="12" r="1.35" />
      </g>
    </g>
  ),
  checklist: (
    <g>
      <path {...S} strokeWidth={1.9} d="m3 6 1.8 1.8L8 4.5M3 13l1.8 1.8L8 11.5M11 6.5h10M11 13.5h10M11 20h10" />
      <circle {...S} strokeWidth={1.7} cx="5" cy="20" r="1.6" />
    </g>
  ),
  'pencil.tip.crop.circle': (
    <g>
      <circle {...S} strokeWidth={1.7} cx="12" cy="12" r="9.5" />
      <path {...F} d="M12 5.5 15.2 14h-6.4z" />
      <path {...S} strokeWidth={1.6} d="M8.8 14 8 18.5h8l-.8-4.5" />
    </g>
  ),
  'person.fill': (
    <g {...F}>
      <circle cx="12" cy="7.5" r="4.5" />
      <path d="M3.5 20.5c0-4.2 3.8-7 8.5-7s8.5 2.8 8.5 7c0 .6-.4 1-1 1h-15c-.6 0-1-.4-1-1Z" />
    </g>
  ),
  'message.fill': <path {...F} d="M12 3C6.5 3 2 6.7 2 11.3c0 2.6 1.4 4.9 3.7 6.4-.1 1.5-.8 2.9-2 3.9 2.2 0 4.2-.8 5.6-2 .9.2 1.8.3 2.7.3 5.5 0 10-3.7 10-8.4S17.5 3 12 3Z" />,
  'phone.fill': <path {...F} d="M6.6 2.6c.6-.3 1.3-.2 1.7.4l2.3 3.3c.4.6.3 1.3-.1 1.8l-1.4 1.5a13 13 0 0 0 5.3 5.3l1.5-1.4c.5-.4 1.2-.5 1.8-.1l3.3 2.3c.6.4.7 1.1.4 1.7-1 1.9-2.6 3.4-4.8 3-7.2-1.3-12-6.1-13.3-13.3-.4-2.2 1.1-3.8 3.3-4.5Z" />,
  'video.fill': (
    <g {...F}>
      <rect x="1.5" y="5.5" width="14" height="13" rx="3" />
      <path d="m17 10 4.2-2.8c.6-.4 1.3 0 1.3.7v8.2c0 .7-.7 1.1-1.3.7L17 14z" />
    </g>
  ),
  'envelope.fill': (
    <g>
      <rect {...F} x="2" y="4.5" width="20" height="15" rx="3" />
      <path fill="none" stroke="var(--t7-cell, #fff)" strokeWidth={1.5} strokeLinejoin="round" d="m3 6.5 9 7 9-7" />
    </g>
  ),
  'slider.horizontal.3': (
    <g>
      <path {...S} strokeWidth={1.8} d="M3 6h18M3 12h18M3 18h18" />
      <g {...F}>
        <circle cx="15" cy="6" r="2.4" />
        <circle cx="8" cy="12" r="2.4" />
        <circle cx="17" cy="18" r="2.4" />
      </g>
    </g>
  ),
  'exclamationmark.triangle': (
    <g>
      <path {...S} strokeWidth={1.8} d="M10.3 3.8a2 2 0 0 1 3.4 0l8 13.8a2 2 0 0 1-1.7 3H4a2 2 0 0 1-1.7-3z" />
      <path {...S} d="M12 9v5" />
      <circle {...F} cx="12" cy="17.2" r="1.2" />
    </g>
  ),
  humidity: (
    <g>
      <path {...S} strokeWidth={1.8} d="M12 3s-6.5 7-6.5 11.2a6.5 6.5 0 0 0 13 0C18.5 10 12 3 12 3Z" />
      <path {...S} strokeWidth={1.6} d="M9 17c1.5-.8 4.5-.8 6 0" />
    </g>
  ),
  gauge: (
    <g>
      <path {...S} strokeWidth={1.8} d="M4.2 18.5a9.5 9.5 0 1 1 15.6 0" />
      <path {...S} d="m12 13.5 4-5" />
      <circle {...F} cx="12" cy="13.5" r="1.8" />
    </g>
  ),
  map: <path {...S} strokeWidth={1.8} d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5zM9 4v13.5M15 6.5V20" />,
  'bell.badge.fill': (
    <g {...F}>
      <path d="M12 3a6 6 0 0 0-6 6v4.2L4.3 16c-.4.7.1 1.5.9 1.5h13.6c.8 0 1.3-.8.9-1.5L18 13.2V9a6 6 0 0 0-6-6Z" />
      <path d="M9.5 19h5a2.5 2.5 0 0 1-5 0Z" />
    </g>
  ),
  siri: (
    <g>
      <circle cx="12" cy="12" r="9" fill="url(#t7siri)" />
      <defs>
        <radialGradient id="t7siri" cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#ff5ed2" />
          <stop offset="0.5" stopColor="#5d6bff" />
          <stop offset="1" stopColor="#14d3ff" />
        </radialGradient>
      </defs>
      <path fill="none" stroke="#fff" strokeWidth={1.3} strokeLinecap="round" d="M5.5 12c1.5-3 3-3 4.5 0s3 3 4.5 0 2.5-2.4 4 0" />
    </g>
  ),
  'key.fill': <path {...F} d="M14.5 2.5a7 7 0 0 0-6.6 9.3L2.5 17.2V21h3.8v-2h2v-2h2l1.4-1.4A7 7 0 1 0 14.5 2.5Zm1.8 3.3a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8Z" />,
  iphone: (
    <g>
      <rect {...S} strokeWidth={1.8} x="6" y="2" width="12" height="20" rx="2.5" />
      <circle {...F} cx="12" cy="18.5" r="1.1" />
    </g>
  ),
  'sun.min.fill': (
    <g>
      <circle {...F} cx="12" cy="12" r="4" />
      <g {...F}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <circle key={a} cx="12" cy="4.5" r="1" transform={`rotate(${a} 12 12)`} />
        ))}
      </g>
    </g>
  ),
  'delete.left': (
    <g>
      <path {...S} strokeWidth={1.8} d="M8.2 5H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8.2a2 2 0 0 1-1.5-.7L2 12l4.7-6.3A2 2 0 0 1 8.2 5Z" />
      <path {...S} strokeWidth={1.8} d="m11 9 6 6M17 9l-6 6" />
    </g>
  ),
  icloud: <path {...S} strokeWidth={1.8} d="M7 19h10.5a4.5 4.5 0 0 0 .6-9A6 6 0 0 0 6.6 9.6 4.8 4.8 0 0 0 7 19Z" />,
  'square.and.arrow.down': (
    <g {...S} strokeWidth={1.8}>
      <path d="M8 9H6.5A1.5 1.5 0 0 0 5 10.5v9A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 17.5 9H16" />
      <path d="M12 3v12M8.5 11.5 12 15l3.5-3.5" />
    </g>
  ),
  'play.rectangle.fill': (
    <g>
      <rect {...F} x="2" y="4.5" width="20" height="15" rx="3.5" />
      <path fill="var(--t7-bg, #fff)" d="M10 8.6v6.8c0 .5.5.8.9.5l5.3-3.4a.6.6 0 0 0 0-1L10.9 8.1c-.4-.3-.9 0-.9.5Z" />
    </g>
  ),
  film: (
    <g>
      <rect {...S} strokeWidth={1.8} x="3" y="3" width="18" height="18" rx="2.5" />
      <path {...S} strokeWidth={1.6} d="M7 3v18M17 3v18M3 8h4M3 12h18M3 16h4M17 8h4M17 16h4" />
    </g>
  ),
  'tv.fill': (
    <g {...F}>
      <rect x="2" y="4" width="20" height="13.5" rx="2.5" />
      <rect x="7" y="19" width="10" height="1.8" rx=".9" />
    </g>
  ),
  'arrow.down.circle.fill': (
    <g>
      <circle {...F} cx="12" cy="12" r="10" />
      <path fill="none" stroke="var(--t7-bg, #fff)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M12 7v9M8 12.5l4 4 4-4" />
    </g>
  ),
  'bolt.fill': <path {...F} d="M13.5 2 4.5 13.5H11L9.8 22l9.2-12H12.8z" />,
  'bolt.slash.fill': (
    <g>
      <path {...F} d="M13.5 2 8.4 8.5l7.4 7.4L19 10h-6.2zM4.5 13.5H11L9.8 22l3.8-5L6.8 10.2z" />
      <path {...S} strokeWidth={1.8} d="m3 3 18 18" />
    </g>
  ),
  'square.stack.3d.up': <path {...S} strokeWidth={1.7} d="M12 3 3 7.5l9 4.5 9-4.5zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5" />,
  safari: (
    <g>
      <circle {...S} strokeWidth={1.8} cx="12" cy="12" r="9.5" />
      <path {...F} d="m15.8 8.2-2.5 5.1-5.1 2.5 2.5-5.1z" />
    </g>
  ),
  'book.closed': <path {...S} strokeWidth={1.8} d="M6 3h12a1 1 0 0 1 1 1v14H7a2 2 0 0 0 0 4h12M5 20V5a2 2 0 0 1 2-2" />,
  'tray.full': (
    <g {...S} strokeWidth={1.8}>
      <path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5l-3-8H6zM3 13h5l1.5 2.5h5L16 13h5" />
      <path d="M8 8h8M7 10.5h10" />
    </g>
  ),
  'square.grid.3x3': (
    <g {...F}>
      {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={3 + c * 6.5} y={3 + r * 6.5} width="5" height="5" rx="1.2" />))}
    </g>
  ),
  'lightbulb': <path {...S} d="M9 18h6M10 21.5h4M12 2.5a6.5 6.5 0 0 0-4 11.6c.8.6 1 1.4 1 2.4h6c0-1 .2-1.8 1-2.4A6.5 6.5 0 0 0 12 2.5Z" />,
};

export function Glyph({
  name,
  size = 22,
  style,
  className,
  weight,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
  className?: string;
  /** stroke width multiplier */
  weight?: number;
}) {
  const g = G[name] ?? G['app.badge'];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`t7-glyph ${className ?? ''}`}
      style={{ ...style, ...(weight ? { strokeWidth: weight } : null) }}
      aria-hidden
    >
      {g}
    </svg>
  );
}

export const hasGlyph = (n: string) => n in G;

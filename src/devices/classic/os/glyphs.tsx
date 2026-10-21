/** Small vector glyphs drawn the way the iPod classic draws them. */
import type { CSSProperties } from 'react';

export const APPLE_PATH =
  'M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.197-2.12-9.973-3.17-14.34-3.17-4.58 0-9.492 1.05-14.746 3.17-5.262 2.13-9.501 3.24-12.742 3.35-4.929.21-9.842-1.96-14.746-6.52-3.13-2.73-7.045-7.41-11.735-14.04-5.032-7.08-9.169-15.29-12.41-24.65-3.471-10.11-5.211-19.9-5.211-29.378 0-10.857 2.346-20.221 7.045-28.068 3.693-6.303 8.606-11.275 14.755-14.925s12.793-5.51 19.948-5.629c3.915 0 9.049 1.211 15.429 3.591 6.362 2.388 10.447 3.599 12.238 3.599 1.339 0 5.877-1.416 13.57-4.239 7.275-2.618 13.415-3.702 18.445-3.275 13.63 1.1 23.87 6.473 30.68 16.153-12.19 7.386-18.22 17.731-18.1 31.002.11 10.337 3.86 18.939 11.23 25.769 3.34 3.17 7.07 5.62 11.22 7.36-.9 2.61-1.85 5.11-2.86 7.51zM119.11 7.24c0 8.102-2.96 15.667-8.86 22.669-7.12 8.324-15.732 13.134-25.071 12.375a25.222 25.222 0 0 1-.188-3.07c0-7.778 3.386-16.102 9.399-22.908 3.002-3.446 6.82-6.311 11.45-8.597 4.62-2.252 8.99-3.497 13.1-3.71.12 1.083.17 2.166.17 3.24z';

export function AppleLogo({ size, fill = 'currentColor', style, className }: { size: number; fill?: string; style?: CSSProperties; className?: string }) {
  return (
    <svg width={size * (150 / 170)} height={size} viewBox="10 0 150 170" style={style} className={className} aria-hidden>
      <path d={APPLE_PATH} fill={fill} />
    </svg>
  );
}

/** Status-bar play / pause icon (theme colored, glossy). */
export function PlayStateGlyph({ playing }: { playing: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" className="cl-glyph-play">
      <defs>
        <linearGradient id="clPlayGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--accent-hi)' }} />
          <stop offset="1" style={{ stopColor: 'var(--accent-lo)' }} />
        </linearGradient>
      </defs>
      {playing ? (
        <path d="M1.5 0.8 L10 5.5 L1.5 10.2 Z" fill="url(#clPlayGrad)" style={{ stroke: 'var(--accent-line)' }} strokeWidth="0.8" strokeLinejoin="round" />
      ) : (
        <g fill="url(#clPlayGrad)" style={{ stroke: 'var(--accent-line)' }} strokeWidth="0.8">
          <rect x="1.4" y="1" width="3" height="9" />
          <rect x="6.4" y="1" width="3" height="9" />
        </g>
      )}
    </svg>
  );
}

export function BatteryGlyph({ level, charging, dark }: { level: number; charging: boolean; dark?: boolean }) {
  const w = Math.max(1.5, 19 * Math.max(0, Math.min(1, level)));
  const low = level < 0.2 && !charging;
  return (
    <svg width="27" height="12" viewBox="0 0 27 12" className="cl-glyph-battery">
      <defs>
        <linearGradient id="clBatGreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c6f59a" />
          <stop offset="0.45" stopColor="#6fd13a" />
          <stop offset="0.55" stopColor="#4cb51c" />
          <stop offset="1" stopColor="#7ad84a" />
        </linearGradient>
        <linearGradient id="clBatRed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb3a8" />
          <stop offset="0.5" stopColor="#e2321f" />
          <stop offset="1" stopColor="#f0624f" />
        </linearGradient>
        <linearGradient id="clBatShell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={dark ? '#5a5a5a' : '#ffffff'} />
          <stop offset="1" stopColor={dark ? '#2a2a2a' : '#d7d7d7'} />
        </linearGradient>
      </defs>
      <rect x="0.75" y="0.75" width="22.5" height="10.5" rx="1.6" fill="url(#clBatShell)" stroke={dark ? '#9a9a9a' : '#6b6b6b'} strokeWidth="1" />
      <rect x="23.4" y="3.6" width="2.4" height="4.8" rx="0.8" fill={dark ? '#9a9a9a' : '#6b6b6b'} />
      <rect x="2.2" y="2.2" width={w} height="7.6" rx="0.6" fill={low ? 'url(#clBatRed)' : 'url(#clBatGreen)'} />
      {charging && <path d="M13.2 1.6 L8.6 6.6 H11.6 L10.4 10.6 L15.4 5.2 H12.3 Z" fill="#fff" stroke="#3a3a3a" strokeWidth="0.6" strokeLinejoin="round" />}
    </svg>
  );
}

export function LockGlyph({ size = 11, color = '#444' }: { size?: number; color?: string }) {
  return (
    <svg width={size * 0.8} height={size} viewBox="0 0 8 10" aria-hidden>
      <path d="M2 4.2V3a2 2 0 0 1 4 0v1.2" fill="none" stroke={color} strokeWidth="1.2" />
      <rect x="0.6" y="4.2" width="6.8" height="5.2" rx="0.8" fill={color} />
    </svg>
  );
}

/** The big padlock shown when a button is pressed with Hold on. */
export function BigLock({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 64 74" aria-hidden>
      <defs>
        <linearGradient id="clLockBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbd36b" />
          <stop offset="0.5" stopColor="#e9a521" />
          <stop offset="1" stopColor="#c47f0c" />
        </linearGradient>
        <linearGradient id="clLockShackle" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8d9096" />
          <stop offset="0.35" stopColor="#f4f5f7" />
          <stop offset="0.7" stopColor="#a5a8ad" />
          <stop offset="1" stopColor="#6f7277" />
        </linearGradient>
      </defs>
      <path d="M14 34V22a18 18 0 0 1 36 0v12" fill="none" stroke="url(#clLockShackle)" strokeWidth="8" />
      <rect x="5" y="32" width="54" height="40" rx="6" fill="url(#clLockBody)" stroke="#9a6406" strokeWidth="1.5" />
      <rect x="7" y="34" width="50" height="14" rx="5" fill="rgba(255,255,255,0.28)" />
      <circle cx="32" cy="52" r="5" fill="#6b4300" />
      <rect x="30" y="54" width="4" height="10" rx="1.5" fill="#6b4300" />
    </svg>
  );
}

export function Chevron({ color }: { color?: string }) {
  return (
    <svg width="7" height="11" viewBox="0 0 7 11" className="cl-chev" aria-hidden>
      <path d="M1.2 1.2 L5.6 5.5 L1.2 9.8" fill="none" stroke={color ?? 'currentColor'} strokeWidth="2.1" strokeLinecap="square" />
    </svg>
  );
}

/** Speaker shown next to the song that is playing. */
export function SpeakerGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 13 11" className="cl-speaker" aria-hidden>
      <path d="M0.8 3.6h2.6L7 0.8v9.4L3.4 7.4H0.8z" fill="currentColor" />
      <path d="M8.6 3.2a3 3 0 0 1 0 4.6M10.2 1.6a5.3 5.3 0 0 1 0 7.8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function SpeakerLevel({ loud, size = 14 }: { loud: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden>
      <path d="M1 5h2.6L7 2v10L3.6 9H1z" fill="#2c2c2c" />
      {loud ? (
        <path d="M8.8 4.6a3.2 3.2 0 0 1 0 4.8M10.4 2.8a5.8 5.8 0 0 1 0 8.4M12 1.2a8.2 8.2 0 0 1 0 11.6" fill="none" stroke="#2c2c2c" strokeWidth="1.1" strokeLinecap="round" />
      ) : (
        <path d="M8.8 5.2a2.4 2.4 0 0 1 0 3.6" fill="none" stroke="#2c2c2c" strokeWidth="1.1" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function Star({ filled, size = 13 }: { filled: boolean; size?: number }) {
  if (!filled)
    return (
      <svg width={size} height={size} viewBox="0 0 13 13" aria-hidden>
        <circle cx="6.5" cy="6.5" r="1.6" fill="#555" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" aria-hidden>
      <path d="M6.5 0.6l1.75 3.85 4.2.45-3.13 2.85.88 4.13L6.5 9.75 2.8 11.88l.88-4.13L.55 4.9l4.2-.45z" fill="#2a2a2a" />
    </svg>
  );
}

export function ShuffleGlyph({ size = 14, color = '#333' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 16 12" aria-hidden>
      <path d="M1 3h3c3 0 4 6 7 6h2M1 9h3c1.3 0 2.1-1 2.8-2.2M9 4.4C9.6 3.6 10.3 3 11.5 3H13" fill="none" stroke={color} strokeWidth="1.4" />
      <path d="M12.6 0.8L15.4 3 12.6 5.2zM12.6 6.8L15.4 9 12.6 11.2z" fill={color} />
    </svg>
  );
}

export function RepeatGlyph({ size = 14, one, color = '#333' }: { size?: number; one?: boolean; color?: string }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 16 12" aria-hidden>
      <path d="M2 6V4.6C2 3.7 2.7 3 3.6 3H12M14 6v1.4c0 .9-.7 1.6-1.6 1.6H4" fill="none" stroke={color} strokeWidth="1.4" />
      <path d="M11.4 0.6L14 3l-2.6 2.4zM4.6 6.6L2 9l2.6 2.4z" fill={color} />
      {one && <text x="8" y="8" fontSize="6" fontWeight="700" textAnchor="middle" fill={color} fontFamily="Helvetica, Arial">1</text>}
    </svg>
  );
}

export function Check({ color }: { color?: string }) {
  return (
    <svg width="12" height="11" viewBox="0 0 12 11" className="cl-check" aria-hidden>
      <path d="M1.2 6 L4.4 9.2 L10.8 1.4" fill="none" stroke={color ?? 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GeniusGlyph({ size = 14, color = '#333' }: { size?: number; color?: string }) {
  // the Genius "atom"
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <g fill="none" stroke={color} strokeWidth="1.1">
        <ellipse cx="8" cy="8" rx="7" ry="2.8" />
        <ellipse cx="8" cy="8" rx="7" ry="2.8" transform="rotate(60 8 8)" />
        <ellipse cx="8" cy="8" rx="7" ry="2.8" transform="rotate(-60 8 8)" />
      </g>
      <circle cx="8" cy="8" r="1.5" fill={color} />
    </svg>
  );
}

/** Generic large icons for empty artwork panels. */
export function PanelIcon({ kind, size = 84 }: { kind: string; size?: number }) {
  const s = { width: size, height: size };
  const c = '#7d8794';
  switch (kind) {
    case 'photos':
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden>
          <rect x="6" y="12" width="52" height="40" rx="3" fill="#fff" stroke={c} strokeWidth="2.5" />
          <path d="M10 46l14-16 10 11 7-7 13 12z" fill="#8fb1d6" />
          <circle cx="44" cy="23" r="5" fill="#f2c94c" />
        </svg>
      );
    case 'videos':
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden>
          <rect x="6" y="12" width="52" height="40" rx="3" fill="#2b2f36" stroke={c} strokeWidth="2.5" />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <rect x={9 + i * 10} y="15" width="5" height="4" rx="1" fill="#cfd5dc" />
              <rect x={9 + i * 10} y="45" width="5" height="4" rx="1" fill="#cfd5dc" />
            </g>
          ))}
          <path d="M27 24v16l13-8z" fill="#fff" />
        </svg>
      );
    case 'podcasts':
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="26" r="9" fill="#9b59d0" />
          <path d="M18 40a18 18 0 1 1 28 0M12 46a26 26 0 1 1 40 0" fill="none" stroke="#9b59d0" strokeWidth="3" strokeLinecap="round" />
          <rect x="29" y="34" width="6" height="22" rx="3" fill="#9b59d0" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden>
          <g transform="translate(32 32)">
            {Array.from({ length: 10 }, (_, i) => (
              <rect key={i} x="-4" y="-27" width="8" height="12" rx="1.5" fill={c} transform={`rotate(${i * 36})`} />
            ))}
            <circle r="18" fill={c} />
            <circle r="7" fill="#eef1f4" />
          </g>
        </svg>
      );
    case 'extras':
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r="26" fill="#fff" stroke={c} strokeWidth="3" />
          <path d="M32 14v18l12 8" fill="none" stroke="#333" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...s} viewBox="0 0 64 64" aria-hidden>
          <path d="M44 8v33a8 8 0 1 1-4-6.9V19l-18 4.5V45a8 8 0 1 1-4-6.9V15z" fill={c} />
        </svg>
      );
  }
}

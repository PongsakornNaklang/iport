import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...p });

export const IconMusic = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);
export const IconBrush = (p: P) => (
  <svg {...base(p)}>
    <path d="M18.4 2.6a2 2 0 0 1 2.9 2.9L12 14.8 9.2 12z" />
    <path d="M9.2 12C6 12 4.6 14 4.6 16.2c0 1.5-1 2.6-2.1 3.3 1.2.9 3 1.5 4.6 1.5 3.4 0 5-2.3 5-4.9" />
  </svg>
);
export const IconHelp = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M9.4 9.2a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.4-2.6 4" />
    <circle cx="12" cy="17.2" r="0.6" fill="currentColor" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconChevronDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const IconChevronLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const IconChevronRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const IconRotate = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 3v6h-6" />
  </svg>
);
export const IconUndo = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);
export const IconRedo = (p: P) => (
  <svg {...base(p)}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </svg>
);
export const IconCamera = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2l1.5-2h6l1.5 2h2A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
    <circle cx="12" cy="13" r="3.6" />
  </svg>
);
export const IconFront = (p: P) => (
  <svg {...base(p)}>
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
    <circle cx="12" cy="16" r="2.6" />
    <rect x="8.4" y="5" width="7.2" height="5.6" rx="0.8" />
  </svg>
);
export const IconBack = (p: P) => (
  <svg {...base(p)}>
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
    <path d="M12 8.5c-.9 0-1.6.6-1.6 1.6M10 12.5h4" />
  </svg>
);
export const IconSide = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 2.5h4.5l1.5 1.5v16l-1.5 1.5H9z" />
  </svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconMinus = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3" />
  </svg>
);
export const IconFolder = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
  </svg>
);
export const IconFile = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);
export const IconLink = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 14a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.5 1.5" />
    <path d="M14 10a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.5-1.5" />
  </svg>
);
export const IconDownload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
  </svg>
);
export const IconUpload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 21V9M7 14l5-5 5 5M4 4h16" />
  </svg>
);
export const IconSave = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
    <path d="M8 3v5h7V3M8 21v-7h8v7" />
  </svg>
);
export const IconShare = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v13M7 8l5-5 5 5" />
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);
export const IconPlay = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M7 4.5v15l12.5-7.5z" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const IconRadio = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="2" />
    <path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5" />
  </svg>
);
export const IconLogo = (p: P) => (
  <svg viewBox="0 0 24 24" {...p}>
    <defs>
      <linearGradient id="lg-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fafafa" />
        <stop offset="1" stopColor="#c7cad0" />
      </linearGradient>
    </defs>
    <rect x="5" y="1" width="14" height="22" rx="2.8" fill="url(#lg-body)" />
    <rect x="6.8" y="2.8" width="10.4" height="7.6" rx="0.8" fill="#1f3550" />
    <circle cx="12" cy="16.4" r="4.4" fill="#fff" stroke="#cfd2d7" strokeWidth="0.4" />
    <circle cx="12" cy="16.4" r="1.6" fill="#e8e9ec" stroke="#cfd2d7" strokeWidth="0.3" />
  </svg>
);

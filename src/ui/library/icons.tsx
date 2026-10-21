import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  width: 18,
  height: 18,
  ...p,
});

export const IconComputer = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="12" rx="1.8" />
    <path d="M1.5 19.5h21M9 16.5l-.5 3M15 16.5l.5 3" />
  </svg>
);
export const IconYouTube = (p: P) => (
  <svg {...base({ ...p, strokeWidth: 0 })} fill="currentColor">
    <path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3z" />
  </svg>
);
export const IconSoundCloud = (p: P) => (
  <svg {...base({ ...p, strokeWidth: 0 })} fill="currentColor">
    <path d="M10.5 8.2c.5-.2 1-.3 1.6-.3a4.6 4.6 0 0 1 4.5 3.9 2.9 2.9 0 1 1 .6 5.7H10.5zM8.9 9.4h.9v7.9h-.9zM7.3 10.4h.9v6.9h-.9zM5.7 10h.9v7.3h-.9zM4.1 11.4H5v5.9h-.9zM2.5 12.6h.9v4.4h-.9z" />
  </svg>
);
export const IconAudius = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5 21 19H3z" />
    <path d="M12 9.5 16.5 17h-9z" />
  </svg>
);
export const IconArchive = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8.5 12 4l9 4.5M4.5 8.5h15M6 9v8.5M10 9v8.5M14 9v8.5M18 9v8.5M3.5 20h17M4.5 18h15" />
  </svg>
);
export const IconPodcast = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="10.5" r="2.2" />
    <path d="M11 14.5h2l-.5 6h-1zM8 15a5.5 5.5 0 1 1 8 0M5.6 17.6a9 9 0 1 1 12.8 0" />
  </svg>
);
export const IconStore = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9.2" />
    <path d="M10.2 15.6V8.2l6-1.4v7.3" />
    <circle cx="8.8" cy="15.7" r="1.5" />
    <circle cx="14.8" cy="14.2" r="1.5" />
  </svg>
);
export const IconPhoto = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4.5" width="18" height="15" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="m21 16-5.5-5.5L5 19.5" />
  </svg>
);
export const IconNote = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M15 3v4h4M9 11h7M9 14.5h7M9 18h4" />
  </svg>
);
export const IconContact = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </svg>
);
export const IconCalendar = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </svg>
);
export const IconAlarm = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="13" r="7.5" />
    <path d="M12 9v4l2.5 2M4 4.5 6.5 2.5M20 4.5l-2.5-2" />
  </svg>
);
export const IconGlobe = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
  </svg>
);
export const IconMore = (p: P) => (
  <svg {...base({ ...p, strokeWidth: 0 })} fill="currentColor">
    <circle cx="5.5" cy="12" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="18.5" cy="12" r="1.7" />
  </svg>
);
export const IconPause = (p: P) => (
  <svg {...base({ ...p, strokeWidth: 0 })} fill="currentColor">
    <rect x="6.5" y="5" width="3.8" height="14" rx="1" />
    <rect x="13.7" y="5" width="3.8" height="14" rx="1" />
  </svg>
);
export const IconStar = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? 'currentColor' : 'none'}>
    <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
  </svg>
);
export const IconEdit = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
);
export const IconSpeaker = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
);
export const IconUp = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 15 6-6 6 6" />
  </svg>
);
export const IconDown = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const IconBackArrow = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 5 8 12l7 7" />
  </svg>
);
export const IconPlaylist = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6h12M4 11h12M4 16h7" />
    <path d="M18 13v6.5" />
    <circle cx="16.2" cy="19.4" r="1.8" />
    <path d="M18 13l3-1" />
  </svg>
);
export const IconQueueNext = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6h10M4 11h10M4 16h6" />
    <path d="m15 13.5 5 3-5 3z" fill="currentColor" />
  </svg>
);
export const IconSelect = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="m8.5 12.2 2.4 2.4 4.8-5" />
  </svg>
);
export const IconImage = IconPhoto;
export const IconVideo = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="m16 10.5 5-3v9l-5-3z" />
  </svg>
);
export const IconWand = (p: P) => (
  <svg {...base(p)}>
    <path d="m4 20 11-11M14 4v3M19.5 9.5h-3M17.9 5.6l-2 2M11 4.8l.8 1.4M19.2 13l-1.4-.8" />
  </svg>
);

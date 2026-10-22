import type { DeviceModel } from './types';

/**
 * Every iPod in the app, newest first.
 * Sizes are real dimensions converted to px so each screen renders at its
 * native resolution (classic 320×240, nano 240×432, touch 320×568 pt).
 */
export const MODELS: DeviceModel[] = [
  {
    id: 'touch7',
    name: 'iPod touch',
    generation: '7th generation',
    year: 2019,
    blurb: 'The last iPod. 4" Retina display, iOS, A10 Fusion.',
    family: 'touch',
    // 58.6 × 123.4 × 6.1 mm @ 6.41 px/mm (320 pt wide screen)
    size: { width: 376, height: 791, depth: 39 },
    colorSlots: [
      { key: 'back', label: 'Aluminium back' },
      { key: 'front', label: 'Front glass' },
    ],
    options: [
      {
        key: 'wallpaper',
        label: 'Wallpaper',
        type: 'select',
        choices: [
          { value: 'ios15', label: 'iOS 15 Blue' },
          { value: 'ios13', label: 'iOS 13 Dark' },
          { value: 'aurora', label: 'Aurora' },
          { value: 'sunset', label: 'Sunset' },
          { value: 'graphite', label: 'Graphite' },
          { value: 'album', label: 'Now Playing artwork' },
        ],
      },
      { key: 'darkMode', label: 'Dark Mode', type: 'toggle' },
    ],
    finishes: [
      { id: 'spacegray', name: 'Space Gray', swatch: '#5c5d61', colors: { back: '#6b6c70', front: '#0d0d0f' } },
      { id: 'silver', name: 'Silver', swatch: '#e2e3e4', colors: { back: '#dcdddf', front: '#f6f6f7' } },
      { id: 'gold', name: 'Gold', swatch: '#efd7c0', colors: { back: '#ecd3bb', front: '#f6f6f7' } },
      { id: 'pink', name: 'Pink', swatch: '#f3c2cc', colors: { back: '#efbcc7', front: '#f6f6f7' } },
      { id: 'blue', name: 'Blue', swatch: '#2d7fd0', colors: { back: '#2f80cf', front: '#f6f6f7' } },
      { id: 'red', name: '(PRODUCT)RED', swatch: '#c41230', colors: { back: '#c3132f', front: '#f6f6f7' } },
    ],
    engravable: true,
    jack: { x: -96, y: 395.5, z: 0, ny: 1, pxPerMm: 6.41 },
    cover: {
      radius: 54,
      cases: true,
      holes: [
        { side: 'bottom', at: -96, len: 32, thick: 28 }, // headphone jack
        { side: 'bottom', at: 0, len: 66, thick: 20 }, // Lightning
        { side: 'bottom', at: 80, len: 74, thick: 16 }, // speaker
        { side: 'top', at: 118, len: 48, thick: 18 }, // Sleep/Wake
        { side: 'left', at: -245.5, len: 42, thick: 18 }, // volume up
        { side: 'left', at: -199.5, len: 42, thick: 18 }, // volume down
      ],
      camera: { x: 53.6, y: 53.6, d: 42 },
    },
    load: () => import('./touch7'),
  },
  {
    id: 'nano7',
    name: 'iPod nano',
    generation: '7th generation',
    year: 2012,
    blurb: '2.5" Multi-Touch, Bluetooth, FM radio, Fitness. The thinnest iPod ever.',
    family: 'nano-touch',
    // 39.6 × 76.5 × 5.4 mm @ 7.78 px/mm (240 px wide screen)
    size: { width: 308, height: 595, depth: 42 },
    fitHeight: 0.8,
    colorSlots: [
      { key: 'body', label: 'Aluminium body' },
      { key: 'front', label: 'Front glass' },
      { key: 'home', label: 'Home button' },
    ],
    options: [
      {
        key: 'wallpaper',
        label: 'Wallpaper',
        type: 'select',
        choices: [
          { value: 'dark', label: 'Dark' },
          { value: 'blue', label: 'Blue' },
          { value: 'bokeh', label: 'Bokeh' },
          { value: 'stripes', label: 'Stripes' },
        ],
      },
    ],
    finishes: [
      { id: 'spacegray', name: 'Space Gray', swatch: '#5c5e62', colors: { body: '#626569', front: '#111113', home: '#1b1b1d' } },
      { id: 'silver', name: 'Silver', swatch: '#d9dbdd', colors: { body: '#d6d8da', front: '#f7f7f8', home: '#ececee' } },
      { id: 'gold', name: 'Gold', swatch: '#e8cfb2', colors: { body: '#e5ccaf', front: '#f7f7f8', home: '#ececee' } },
      { id: 'pink', name: 'Pink', swatch: '#ef9fbb', colors: { body: '#ec9ab6', front: '#f7f7f8', home: '#ececee' } },
      { id: 'blue', name: 'Blue', swatch: '#2a8ad6', colors: { body: '#2a88d4', front: '#f7f7f8', home: '#ececee' } },
      { id: 'red', name: '(PRODUCT)RED', swatch: '#c3122e', colors: { body: '#c1132f', front: '#f7f7f8', home: '#ececee' } },
      { id: 'slate', name: 'Slate (2012)', swatch: '#3c3e42', colors: { body: '#3e4044', front: '#111113', home: '#1b1b1d' } },
      { id: 'purple', name: 'Purple (2012)', swatch: '#8d63b8', colors: { body: '#8e62b8', front: '#f7f7f8', home: '#ececee' } },
      { id: 'yellow', name: 'Yellow (2012)', swatch: '#f2d23c', colors: { body: '#f0d03e', front: '#f7f7f8', home: '#ececee' } },
      { id: 'green', name: 'Green (2012)', swatch: '#8cc63e', colors: { body: '#8bc540', front: '#f7f7f8', home: '#ececee' } },
    ],
    engravable: true,
    jack: { x: -86, y: 297.5, z: 0, ny: 1, pxPerMm: 7.78 },
    cover: {
      radius: 38,
      cases: true,
      holes: [
        { side: 'bottom', at: -86, len: 36, thick: 32 }, // headphone jack
        { side: 'bottom', at: 0, len: 70, thick: 22 }, // Lightning
        { side: 'top', at: 88, len: 58, thick: 22 }, // Sleep/Wake
        { side: 'left', at: -127.5, len: 132, thick: 22 }, // volume and play/pause
      ],
    },
    load: () => import('./nano7'),
  },
  {
    id: 'shuffle4',
    name: 'iPod shuffle',
    generation: '4th generation',
    year: 2010,
    blurb: 'Clip it on. VoiceOver tells you what’s playing.',
    family: 'shuffle',
    // 29.0 × 31.6 × 8.7 mm (with clip) @ 10 px/mm
    size: { width: 290, height: 316, depth: 87 },
    fitHeight: 0.46,
    colorSlots: [
      { key: 'body', label: 'Aluminium body' },
      { key: 'pad', label: 'Control pad' },
      { key: 'symbols', label: 'Control symbols' },
    ],
    finishes: [
      { id: 'spacegray', name: 'Space Gray', swatch: '#5d5f63', colors: { body: '#606266', pad: '#4a4b4f', symbols: '#e9e9ea' } },
      { id: 'silver', name: 'Silver', swatch: '#d8dadc', colors: { body: '#d5d7d9', pad: '#f3f3f4', symbols: '#8a8b8f' } },
      { id: 'gold', name: 'Gold', swatch: '#e7cdb0', colors: { body: '#e4cbae', pad: '#f3f3f4', symbols: '#8a8b8f' } },
      { id: 'pink', name: 'Pink', swatch: '#ee9db9', colors: { body: '#eb98b4', pad: '#f3f3f4', symbols: '#8a8b8f' } },
      { id: 'blue', name: 'Blue', swatch: '#2a89d5', colors: { body: '#2a87d3', pad: '#f3f3f4', symbols: '#8a8b8f' } },
      { id: 'red', name: '(PRODUCT)RED', swatch: '#c3122e', colors: { body: '#c1132f', pad: '#f3f3f4', symbols: '#8a8b8f' } },
      { id: 'orange', name: 'Orange (2010)', swatch: '#f08a24', colors: { body: '#ee8826', pad: '#f3f3f4', symbols: '#8a8b8f' } },
      { id: 'green', name: 'Green (2010)', swatch: '#9cc93b', colors: { body: '#9ac73d', pad: '#f3f3f4', symbols: '#8a8b8f' } },
    ],
    engravable: true,
    jack: { x: -92, y: -160.4, z: 15.5, ny: -1, pxPerMm: 10 },
    // socks only: a case would cover the clip
    cover: { radius: 26, cases: false, holes: [] },
    load: () => import('./shuffle4'),
  },
  {
    id: 'classic',
    name: 'iPod classic',
    generation: '6th generation · 160GB',
    year: 2009,
    blurb: 'The legend. Click Wheel, Cover Flow, 40,000 songs in your pocket.',
    family: 'clickwheel',
    // 61.8 × 103.5 × 10.5 mm @ 6.3 px/mm (320 × 240 screen)
    size: { width: 389, height: 652, depth: 66 },
    colorSlots: [
      { key: 'front', label: 'Anodized front' },
      { key: 'wheel', label: 'Click Wheel' },
      { key: 'labels', label: 'Wheel labels' },
      { key: 'center', label: 'Center button' },
      { key: 'back', label: 'Back' },
    ],
    options: [
      {
        key: 'backMaterial',
        label: 'Back material',
        type: 'select',
        choices: [
          { value: 'chrome', label: 'Polished stainless steel' },
          { value: 'matte', label: 'Brushed / matte' },
          { value: 'painted', label: 'Painted (uses Back color)' },
        ],
      },
      {
        key: 'theme',
        label: 'Screen theme',
        type: 'select',
        choices: [
          { value: 'classic', label: 'Classic blue' },
          { value: 'graphite', label: 'Graphite' },
          { value: 'red', label: 'Red' },
          { value: 'green', label: 'Green' },
        ],
      },
    ],
    finishes: [
      {
        id: 'silver',
        name: 'Silver',
        swatch: '#d7d8da',
        colors: { front: '#d5d6d8', wheel: '#f6f6f6', labels: '#aeb0b4', center: '#d9dadc', back: '#c9cbce' },
        options: { backMaterial: 'chrome', theme: 'classic' },
      },
      {
        id: 'black',
        name: 'Black',
        swatch: '#2a2b2d',
        colors: { front: '#2b2c2e', wheel: '#1a1a1c', labels: '#9a9ba0', center: '#2b2c2e', back: '#c9cbce' },
        options: { backMaterial: 'chrome', theme: 'classic' },
      },
      {
        id: 'u2',
        name: 'U2 Special Edition',
        swatch: '#b5121b',
        colors: { front: '#111112', wheel: '#c0151f', labels: '#2a0a0c', center: '#111112', back: '#3a3b3e' },
        options: { backMaterial: 'chrome', theme: 'red' },
      },
      {
        id: 'white',
        name: 'Classic White',
        swatch: '#f4f4f2',
        colors: { front: '#f3f3f1', wheel: '#fbfbfb', labels: '#b9bbbf', center: '#f0f0ee', back: '#c9cbce' },
        options: { backMaterial: 'chrome', theme: 'classic' },
      },
    ],
    engravable: true,
    jack: { x: -120.5, y: 326, z: 0, ny: 1, pxPerMm: 6.3 },
    cover: {
      radius: 42,
      cases: true,
      holes: [
        { side: 'top', at: -130.5, len: 46, thick: 22, z: 2 }, // Hold switch
        { side: 'bottom', at: -120.5, len: 38, thick: 34 }, // headphone jack
        { side: 'bottom', at: 0, len: 150, thick: 26 }, // dock connector
      ],
    },
    load: () => import('./classic'),
  },
  {
    id: 'nano4',
    name: 'iPod nano',
    generation: '4th generation · 8GB',
    year: 2008,
    blurb: 'The "nano-chromatic": nine colours of curved aluminium, a tall screen that turns with you.',
    family: 'clickwheel',
    // 38.7 × 90.7 × 6.2 mm @ 7.87 px/mm (240 × 320 screen, held upright)
    size: { width: 305, height: 714, depth: 49 },
    colorSlots: [
      { key: 'front', label: 'Aluminium' },
      { key: 'wheel', label: 'Click Wheel' },
      { key: 'labels', label: 'Wheel labels' },
      { key: 'center', label: 'Center button' },
    ],
    options: [
      {
        key: 'theme',
        label: 'Screen theme',
        type: 'select',
        choices: [
          { value: 'classic', label: 'Classic blue' },
          { value: 'graphite', label: 'Graphite' },
          { value: 'red', label: 'Red' },
          { value: 'green', label: 'Green' },
        ],
      },
    ],
    finishes: [
      { id: 'silver', name: 'Silver', swatch: '#d6d8db', colors: { front: '#d6d8db', wheel: '#2b2b2d', labels: '#f4f4f4', center: '#d6d8db' } },
      { id: 'black', name: 'Black', swatch: '#2a2a2c', colors: { front: '#2a2a2c', wheel: '#1d1d1f', labels: '#8e9095', center: '#1d1d1f' } },
      { id: 'purple', name: 'Purple', swatch: '#8b5db8', colors: { front: '#8b5db8', wheel: '#f7f7f7', labels: '#a9abb0', center: '#f2f2f2' } },
      { id: 'blue', name: 'Blue', swatch: '#2f7fd0', colors: { front: '#2f7fd0', wheel: '#f7f7f7', labels: '#a9abb0', center: '#f2f2f2' } },
      { id: 'green', name: 'Green', swatch: '#79b83a', colors: { front: '#79b83a', wheel: '#f7f7f7', labels: '#a9abb0', center: '#f2f2f2' } },
      { id: 'yellow', name: 'Yellow', swatch: '#f0cf3a', colors: { front: '#f0cf3a', wheel: '#f7f7f7', labels: '#a9abb0', center: '#f2f2f2' } },
      { id: 'orange', name: 'Orange', swatch: '#ee8a2c', colors: { front: '#ee8a2c', wheel: '#f7f7f7', labels: '#a9abb0', center: '#f2f2f2' } },
      { id: 'pink', name: 'Pink', swatch: '#ea7fae', colors: { front: '#ea7fae', wheel: '#f7f7f7', labels: '#a9abb0', center: '#f2f2f2' } },
      { id: 'red', name: '(PRODUCT)RED', swatch: '#c3172e', colors: { front: '#c3172e', wheel: '#f7f7f7', labels: '#a9abb0', center: '#f2f2f2' } },
    ],
    engravable: true,
    // the front is nearly square-cornered, the screen almost as wide as the body
    clickWheel: {
      radius: 12,
      window: { w: 268, h: 344, top: 20 },
      lcd: { w: 240, h: 320 },
      wheel: { size: 226, center: 106, cy: 532 },
      dockW: 150,
    },
    jack: { x: -96, y: 357, z: 0, ny: 1, pxPerMm: 7.87 },
    cover: {
      radius: 12,
      cases: true,
      holes: [
        { side: 'top', at: 80, len: 40, thick: 16 }, // Hold switch
        { side: 'bottom', at: -96, len: 34, thick: 30 }, // headphone jack
        { side: 'bottom', at: 0, len: 160, thick: 22 }, // dock connector
      ],
    },
    load: () => import('./nano4'),
  },
  {
    id: 'video5',
    name: 'iPod video',
    generation: '5th generation · 30GB',
    year: 2005,
    blurb: 'The one in the ads: glossy white or black, a 2.5" colour screen, and video for the first time.',
    family: 'clickwheel',
    // 61.8 × 103.5 × 11 mm @ 6.3 px/mm (320 × 240 screen)
    size: { width: 389, height: 652, depth: 69 },
    colorSlots: [
      { key: 'front', label: 'Front' },
      { key: 'wheel', label: 'Click Wheel' },
      { key: 'labels', label: 'Wheel labels' },
      { key: 'center', label: 'Center button' },
      { key: 'back', label: 'Back' },
    ],
    options: [
      {
        key: 'backMaterial',
        label: 'Back material',
        type: 'select',
        choices: [
          { value: 'chrome', label: 'Polished stainless steel' },
          { value: 'matte', label: 'Brushed / matte' },
          { value: 'painted', label: 'Painted (uses Back color)' },
        ],
      },
      {
        key: 'theme',
        label: 'Screen theme',
        type: 'select',
        choices: [
          { value: 'classic', label: 'Classic blue' },
          { value: 'graphite', label: 'Graphite' },
          { value: 'red', label: 'Red' },
          { value: 'green', label: 'Green' },
        ],
      },
    ],
    finishes: [
      {
        id: 'white',
        name: 'White',
        swatch: '#f6f6f4',
        colors: { front: '#f6f6f4', wheel: '#fdfdfd', labels: '#b4b6ba', center: '#f4f4f2', back: '#c9cbce' },
        options: { backMaterial: 'chrome', theme: 'classic' },
      },
      {
        id: 'black',
        name: 'Black',
        swatch: '#161618',
        colors: { front: '#161618', wheel: '#232325', labels: '#8e9095', center: '#1a1a1c', back: '#c9cbce' },
        options: { backMaterial: 'chrome', theme: 'classic' },
      },
      {
        id: 'u2',
        name: 'U2 Special Edition',
        swatch: '#c0151f',
        colors: { front: '#121213', wheel: '#c0151f', labels: '#2a0a0c', center: '#121213', back: '#c9cbce' },
        options: { backMaterial: 'chrome', theme: 'red' },
      },
    ],
    engravable: true,
    jack: { x: 124, y: -326, z: 0, ny: -1, pxPerMm: 6.3 },
    cover: {
      radius: 42,
      cases: true,
      holes: [
        { side: 'top', at: -130.5, len: 46, thick: 22, z: 2 }, // Hold switch
        { side: 'top', at: 124, len: 38, thick: 34 }, // headphone jack
        { side: 'bottom', at: 0, len: 150, thick: 26 }, // dock connector
      ],
    },
    load: () => import('./video5'),
  },
  {
    id: 'mini2',
    name: 'iPod mini',
    generation: '2nd generation · 6GB',
    year: 2005,
    blurb: 'Anodized aluminium in bright colours, with the Click Wheel that started it all.',
    family: 'clickwheel',
    // 50.8 × 91 × 13 mm @ 8.14 px/mm (its 138 × 110 screen, drawn at twice the size)
    size: { width: 415, height: 741, depth: 106 },
    colorSlots: [
      { key: 'front', label: 'Aluminium' },
      { key: 'wheel', label: 'Click Wheel' },
      { key: 'labels', label: 'Wheel labels' },
      { key: 'center', label: 'Center button' },
      { key: 'caps', label: 'End caps' },
    ],
    options: [],
    finishes: [
      { id: 'silver', name: 'Silver', swatch: '#d2d4d7', colors: { front: '#d2d4d7', wheel: '#eeeff0', labels: '#a6a9ae', center: '#e4e5e7', caps: '#c4c6ca' } },
      { id: 'pink', name: 'Pink', swatch: '#f0a6c2', colors: { front: '#f0a6c2', wheel: '#f1eff0', labels: '#e88db0', center: '#ece8ea', caps: '#e7a2bd' } },
      { id: 'blue', name: 'Blue', swatch: '#74b7e4', colors: { front: '#74b7e4', wheel: '#eef1f3', labels: '#5ea8db', center: '#e6eaed', caps: '#6eaedb' } },
      { id: 'green', name: 'Green', swatch: '#a6d168', colors: { front: '#a6d168', wheel: '#eff2eb', labels: '#8fc24f', center: '#e7ebe2', caps: '#9ec862' } },
      { id: 'gold', name: 'Gold (2004)', swatch: '#e3cf9a', colors: { front: '#e3cf9a', wheel: '#efede7', labels: '#cdb57a', center: '#e8e5dc', caps: '#d8c38e' } },
    ],
    engravable: true,
    clickWheel: {
      radius: 60,
      window: { w: 300, h: 244, top: 66 },
      lcd: { w: 276, h: 220 },
      wheel: { size: 268, center: 104, cy: 532 },
      dockW: 140,
    },
    jack: { x: -120, y: -370.5, z: 0, ny: -1, pxPerMm: 8.14 },
    cover: {
      radius: 60,
      cases: true,
      holes: [
        { side: 'top', at: -120, len: 40, thick: 40 }, // headphone jack and remote connector
        { side: 'top', at: 118, len: 50, thick: 26 }, // Hold switch
        { side: 'bottom', at: 0, len: 156, thick: 30 }, // dock connector
      ],
    },
    load: () => import('./mini2'),
  },
];

export const MODELS_BY_ID: Record<string, DeviceModel> = Object.fromEntries(MODELS.map((m) => [m.id, m]));

export const DEFAULT_MODEL_ID = MODELS[0].id;

export function getModel(id: string | undefined): DeviceModel {
  return (id && MODELS_BY_ID[id]) || MODELS[0];
}

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export interface AppDef {
  id: string;
  name: string;
  /** status bar text color: light = white text */
  status: 'light' | 'dark' | 'auto';
  /** launch screen background */
  bg: 'system' | 'grouped' | 'black' | string;
  Comp: LazyExoticComponent<ComponentType>;
}

const stub = (name: string) => lazy(() => import('./Stubs').then((m) => ({ default: m.STUBS[name] })));

export const APPS: Record<string, AppDef> = {
  music: { id: 'music', name: 'Music', status: 'auto', bg: 'system', Comp: lazy(() => import('./music/Music')) },
  podcasts: { id: 'podcasts', name: 'Podcasts', status: 'auto', bg: 'system', Comp: lazy(() => import('./Podcasts')) },
  tv: { id: 'tv', name: 'TV', status: 'light', bg: 'black', Comp: lazy(() => import('./TV')) },
  photos: { id: 'photos', name: 'Photos', status: 'auto', bg: 'system', Comp: lazy(() => import('./Photos')) },
  camera: { id: 'camera', name: 'Camera', status: 'light', bg: 'black', Comp: lazy(() => import('./Camera')) },
  clock: { id: 'clock', name: 'Clock', status: 'light', bg: 'black', Comp: lazy(() => import('./Clock')) },
  calculator: { id: 'calculator', name: 'Calculator', status: 'light', bg: 'black', Comp: lazy(() => import('./Calculator')) },
  notes: { id: 'notes', name: 'Notes', status: 'auto', bg: 'grouped', Comp: lazy(() => import('./Notes')) },
  calendar: { id: 'calendar', name: 'Calendar', status: 'auto', bg: 'system', Comp: lazy(() => import('./Calendar')) },
  contacts: { id: 'contacts', name: 'Contacts', status: 'auto', bg: 'system', Comp: lazy(() => import('./Contacts')) },
  voicememos: { id: 'voicememos', name: 'Voice Memos', status: 'auto', bg: 'system', Comp: lazy(() => import('./VoiceMemos')) },
  weather: { id: 'weather', name: 'Weather', status: 'light', bg: '#3a7bd5', Comp: lazy(() => import('./Weather')) },
  settings: { id: 'settings', name: 'Settings', status: 'auto', bg: 'grouped', Comp: lazy(() => import('./Settings')) },
  itunes: { id: 'itunes', name: 'iTunes Store', status: 'auto', bg: 'system', Comp: lazy(() => import('./ITunes')) },
  safari: { id: 'safari', name: 'Safari', status: 'auto', bg: 'system', Comp: lazy(() => import('./Safari')) },
  reminders: { id: 'reminders', name: 'Reminders', status: 'auto', bg: 'grouped', Comp: lazy(() => import('./Reminders')) },
  messages: { id: 'messages', name: 'Messages', status: 'auto', bg: 'system', Comp: stub('messages') },
  facetime: { id: 'facetime', name: 'FaceTime', status: 'auto', bg: 'system', Comp: stub('facetime') },
  mail: { id: 'mail', name: 'Mail', status: 'auto', bg: 'grouped', Comp: stub('mail') },
  maps: { id: 'maps', name: 'Maps', status: 'dark', bg: '#efe9dc', Comp: stub('maps') },
  appstore: { id: 'appstore', name: 'App Store', status: 'auto', bg: 'system', Comp: stub('appstore') },
  books: { id: 'books', name: 'Books', status: 'auto', bg: 'system', Comp: stub('books') },
  findmy: { id: 'findmy', name: 'Find My', status: 'dark', bg: '#e9efe6', Comp: stub('findmy') },
  home: { id: 'home', name: 'Home', status: 'light', bg: '#7a5a3a', Comp: stub('home') },
  files: { id: 'files', name: 'Files', status: 'auto', bg: 'grouped', Comp: stub('files') },
  shortcuts: { id: 'shortcuts', name: 'Shortcuts', status: 'auto', bg: 'grouped', Comp: stub('shortcuts') },
  translate: { id: 'translate', name: 'Translate', status: 'auto', bg: 'grouped', Comp: stub('translate') },
  tips: { id: 'tips', name: 'Tips', status: 'auto', bg: 'system', Comp: stub('tips') },
};

export const appName = (id: string) => APPS[id]?.name ?? id;

/**
 * Home Screen folders: the icon (a frosted tile with its first nine apps),
 * the open folder (the Home Screen blurred behind it, three columns of apps,
 * its name editable while the icons jiggle) and the bookkeeping for making,
 * filling and emptying folders.
 */
import { useEffect, useRef, useState } from 'react';
import { appName } from '../apps/registry';
import { claim, localPoint, suppressNextClick } from './gesture';
import { AppIcon } from './icons';
import { os, prefs, usePrefs, useOS, type Folder, type HomeLayout } from './store';

/** iOS names a new folder after the App Store category of the apps in it */
const CATEGORY: Record<string, string> = {
  music: 'Entertainment',
  tv: 'Entertainment',
  podcasts: 'Entertainment',
  itunes: 'Entertainment',
  books: 'Books',
  photos: 'Photo & Video',
  camera: 'Photo & Video',
  messages: 'Social',
  facetime: 'Social',
  mail: 'Productivity',
  notes: 'Productivity',
  reminders: 'Productivity',
  calendar: 'Productivity',
  files: 'Productivity',
  safari: 'Utilities',
  clock: 'Utilities',
  calculator: 'Utilities',
  voicememos: 'Utilities',
  contacts: 'Utilities',
  settings: 'Utilities',
  findmy: 'Utilities',
  shortcuts: 'Utilities',
  tips: 'Utilities',
  translate: 'Utilities',
  appstore: 'Utilities',
  maps: 'Navigation',
  weather: 'Weather',
  home: 'Lifestyle',
};
export const folderName = (a: string, b: string) => {
  const x = CATEGORY[a];
  return x && x === CATEGORY[b] ? x : (x ?? CATEGORY[b] ?? 'Folder');
};

export const folderOf = (id: string) => prefs().folders[id.slice(7)] as Folder | undefined;

/** `id`, or the name of the folder it is */
export const iconName = (id: string, folders: Record<string, Folder>) => (id.startsWith('folder:') ? (folders[id.slice(7)]?.name ?? 'Folder') : appName(id));

/** Put `app` in with `target` (an app, which becomes a folder, or a folder). Returns the folder id. */
export function mergeInto(L: HomeLayout, target: string, app: string): { layout: HomeLayout; fid: string } {
  const folders = { ...prefs().folders };
  const pages = L.pages.map((p) => p.filter((x) => x !== app));
  const dock = L.dock.filter((x) => x !== app);
  let fid: string;
  if (target.startsWith('folder:')) {
    fid = target.slice(7);
    const f = folders[fid];
    folders[fid] = { ...f, apps: [...f.apps.filter((x) => x !== app), app] };
  } else {
    fid = Math.random().toString(36).slice(2, 9);
    folders[fid] = { name: folderName(target, app), apps: [target, app] };
    const swap = (x: string) => (x === target ? `folder:${fid}` : x);
    for (let i = 0; i < pages.length; i++) pages[i] = pages[i].map(swap);
    dock.splice(0, dock.length, ...dock.map(swap));
  }
  usePrefs.getState().set('folders', folders);
  return { layout: { pages, dock }, fid };
}

/** Take `app` out of folder `fid`; a folder left with one app becomes that app again. */
export function takeOut(fid: string, app: string) {
  const { folders, layout } = prefs();
  const f = folders[fid];
  if (!f) return;
  const rest = f.apps.filter((x) => x !== app);
  const next = { ...folders };
  const swap = (to: string | null) => (x: string) => (x === `folder:${fid}` ? to : x);
  const fix = (arr: string[], to: string | null) => arr.map(swap(to)).filter((x): x is string => x !== null);
  if (rest.length > 1) next[fid] = { ...f, apps: rest };
  else {
    delete next[fid];
    usePrefs.getState().set('layout', { pages: layout.pages.map((p) => fix(p, rest[0] ?? null)), dock: fix(layout.dock, rest[0] ?? null) });
  }
  usePrefs.getState().set('folders', next);
}

/** The folder's icon: its first nine apps, small, on frosted glass. */
export function FolderIcon({ fid, size = 60, merging }: { fid: string; size?: number; merging?: boolean }) {
  const f = usePrefs((s) => s.folders[fid]);
  const k = size / 60;
  return (
    <div className={`t7-folder-icon ${merging ? 'merging' : ''}`} style={{ width: size, height: size, borderRadius: size * 0.2237 }}>
      <div className="t7-folder-grid" style={{ padding: 7 * k, gap: 4 * k }}>
        {(f?.apps ?? []).slice(0, 9).map((a) => (
          <AppIcon key={a} id={a} size={12 * k} />
        ))}
      </div>
    </div>
  );
}

/**
 * An open folder. Tap an app to open it; outside to close. While the icons
 * jiggle the name can be edited, and an app dragged out of the folder goes
 * back onto the Home Screen (`onDragOut` hands the pointer over).
 */
export function FolderView({ fid, onClose, onDragOut }: { fid: string; onClose: () => void; onDragOut: (app: string, e: React.PointerEvent) => void }) {
  const f = usePrefs((s) => s.folders[fid]);
  const jiggle = useOS((s) => s.jiggle);
  const [shown, setShown] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const press = useRef<{ app: string; x: number; y: number; t: number } | null>(null);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);
  useEffect(() => {
    if (!f) onClose();
  }, [f, onClose]);
  if (!f) return null;
  const close = () => {
    setShown(false);
    window.setTimeout(onClose, 260);
  };
  return (
    <div className={`t7-folder-open ${shown ? 'on' : ''}`} onClick={close}>
      <div className="t7-folder-title" onClick={(e) => e.stopPropagation()}>
        {jiggle ? (
          <input
            className="t7-folder-name"
            value={f.name}
            onChange={(e) => usePrefs.getState().set('folders', { ...prefs().folders, [fid]: { ...f, name: e.target.value } })}
            onBlur={() => !f.name.trim() && usePrefs.getState().set('folders', { ...prefs().folders, [fid]: { ...f, name: 'Folder' } })}
            spellCheck={false}
          />
        ) : (
          f.name
        )}
      </div>
      <div ref={card} className="t7-folder-card" onClick={(e) => e.stopPropagation()}>
        {f.apps.map((a, i) => (
          <div
            key={a}
            className={`t7-hicon t7-folder-app ${jiggle ? 'jig' : ''}`}
            style={{ ['--jd' as string]: `${(i % 5) * -0.07}s`, ['--jr' as string]: i % 2 ? '1' : '-1' }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              // keep following the finger once it leaves the icon (to drag it out)
              if (useOS.getState().jiggle) e.currentTarget.setPointerCapture(e.pointerId);
              const t = window.setTimeout(() => {
                // a long press starts the jiggle, as on the Home Screen
                if (!useOS.getState().jiggle) {
                  suppressNextClick(600);
                  useOS.setState({ jiggle: true });
                }
              }, 520);
              press.current = { app: a, x: e.clientX, y: e.clientY, t };
            }}
            onPointerMove={(e) => {
              const p = press.current;
              if (!p || Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return;
              window.clearTimeout(p.t);
              if (!useOS.getState().jiggle) {
                press.current = null;
                return;
              }
              // out past the folder's edge: back onto the Home Screen
              const el = card.current!;
              const q = localPoint(el, e.clientX, e.clientY);
              if (q.x < -6 || q.y < -6 || q.x > el.offsetWidth + 6 || q.y > el.offsetHeight + 6) {
                press.current = null;
                if (!claim(e.pointerId, e.currentTarget)) return;
                suppressNextClick(400);
                onDragOut(a, e);
              }
            }}
            onPointerUp={() => {
              if (press.current) window.clearTimeout(press.current.t);
              press.current = null;
            }}
            onClick={() => {
              if (useOS.getState().jiggle) return;
              os.openApp(a, false);
              onClose();
            }}
          >
            <div className="t7-hicon-art">
              <AppIcon id={a} />
            </div>
            <div className="t7-hicon-label">{appName(a)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

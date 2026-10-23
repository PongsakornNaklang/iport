import { useOverview } from './shell/overview';
import { lazy, Suspense, useEffect, useState } from 'react';
import { redo, undo } from './core/customize/history';
import { decodePreset, useCustomize } from './core/customize/store';
import { Stage } from './shell/Stage';
import { ModelPicker } from './ui/ModelPicker';
import { ViewControls } from './ui/ViewControls';
import { FpsMeter } from './ui/FpsMeter';
import { IconBrush, IconHelp, IconLogo, IconMusic } from './ui/icons';
import { toast, useToast } from './ui/toast';
import { isTypingTarget } from './shell/keyboard';
import { useStage } from './shell/stageStore';
import { useLibrary } from './core/library/store';
import { seedDemoLibrary } from './core/library/demo';
import { player, usePlayer } from './core/player/player';
import './core/alarms';
import { APP_COMMIT, APP_VERSION, COPYRIGHT } from './version';
import { GlobalDropOverlay, useGlobalFileDrop } from './ui/library/globalDrop';

// Dev-only handle for debugging and automated checks.
if (import.meta.env.DEV) Object.assign(window, { iport: { player, usePlayer, useLibrary, useCustomize, useStage } });

const LibraryPanel = lazy(() => import('./ui/library/LibraryPanel'));
const CustomizePanel = lazy(() => import('./ui/customize/CustomizePanel'));
const HelpPanel = lazy(() => import('./ui/HelpPanel'));

type PanelId = 'library' | 'customize' | 'help' | null;

export function App() {
  const [panel, setPanel] = useState<PanelId>(null);
  const toastMsg = useToast((s) => s.message);
  const toastSerial = useToast((s) => s.serial);
  // Drag songs, videos or photos anywhere onto the page to import them.
  const dropActive = useGlobalFileDrop();
  const hydrated = useLibrary((s) => s.hydrated);
  const seeded = useLibrary((s) => s.seeded);
  const backdrop = useCustomize((s) => s.scene.backdrop);
  // while every iPod floats up to choose from, the controls for one iPod step aside
  const choosing = useOverview((s) => s.open);
  const darkScene = backdrop === 'studio' || backdrop === 'aurora' || backdrop === 'desk';

  // ?model=classic opens a specific iPod (handy for links and testing).
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('model');
    if (id) useCustomize.getState().setModel(id);
  }, []);

  // Shared preset links: #preset=…
  useEffect(() => {
    const m = location.hash.match(/preset=([A-Za-z0-9_-]+)/);
    if (!m) return;
    const p = decodePreset(m[1]);
    if (p) {
      useCustomize.getState().applyPresetObject(p);
      toast(`Loaded shared design “${p.name}”`);
    }
    history.replaceState(null, '', location.pathname + location.search);
  }, []);

  // First run: add a few demo tracks so there is something to play.
  useEffect(() => {
    if (hydrated && !seeded) void seedDemoLibrary();
  }, [hydrated, seeded]);

  // Tell the user when something can't play (the iPod itself just skips it).
  useEffect(
    () =>
      usePlayer.subscribe((s, prev) => {
        if (s.error && s.error !== prev.error) toast(s.error);
      }),
    [],
  );

  // Undo / redo design changes (text fields keep their own undo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) undo();
      else if ((k === 'z' && e.shiftKey) || k === 'y') redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Stage shortcuts that don't clash with device keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') useStage.getState().front();
      else if (e.key === 'b' || e.key === 'B') useStage.getState().back();
      else if (e.key === 'r' || e.key === 'R') useStage.getState().toggleSpin();
      else if (e.key === 't' || e.key === 'T') useStage.getState().toggleRoll();
      else if (e.key === '?') setPanel((p) => (p === 'help' ? null : 'help'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggle = (p: Exclude<PanelId, null>) => setPanel((cur) => (cur === p ? null : p));

  // Slide the iPod over so an open side panel doesn't cover it (desktop only).
  useEffect(() => {
    const update = () => {
      const wide = window.innerWidth > 900;
      const phone = window.innerWidth <= 720;
      const w = Math.min(392, window.innerWidth - 28) + 28;
      // phones: the panel is a bottom sheet, so shrink the iPod into the space above it
      const sheet = phone && panel ? Math.min(window.innerHeight * 0.74, 660) + 8 : 0;
      useStage.getState().setInset(wide && panel === 'library' ? w : 0, wide && (panel === 'customize' || panel === 'help') ? w : 0, sheet);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [panel]);

  return (
    <div className={`app ${darkScene ? 'scene-dark' : ''} ${choosing ? 'choosing' : ''}`}>
      <header className="topbar">
        <div className="brand" title={`iPort ${APP_VERSION} (${APP_COMMIT}) · ${COPYRIGHT}`}>
          <IconLogo className="brand-mark" />
          <span>iPort</span>
          <small>iPod for the web</small>
        </div>
        <div className="topbar-spacer" />
        <nav className="tb-group" aria-label="Panels">
          <button className={`icon-btn ${panel === 'library' ? 'active' : ''}`} onClick={() => toggle('library')} title="Add music & sync">
            <IconMusic />
            <span className="lbl">Library</span>
          </button>
          <button className={`icon-btn ${panel === 'customize' ? 'active' : ''}`} onClick={() => toggle('customize')} title="Customize & presets">
            <IconBrush />
            <span className="lbl">Customize</span>
          </button>
          <button className={`icon-btn round ${panel === 'help' ? 'active' : ''}`} onClick={() => toggle('help')} title="How to use (?)">
            <IconHelp />
          </button>
        </nav>
        <ModelPicker />
      </header>
      <main className="main">
        <Stage />
        <ViewControls />
        <FpsMeter />
        <Suspense fallback={null}>
          {panel === 'library' && <LibraryPanel onClose={() => setPanel(null)} />}
          {panel === 'customize' && <CustomizePanel onClose={() => setPanel(null)} />}
          {panel === 'help' && <HelpPanel onClose={() => setPanel(null)} />}
        </Suspense>
      </main>
      <GlobalDropOverlay active={dropActive} />
      {toastMsg && (
        <div className="toast" key={toastSerial} role="status">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

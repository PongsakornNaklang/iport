import { lazy, Suspense, useEffect, useState } from 'react';
import { decodePreset, useCustomize } from './core/customize/store';
import { Stage } from './shell/Stage';
import { ModelPicker } from './ui/ModelPicker';
import { ViewControls } from './ui/ViewControls';
import { IconBrush, IconHelp, IconLogo, IconMusic } from './ui/icons';
import { toast, useToast } from './ui/toast';
import { isTypingTarget } from './shell/keyboard';
import { useStage } from './shell/stageStore';
import { useLibrary } from './core/library/store';
import { seedDemoLibrary } from './core/library/demo';
import './core/alarms';

const LibraryPanel = lazy(() => import('./ui/library/LibraryPanel'));
const CustomizePanel = lazy(() => import('./ui/customize/CustomizePanel'));
const HelpPanel = lazy(() => import('./ui/HelpPanel'));

type PanelId = 'library' | 'customize' | 'help' | null;

export function App() {
  const [panel, setPanel] = useState<PanelId>(null);
  const toastMsg = useToast((s) => s.message);
  const toastSerial = useToast((s) => s.serial);
  const hydrated = useLibrary((s) => s.hydrated);
  const seeded = useLibrary((s) => s.seeded);

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

  // Stage shortcuts that don't clash with device keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') useStage.getState().front();
      else if (e.key === 'b' || e.key === 'B') useStage.getState().back();
      else if (e.key === 'r' || e.key === 'R') useStage.getState().toggleSpin();
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
      const w = Math.min(400, window.innerWidth - 20) + 20;
      useStage.getState().setInset(wide && panel === 'library' ? w : 0, wide && (panel === 'customize' || panel === 'help') ? w : 0);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [panel]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <IconLogo className="brand-mark" />
          <span>iPort</span>
          <small>iPod for the web</small>
        </div>
        <ModelPicker />
        <div className="topbar-spacer" />
        <button className={`icon-btn ${panel === 'library' ? 'active' : ''}`} onClick={() => toggle('library')} title="Add music & sync">
          <IconMusic />
          <span className="lbl">Library</span>
        </button>
        <button className={`icon-btn ${panel === 'customize' ? 'active' : ''}`} onClick={() => toggle('customize')} title="Customize & presets">
          <IconBrush />
          <span className="lbl">Customize</span>
        </button>
        <button className={`icon-btn ${panel === 'help' ? 'active' : ''}`} onClick={() => toggle('help')} title="How to use (?)">
          <IconHelp />
        </button>
      </header>
      <main className="main">
        <Stage />
        <ViewControls />
        <Suspense fallback={null}>
          {panel === 'library' && <LibraryPanel onClose={() => setPanel(null)} />}
          {panel === 'customize' && <CustomizePanel onClose={() => setPanel(null)} />}
          {panel === 'help' && <HelpPanel onClose={() => setPanel(null)} />}
        </Suspense>
      </main>
      {toastMsg && (
        <div className="toast" key={toastSerial} role="status">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

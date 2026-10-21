import { useEffect, useState, type CSSProperties } from 'react';
import { MediaLayer } from '../../../core/player/MediaLayer';
import { usePlayer } from '../../../core/player/player';
import { useSettings } from '../../../core/settings/store';
import { useNano, useNanoData, type AppId } from '../state';
import { APPS } from '../apps';
import { VideoPlayer } from '../apps/VideoPlayer';
import { Home } from './Home';
import { LockScreen } from './Lock';
import { ActionSheet, AlarmScreen, Toast, VolumeHud } from './Overlays';
import { StatusBar } from './StatusBar';
import { Wallpaper } from './wallpaper';
import { ArtOverlayCtx } from './context';

const W = 240;
const H = 432;

export const ART_RECT = { top: 18, left: 0, width: 240, height: 240 };

export function Screen({ wallpaper }: { wallpaper: string }) {
  const app = useNano((s) => s.app);
  const origin = useNano((s) => s.origin);
  const asleep = useNano((s) => s.asleep);
  const locked = useNano((s) => s.locked);
  const video = useNano((s) => s.video);
  const theme = useNano((s) => s.statusTheme);
  const statusHidden = useNano((s) => s.statusHidden);
  const artClaims = useNano((s) => s.artClaims);
  const hasVideo = usePlayer((s) => s.hasVideo);
  const kind = usePlayer((s) => s.kind);
  const error = usePlayer((s) => s.error);
  const brightness = useSettings((s) => s.brightness);
  const language = useSettings((s) => s.language);
  const invert = useNanoData((s) => s.invert);

  const [artEl, setArtEl] = useState<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState<AppId[]>(app ? [app] : []);
  const [shown, setShown] = useState<AppId | null>(app);
  const [phase, setPhase] = useState<'in' | 'out' | null>(null);

  useEffect(() => {
    let tm = 0;
    if (app) {
      setMounted((m) => (m.includes(app) ? m : [...m, app]));
      setShown(app);
      setPhase('in');
      tm = window.setTimeout(() => setPhase(null), 420);
    } else {
      setPhase('out');
      tm = window.setTimeout(() => {
        setShown(null);
        setPhase(null);
      }, 340);
    }
    return () => window.clearTimeout(tm);
  }, [app]);

  // home sets a light status bar
  useEffect(() => {
    if (!app) useNano.setState({ statusTheme: 'light', statusHidden: false });
  }, [app]);

  // the video picture replaces the artwork on Now Playing — unless it failed to load
  const showArt = artClaims > 0 && (hasVideo || kind === 'youtube') && !error && !locked && !video;
  let mediaStyle: CSSProperties | undefined;
  if (video) {
    mediaStyle = { inset: 'auto', left: (W - H) / 2, top: (H - W) / 2, width: H, height: W, transform: 'rotate(90deg)', zIndex: 6 };
  } else if (showArt) {
    mediaStyle = { inset: 'auto', ...ART_RECT, zIndex: 6 };
  }

  const homeHidden = !!shown && phase !== 'out';
  return (
    <ArtOverlayCtx.Provider value={artEl}>
    <div className={`n7-screen ${invert ? 'n7-invert' : ''}`} data-control key={language}>
      <Wallpaper id={wallpaper} />
      <Home hidden={homeHidden} />
      {mounted.map((id) => {
        const App = APPS[id];
        const isShown = shown === id;
        return (
          <div
            key={id}
            className={`n7-applayer ${isShown && phase === 'in' ? 'n7-app-in' : ''} ${isShown && phase === 'out' ? 'n7-app-out' : ''}`}
            style={{ display: isShown ? 'block' : 'none', transformOrigin: `${origin.x}px ${origin.y}px` }}
          >
            <App active={isShown && app === id} />
          </div>
        );
      })}
      <StatusBar theme={video ? 'light' : locked ? 'light' : shown && phase !== 'out' ? theme : 'light'} hidden={(statusHidden && !!shown && !locked) || video} />
      <MediaLayer visible={showArt || video} style={mediaStyle} fit={video ? 'contain' : 'cover'} />
      <div className="n7-art-overlay" ref={setArtEl} style={ART_RECT} />
      {video && <VideoPlayer />}
      {locked && <LockScreen wallpaper={wallpaper} />}
      <AlarmScreen />
      <ActionSheet />
      <VolumeHud />
      <Toast />
      <div className="n7-brightness" style={{ opacity: Math.max(0, 0.85 - brightness) * 0.62 }} />
      <div className={`n7-off ${asleep ? 'on' : ''}`} />
    </div>
    </ArtOverlayCtx.Provider>
  );
}

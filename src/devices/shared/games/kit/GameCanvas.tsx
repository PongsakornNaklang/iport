import { useEffect, useRef } from 'react';
import type { WheelEvent } from '../../clickwheel/bus';
import type { GameProps } from '../types';
import { drawPauseMenu } from './draw';
import { uiPalette } from './palette';
import { sfx } from './sfx';

/** What a game gets from the shell. */
export interface GameEnv {
  w: number;
  h: number;
  color: boolean;
  /** leave the game (back to the iPod menu) */
  exit(): void;
  /** open the pause screen (no-op unless the game is pausable) */
  pause(): void;
}

export interface PauseItem {
  label: string;
  action: () => void;
}

/** A game body driven by <GameCanvas>. */
export interface GameImpl {
  /** advance the simulation (not called while the pause screen is up) */
  update(dt: number): void;
  /** draw a full frame in CSS pixels (the canvas is already DPR-scaled) */
  draw(g: CanvasRenderingContext2D): void;
  /** wheel input; MENU clicks go to the pause screen while pausable() */
  input(e: WheelEvent): void;
  /** true while a round is being played — MENU then pauses instead of reaching input() */
  pausable(): boolean;
  /** extra pause-menu entries shown between Resume and Quit */
  pauseItems?(): PauseItem[];
  /** short control hints shown on the pause screen */
  help?: string[];
  onPause?(): void;
  onResume?(): void;
  dispose?(): void;
}

export type GameFactory = (env: GameEnv) => GameImpl;

/**
 * Hosts a canvas game: crisp at any devicePixelRatio, 60 fps via
 * requestAnimationFrame, consumes every wheel event while mounted and owns
 * the shared pause screen (Resume / Quit; MENU again also quits).
 */
export function GameCanvas({ bus, width, height, onExit, color, create }: GameProps & { create: GameFactory }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const exitRef = useRef(onExit);
  useEffect(() => {
    exitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;

    let dpr = 0;
    const fit = () => {
      // Never below 2× so the screen stays sharp when the 3D stage zooms the device in.
      const d = Math.min(4, Math.max(2, window.devicePixelRatio || 1));
      if (d === dpr) return;
      dpr = d;
      canvas.width = Math.round(width * d);
      canvas.height = Math.round(height * d);
    };

    const ui = uiPalette(color);
    let paused = false;
    let exited = false;
    let sel = 0;
    let items: PauseItem[] = [];

    const exit = () => {
      if (exited) return;
      exited = true;
      exitRef.current();
    };
    const resume = () => {
      if (!paused) return;
      paused = false;
      sfx.resume();
      game.onResume?.();
    };
    const pause = () => {
      if (paused || exited || !game.pausable()) return;
      paused = true;
      sel = 0;
      items = [{ label: 'Resume', action: resume }, ...(game.pauseItems?.() ?? []), { label: 'Quit', action: exit }];
      sfx.pause();
      game.onPause?.();
    };
    const choose = () => {
      const it = items[sel];
      if (!it) return;
      if (it.action === resume || it.action === exit) {
        it.action();
        return;
      }
      paused = false;
      sfx.select();
      it.action();
    };

    const env: GameEnv = { w: width, h: height, color, exit, pause };
    const game = create(env);
    (window as unknown as Record<string, unknown>).__game = game; // TEMP-HARNESS

    const off = bus.on((e: WheelEvent) => {
      if (exited) return true;
      if (paused) {
        if (e.type === 'up') game.input(e); // so held buttons don't stick after resuming
        else if (e.type === 'scroll') sel = Math.max(0, Math.min(items.length - 1, sel + Math.sign(e.steps)));
        else if (e.type === 'click') {
          if (e.button === 'menu') exit();
          else if (e.button === 'play') resume();
          else if (e.button === 'select') choose();
          else if (e.button === 'prev') sel = Math.max(0, sel - 1);
          else if (e.button === 'next') sel = Math.min(items.length - 1, sel + 1);
        }
        return true;
      }
      if (e.type === 'click' && e.button === 'menu' && game.pausable()) {
        pause();
        return true;
      }
      game.input(e);
      return true;
    });

    const onVis = () => {
      if (document.hidden) pause();
    };
    document.addEventListener('visibilitychange', onVis);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      fit();
      if (!paused) game.update(dt);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalAlpha = 1;
      game.draw(g);
      if (paused) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawPauseMenu(
          g,
          width,
          height,
          ui,
          items.map((i) => i.label),
          sel,
          game.help,
        );
      }
    };
    fit();
    raf = requestAnimationFrame(frame);

    return () => {
      exited = true;
      cancelAnimationFrame(raf);
      off();
      document.removeEventListener('visibilitychange', onVis);
      game.dispose?.();
    };
  }, [bus, width, height, color, create]);

  return <canvas ref={ref} style={{ width, height, display: 'block', touchAction: 'none' }} aria-label="Game" />;
}

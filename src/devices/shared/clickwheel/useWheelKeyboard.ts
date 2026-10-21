import { useEffect } from 'react';
import { playClick } from '../../../core/sound/click';
import { isTypingTarget } from '../../../shell/keyboard';
import type { WheelBus, WheelButton } from './bus';

const KEYMAP: Record<string, WheelButton> = {
  Enter: 'select',
  Escape: 'menu',
  Backspace: 'menu',
  m: 'menu',
  M: 'menu',
  ' ': 'play',
  ArrowLeft: 'prev',
  ArrowRight: 'next',
};

/**
 * Keyboard → Click Wheel:
 *   ↑/↓ (or K/J) scroll · ←/→ prev/next · Enter select · Esc/Backspace/M menu · Space play/pause
 */
export function useWheelKeyboard(bus: WheelBus, enabled = true, clicker = true): void {
  useEffect(() => {
    if (!enabled) return;
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey) return;
      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        if (clicker) playClick();
        bus.scroll(-1, e.repeat ? 12 : 0);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        if (clicker) playClick();
        bus.scroll(1, e.repeat ? 12 : 0);
        return;
      }
      const b = KEYMAP[e.key];
      if (!b) return;
      e.preventDefault();
      if (e.repeat) return;
      if (clicker) playClick(0.25);
      bus.down(b);
    };
    const up = (e: KeyboardEvent) => {
      const b = KEYMAP[e.key];
      if (!b) return;
      bus.up(b);
    };
    const blur = () => bus.releaseAll();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [bus, enabled, clicker]);
}

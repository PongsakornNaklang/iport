import { beforeEach, describe, expect, it, vi } from 'vitest';
import { holdHistory, redo, undo, useHistory } from './history';
import { useCustomize } from './store';

const color = () => {
  const s = useCustomize.getState();
  return s.appearances[s.modelId].colors.back;
};

describe('undo / redo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useCustomize.getState().setModel('touch7');
    useHistory.setState({ past: [], future: [], canUndo: false, canRedo: false });
  });

  it('steps back and forward through changes', () => {
    const start = color();
    useCustomize.getState().setColor('back', '#111111');
    vi.advanceTimersByTime(1000);
    useCustomize.getState().setColor('back', '#222222');
    expect(useHistory.getState().canUndo).toBe(true);
    undo();
    expect(color()).toBe('#111111');
    undo();
    expect(color()).toBe(start);
    redo();
    expect(color()).toBe('#111111');
    // a new change drops what could be redone
    useCustomize.getState().setColor('back', '#333333');
    expect(useHistory.getState().canRedo).toBe(false);
  });

  it('makes one step of a gesture, and starts a new one with the next', () => {
    useCustomize.getState().setColor('back', '#aaaaaa');
    vi.advanceTimersByTime(1000);
    holdHistory(true);
    for (const c of ['#000001', '#000002', '#000003']) {
      useCustomize.getState().setColor('back', c);
      vi.advanceTimersByTime(2000);
    }
    holdHistory(false);
    undo();
    expect(color()).toBe('#aaaaaa');
  });
});

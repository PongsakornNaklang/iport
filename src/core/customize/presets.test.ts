import { describe, expect, it } from 'vitest';
import { decodePreset, encodePreset } from './store';

describe('preset share links', () => {
  it('round-trips, including non-ASCII engraving', () => {
    const p = {
      name: 'ไอพอดของฉัน',
      modelId: 'classic',
      appearance: { colors: { front: '#111111' }, options: { theme: 'red' }, engraving: ['สวัสดี', 'Hello'] as [string, string], finishId: 'u2' },
    };
    const s = encodePreset(p);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    const back = decodePreset(s)!;
    expect(back.name).toBe(p.name);
    expect(back.appearance.engraving).toEqual(['สวัสดี', 'Hello']);
    expect(back.modelId).toBe('classic');
  });
  it('rejects garbage', () => {
    expect(decodePreset('not-a-preset')).toBeNull();
  });
});

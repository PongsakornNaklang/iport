import { describe, expect, it } from 'vitest';
import { activeLine, parseLrc } from './lyrics';

describe('lyrics', () => {
  const lrc = '[ar:Someone]\n[00:12.50] First line\n[00:15.00]Second line\n[01:02.3][01:30.25] Chorus\n';
  it('parses LRC including repeated timestamps', () => {
    const lines = parseLrc(lrc);
    expect(lines.map((l) => l.text)).toEqual(['First line', 'Second line', 'Chorus', 'Chorus']);
    expect(lines[0].time).toBeCloseTo(12.5);
    expect(lines[2].time).toBeCloseTo(62.3);
    expect(lines[3].time).toBeCloseTo(90.25);
  });
  it('finds the active line', () => {
    const lines = parseLrc(lrc);
    expect(activeLine(lines, 0)).toBe(-1);
    expect(activeLine(lines, 13)).toBe(0);
    expect(activeLine(lines, 70)).toBe(2);
    expect(activeLine(lines, 999)).toBe(3);
  });
});

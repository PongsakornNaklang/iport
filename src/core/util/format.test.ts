import { describe, expect, it } from 'vitest';
import { compareTitles, formatBytes, formatClock, formatTime, indexLetter } from './format';

describe('format', () => {
  it('formats times', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(75)).toBe('1:15');
    expect(formatTime(3725)).toBe('1:02:05');
    expect(formatTime(NaN)).toBe('--:--');
  });
  it('sorts titles like iTunes', () => {
    const list = ['the Zebra', 'apple', '10 Things', 'A Banana'].sort(compareTitles);
    expect(list).toEqual(['apple', 'A Banana', 'the Zebra', '10 Things']);
  });
  it('index letters', () => {
    expect(indexLetter('The Beatles')).toBe('B');
    expect(indexLetter('2Pac')).toBe('#');
  });
  it('clock', () => {
    const d = new Date(2020, 0, 1, 13, 5);
    expect(formatClock(d, true)).toBe('13:05');
    expect(formatClock(d, false)).toBe('1:05 PM');
  });
  it('bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
});

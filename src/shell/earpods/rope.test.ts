import { describe, expect, it } from 'vitest';
import { Rope } from './rope';

describe('rope', () => {
  it('hangs between two pinned ends and keeps its length', () => {
    const r = new Rope(20, 0, 0, 10, 1, 0);
    r.pts[0].pinned = true;
    r.pts[19].pinned = true;
    r.place(19, 150, 0); // ends closer than the rope length → it sags
    // start slightly bowed, like a real cable (a perfectly straight compressed line can't buckle)
    for (let i = 1; i < 19; i++) r.place(i, (150 / 19) * i, i * (19 - i) * 0.05);
    for (let i = 0; i < 400; i++) r.step(1 / 120);
    const mid = r.pts[10];
    expect(mid.y).toBeGreaterThan(20); // sags under gravity
    for (let i = 0; i < 19; i++) expect(r.stretch(i)).toBeLessThan(1.08);
    // settles: almost no velocity left
    expect(Math.abs(mid.y - mid.py)).toBeLessThan(0.5);
  });

  it('keeps momentum from code-driven moves', () => {
    const r = new Rope(5, 0, 0, 10);
    r.pts[0].pinned = true;
    r.moveTo(4, 30, 40);
    r.moveTo(4, 40, 40);
    expect(r.pts[4].x - r.pts[4].px).toBeCloseTo(10);
  });

  it('finds the nearest segment', () => {
    const r = new Rope(3, 0, 0, 10, 1, 0);
    const n = r.nearest(12, 3);
    expect(n.dist).toBeCloseTo(3);
    expect(n.index).toBe(1);
  });

  it('rests on the floor', () => {
    const r = new Rope(10, 0, 0, 10, 1, 0);
    r.pts[0].pinned = true;
    for (let i = 0; i < 600; i++) r.step(1 / 120, { gravity: 2400, damping: 0.985, iterations: 20, bend: 0.1, floor: 50, floorFrom: 1 });
    for (let i = 1; i < 10; i++) expect(r.pts[i].y).toBeLessThanOrEqual(50.001);
    expect(r.pts[9].y).toBeCloseTo(50, 0);
  });
});

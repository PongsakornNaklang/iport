/**
 * Background services that run while the nano is on the stage:
 * the Clock timer, and the pedometer (real DeviceMotion when the browser
 * provides it, otherwise a believable simulation of a day's walking).
 */
import { useEffect } from 'react';
import { player } from '../../core/player/player';
import { startAlarmSound } from '../../core/sound/click';
import { dayKey, useClockState, useNano, useNanoData, useWorkout } from './state';

let realMotion = false;
let motionListening = false;

/** Start listening to the accelerometer (asks for permission on iOS). */
export async function enableMotion(): Promise<boolean> {
  if (motionListening || typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return realMotion;
  const DME = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
  try {
    if (DME.requestPermission) {
      const r = await DME.requestPermission();
      if (r !== 'granted') return false;
    }
  } catch {
    return false;
  }
  motionListening = true;
  let above = false;
  let lastStep = 0;
  let avg = 9.8;
  window.addEventListener('devicemotion', (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    realMotion = true;
    const m = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    avg = avg * 0.95 + m * 0.05;
    const now = performance.now();
    if (!above && m > avg + 1.6 && now - lastStep > 280) {
      above = true;
      lastStep = now;
      countStep(1);
    } else if (above && m < avg) above = false;
  });
  return true;
}

function countStep(n: number) {
  const d = useNanoData.getState();
  const run = useWorkout.getState().run;
  if (run && run.segStart && run.countdown <= 0) {
    useWorkout.setState({ run: { ...run, steps: run.steps + n } });
  } else if (!d.pedometer) return;
  d.addSteps(n);
}

// simulated walking bouts
const sim = { walking: false, until: 0 };

function simulateTick() {
  const d = useNanoData.getState();
  const run = useWorkout.getState().run;
  const now = Date.now();
  const today = dayKey(new Date());

  // A fresh day with the pedometer on: start from a believable baseline.
  if (d.pedometer && d.steps[today] === undefined) {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    const base = Math.max(0, Math.round((h - 7) * 380 * (0.8 + Math.random() * 0.4)));
    useNanoData.setState({ steps: { ...d.steps, [today]: base } });
    return;
  }
  if (realMotion) return;

  if (run && run.segStart && run.countdown <= 0) {
    const rate = run.kind === 'run' ? 2.6 + Math.random() * 0.4 : 1.7 + Math.random() * 0.3;
    countStep(rate);
    return;
  }
  if (!d.pedometer) return;
  if (now > sim.until) {
    sim.walking = !sim.walking && Math.random() < 0.6;
    sim.until = now + (sim.walking ? 20_000 + Math.random() * 70_000 : 25_000 + Math.random() * 120_000);
  }
  if (sim.walking) countStep(1.5 + Math.random() * 0.6);
}

export function useServices() {
  useEffect(() => {
    void enableMotion();
    const fast = window.setInterval(() => {
      const c = useClockState.getState();
      if (c.timerEnd && Date.now() >= c.timerEnd) {
        useClockState.setState({ timerEnd: null, timerPaused: null });
        if (useNanoData.getState().timerAction === 'sleep') {
          player.pause();
          useNano.setState({ asleep: true });
        } else {
          useClockState.setState({ timerRinging: true });
          if (useNano.getState().asleep) useNano.setState({ asleep: false });
          startAlarmSound();
        }
      }
      // workout countdown 3-2-1
      const run = useWorkout.getState().run;
      if (run && run.countdown > 0) {
        const left = 3 - Math.floor((Date.now() - run.start) / 1000);
        if (left <= 0) useWorkout.setState({ run: { ...run, countdown: 0, segStart: Date.now(), start: Date.now() } });
        else if (left !== run.countdown) useWorkout.setState({ run: { ...run, countdown: left } });
      }
    }, 200);
    const slow = window.setInterval(simulateTick, 1000);
    return () => {
      window.clearInterval(fast);
      window.clearInterval(slow);
    };
  }, []);
}

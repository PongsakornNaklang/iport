/**
 * Alarm clock scheduler shared by every model. Devices read `useAlarmState`
 * to show their own "Alarm" screen with Snooze / Dismiss.
 */
import { create } from 'zustand';
import { useLibrary } from './library/store';
import { playlistTracks } from './library/selectors';
import { player } from './player/player';
import { startAlarmSound, stopAlarmSound } from './sound/click';
import type { Alarm } from './types';

interface AlarmState {
  ringing: Alarm | null;
  snoozeUntil: number | null;
  snoozed: Alarm | null;
}

export const useAlarmState = create<AlarmState>(() => ({ ringing: null, snoozeUntil: null, snoozed: null }));

let lastFiredKey = '';

function ring(a: Alarm) {
  useAlarmState.setState({ ringing: a, snoozeUntil: null, snoozed: null });
  const lib = useLibrary.getState();
  const pl = a.playlistId ? lib.playlists[a.playlistId] : undefined;
  const ids = pl ? playlistTracks(lib.tracks, pl) : [];
  if (ids.length) player.playTracks(ids, 0);
  else startAlarmSound();
}

export function dismissAlarm(): void {
  const a = useAlarmState.getState().ringing;
  stopAlarmSound();
  useAlarmState.setState({ ringing: null, snoozeUntil: null, snoozed: null });
  if (a && a.repeat.length === 0) useLibrary.getState().upsertAlarm({ id: a.id, enabled: false });
}

export function snoozeAlarm(minutes = 9): void {
  const a = useAlarmState.getState().ringing;
  stopAlarmSound();
  if (a?.playlistId) player.pause();
  useAlarmState.setState({ ringing: null, snoozed: a, snoozeUntil: Date.now() + minutes * 60_000 });
}

function check() {
  const now = new Date();
  const { snoozeUntil, snoozed, ringing } = useAlarmState.getState();
  if (ringing) return;
  if (snoozeUntil && snoozed && Date.now() >= snoozeUntil) {
    ring(snoozed);
    return;
  }
  const minutes = now.getHours() * 60 + now.getMinutes();
  const key = `${now.toDateString()} ${minutes}`;
  if (key === lastFiredKey) return;
  for (const a of useLibrary.getState().alarms) {
    if (!a.enabled || a.time !== minutes) continue;
    if (a.repeat.length && !a.repeat.includes(now.getDay())) continue;
    lastFiredKey = key;
    ring(a);
    break;
  }
}

if (typeof window !== 'undefined') window.setInterval(check, 5000);

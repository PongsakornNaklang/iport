import { useEffect } from 'react';
import { player } from '../../../core/player/player';
import { startAlarmSound, stopAlarmSound } from '../../../core/sound/click';
import { os, usePrefs, useOS } from '../os/store';

/** Fires the Clock timer even when the Clock app is closed. */
export function TimerWatcher() {
  useEffect(() => {
    const t = window.setInterval(() => {
      const timer = usePrefs.getState().timer;
      if (!timer.endAt || Date.now() < timer.endAt) return;
      usePrefs.getState().set('timer', { ...timer, endAt: null, remaining: 0 });
      if (timer.sound === 'Stop Playing') {
        player.pause();
        return;
      }
      startAlarmSound();
      const stopAt = window.setTimeout(stopAlarmSound, 30_000);
      if (!useOS.getState().screenOn) useOS.setState({ screenOn: true });
      os.notify('clock', 'Timer', 'Timer Done');
      os.alert({
        title: 'Timer',
        message: 'Timer Done',
        actions: [
          {
            label: 'Repeat',
            onPress: () => {
              window.clearTimeout(stopAt);
              stopAlarmSound();
              const cur = usePrefs.getState().timer;
              usePrefs.getState().set('timer', { ...cur, endAt: Date.now() + cur.duration * 1000, remaining: cur.duration });
            },
          },
          {
            label: 'Stop',
            style: 'cancel',
            onPress: () => {
              window.clearTimeout(stopAt);
              stopAlarmSound();
            },
          },
        ],
      });
    }, 500);
    return () => window.clearInterval(t);
  }, []);
  return null;
}

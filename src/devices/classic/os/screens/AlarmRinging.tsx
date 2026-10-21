import { useState } from 'react';
import { dismissAlarm, snoozeAlarm } from '../../../../core/alarms';
import { useSettings } from '../../../../core/settings/store';
import type { Alarm } from '../../../../core/types';
import { clamp, useInput } from '../core';
import { minutesLabel } from './Clock';

/** Full-screen alarm with Dismiss / Snooze. */
export function AlarmRinging({ alarm }: { alarm: Alarm }) {
  const use24h = useSettings((s) => s.use24h);
  const [sel, setSel] = useState(0);
  const options = ['Dismiss', 'Snooze'];
  useInput((e) => {
    if (e.type === 'scroll') {
      setSel((s) => clamp(s + e.steps, 0, 1));
      return true;
    }
    if (e.type === 'click' && e.button === 'select') {
      if (sel === 0) dismissAlarm();
      else snoozeAlarm();
      return true;
    }
    if (e.type === 'click' && e.button === 'menu') {
      snoozeAlarm();
      return true;
    }
    return true;
  });
  return (
    <div className="cl-alarm">
      <div className="cl-alarm-head">
        <svg width="54" height="54" viewBox="0 0 64 64" className="cl-alarm-bell" aria-hidden>
          <circle cx="32" cy="36" r="22" fill="#fff" stroke="#333" strokeWidth="4" />
          <path d="M32 22v14l9 6" fill="none" stroke="#333" strokeWidth="4" strokeLinecap="round" />
          <circle cx="13" cy="13" r="8" fill="#333" />
          <circle cx="51" cy="13" r="8" fill="#333" />
        </svg>
        <div>
          <div className="cl-alarm-time">{minutesLabel(alarm.time, use24h)}</div>
          <div className="cl-alarm-label">{alarm.label}</div>
        </div>
      </div>
      <div className="cl-alarm-opts">
        {options.map((o, i) => (
          <div key={o} className={`cl-alarm-opt ${i === sel ? 'cl-sel' : ''}`}>
            {o}
          </div>
        ))}
      </div>
    </div>
  );
}

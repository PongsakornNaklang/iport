import { useEffect, useState } from 'react';
import { dismissAlarm, snoozeAlarm, useAlarmState } from '../../../core/alarms';
import { useSettings } from '../../../core/settings/store';
import { formatClock } from '../../../core/util/format';
import { useNow } from '../../../core/util/hooks';
import { nano, useClockState, useNano } from '../state';
import { stopAlarmSound } from '../../../core/sound/click';
import { Glyph } from './icons';
import { t } from './i18n';

export function VolumeHud() {
  const hud = useNano((s) => s.hud);
  const volume = useSettings((s) => s.volume);
  const limit = useSettings((s) => s.volumeLimit);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!hud) return;
    setShow(true);
    const tm = window.setTimeout(() => setShow(false), 1300);
    return () => window.clearTimeout(tm);
  }, [hud]);
  const v = Math.min(volume, limit);
  const lit = Math.round(v * 16);
  return (
    <div className={`n7-hud ${show ? 'on' : ''}`}>
      <div className="n7-hud-icon">{v === 0 ? <Glyph.volLow size={34} color="#3a3a3c" /> : <Glyph.volHigh size={34} color="#3a3a3c" />}</div>
      <div className="n7-hud-bar">
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className={i < lit ? 'on' : ''} />
        ))}
      </div>
      {limit < 1 && volume > limit && <div className="n7-hud-limit">Volume Limit</div>}
    </div>
  );
}

export function ActionSheet() {
  const sheet = useNano((s) => s.sheet);
  const [shown, setShown] = useState(sheet);
  useEffect(() => {
    if (sheet) setShown(sheet);
    else {
      const tm = window.setTimeout(() => setShown(null), 260);
      return () => window.clearTimeout(tm);
    }
  }, [sheet]);
  if (!shown) return null;
  return (
    <div className={`n7-sheet-wrap ${sheet ? 'on' : ''}`} onClick={() => nano.closeSheet()} data-noswipe>
      <div className="n7-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="n7-sheet-group">
          {shown.title && <div className="n7-sheet-title">{shown.title}</div>}
          {shown.actions.map((a, i) => (
            <button
              key={i}
              className={a.destructive ? 'destructive' : ''}
              onClick={() => {
                nano.closeSheet();
                a.onSelect();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="n7-sheet-group">
          <button className="cancel" onClick={() => nano.closeSheet()}>
            {t('Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AlarmScreen() {
  const ringing = useAlarmState((s) => s.ringing);
  const timer = useClockState((s) => s.timerRinging);
  const now = useNow(1000);
  const use24h = useSettings((s) => s.use24h);
  if (!ringing && !timer) return null;
  const stopTimer = () => {
    stopAlarmSound();
    useClockState.setState({ timerRinging: false });
  };
  return (
    <div className="n7-alarm" data-noswipe>
      <div className="n7-alarm-glow" />
      <div className="n7-alarm-kind">{ringing ? t('Alarm') : t('Timer')}</div>
      <div className="n7-alarm-time">{formatClock(now, use24h).replace(/\s?[AP]M$/, '')}</div>
      <div className="n7-alarm-label">{ringing ? ringing.label || t('Alarm') : 'Timer Done'}</div>
      {ringing && (
        <button className="n7-alarm-snooze" onClick={() => snoozeAlarm()}>
          {t('Snooze')}
        </button>
      )}
      <button className="n7-alarm-stop" onClick={() => (ringing ? dismissAlarm() : stopTimer())}>
        {ringing ? t('Stop') : 'OK'}
      </button>
    </div>
  );
}

export function Toast() {
  const toast = useNano((s) => s.toast);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setShow(true);
    const tm = window.setTimeout(() => setShow(false), 1600);
    return () => window.clearTimeout(tm);
  }, [toast]);
  return <div className={`n7-toast ${show ? 'on' : ''}`}>{toast?.text}</div>;
}

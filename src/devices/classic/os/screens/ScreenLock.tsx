import { useMemo, useState } from 'react';
import { useSettings } from '../../../../core/settings/store';
import { useInput, useOS } from '../core';
import { BigLock } from '../glyphs';
import { ListView, type Row } from '../ListView';
import { t } from '../i18n';

/** Four number wheels set with the Click Wheel (center confirms each digit). */
export function CombinationDial({ prompt, onComplete, error, shake = 0 }: { prompt: string; onComplete: (code: string) => void; error?: string | null; shake?: number }) {
  const [digits, setDigits] = useState([0, 0, 0, 0]);
  const [i, setI] = useState(0);
  useInput((e) => {
    if (e.type === 'scroll') {
      setDigits((d) => d.map((x, k) => (k === i ? (((x + e.steps) % 10) + 10) % 10 : x)));
      return true;
    }
    if (e.type === 'click' && (e.button === 'select' || e.button === 'next')) {
      if (i < 3) setI(i + 1);
      else {
        onComplete(digits.join(''));
        setI(0);
        setDigits([0, 0, 0, 0]);
      }
      return true;
    }
    if (e.type === 'click' && e.button === 'prev') {
      setI((x) => Math.max(0, x - 1));
      return true;
    }
    return false;
  });
  return (
    <div className="cl-dial">
      <BigLock size={44} />
      <div className="cl-dial-prompt">{prompt}</div>
      <div className={`cl-dial-boxes ${shake ? 'cl-shake' : ''}`} key={shake}>
        {digits.map((d, k) => (
          <div key={k} className={`cl-dial-box ${k === i ? 'on' : ''} ${k < i ? 'done' : ''}`}>
            {k === i && <span className="cl-dial-arrow up" />}
            {d}
            {k === i && <span className="cl-dial-arrow down" />}
          </div>
        ))}
      </div>
      {error && <div className="cl-dial-error">{error}</div>}
    </div>
  );
}

export function ScreenLockMenu() {
  const os = useOS();
  const code = useSettings((s) => s.lockCode);
  const rows = useMemo<Row[]>(() => {
    const set: Row = {
      key: 'set',
      label: t(code ? 'Change Combination' : 'Set Combination'),
      chevron: true,
      onSelect: () =>
        os.nav.push({
          title: t('Screen Lock'),
          el: (
            <CombinationDial
              prompt={t('Enter new combination')}
              onComplete={(c) => {
                useSettings.getState().set('lockCode', c);
                os.nav.pop();
                os.hud('Combination Set');
              }}
            />
          ),
        }),
    };
    if (!code) return [set];
    return [
      { key: 'lock', label: t('Lock'), onSelect: () => os.lockScreen() },
      set,
      {
        key: 'off',
        label: t('Turn Off'),
        onSelect: () =>
          os.menu({
            title: t('Remove the combination?'),
            options: [{ label: t('Turn Off'), action: () => useSettings.getState().set('lockCode', '') }, { label: t('Cancel') }],
          }),
      },
    ];
  }, [code, os]);
  return <ListView rows={rows} />;
}

/** Full-screen lock: any button shows the combination dial. */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const code = useSettings((s) => s.lockCode);
  const [entering, setEntering] = useState(false);
  const [fails, setFails] = useState(0);
  useInput((e) => {
    if (entering) {
      if (e.type === 'click' && e.button === 'menu') {
        setEntering(false);
        return true;
      }
      return false;
    }
    if (e.type === 'click' && e.button === 'play') return false; // music keeps working
    if (e.type === 'click' && (e.button === 'select' || e.button === 'menu')) setEntering(true);
    return true;
  });
  // the dial registers after this handler, so it gets events first while entering
  return (
    <div className="cl-lock">
      {entering ? (
        <CombinationDial
          prompt={t('Enter combination')}
          error={fails ? t('Wrong combination') : null}
          shake={fails}
          onComplete={(c) => {
            if (!code || c === code) onUnlock();
            else setFails((f) => f + 1);
          }}
        />
      ) : (
        <div className="cl-lock-idle">
          <BigLock size={70} />
          <div>{t('Press center to unlock')}</div>
        </div>
      )}
    </div>
  );
}

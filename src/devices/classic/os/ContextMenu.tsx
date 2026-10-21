import { useState } from 'react';
import { clamp, useInput, type ContextMenuSpec } from './core';
import { Marquee } from './ListView';

/** The pop-up menu shown when the center button is held on a song. */
export function ContextMenu({ spec, onClose }: { spec: ContextMenuSpec; onClose: () => void }) {
  const [sel, setSel] = useState(0);
  useInput((e) => {
    if (e.type === 'scroll') {
      setSel((s) => clamp(s + e.steps, 0, spec.options.length - 1));
      return true;
    }
    if (e.type === 'click' && e.button === 'select') {
      const o = spec.options[sel];
      onClose();
      o?.action?.();
      return true;
    }
    if (e.type === 'click' && e.button === 'menu') {
      onClose();
      return true;
    }
    // play / skip keep working underneath
    if (e.type === 'click' && (e.button === 'play' || e.button === 'next' || e.button === 'prev')) return false;
    if ((e.type === 'hold' || e.type === 'repeat') && (e.button === 'next' || e.button === 'prev')) return false;
    return true;
  });
  return (
    <div className="cl-ctx-backdrop">
      <div className="cl-ctx">
        {spec.title && (
          <div className="cl-ctx-title">
            <Marquee text={spec.title} run />
          </div>
        )}
        {spec.options.map((o, i) => (
          <div key={o.label} className={`cl-ctx-row ${i === sel ? 'cl-sel' : ''}`}>
            {o.label}
          </div>
        ))}
      </div>
    </div>
  );
}

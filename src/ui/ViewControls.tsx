import { useEffect, useState } from 'react';
import { useStage } from '../shell/stageStore';
import { IconBack, IconFront, IconMinus, IconPlus, IconRotate, IconSide } from './icons';

/** How close to the right edge (px) the pointer brings the controls out. */
const NEAR = 96;

/**
 * With a mouse, on wider screens, the controls wait off the right edge and
 * slide in when the pointer comes near it (see app.css).
 */
function usePeek() {
  const [peek, setPeek] = useState(false);
  useEffect(() => {
    let hideTimer = 0;
    const show = (on: boolean) => {
      window.clearTimeout(hideTimer);
      if (on) setPeek(true);
      else hideTimer = window.setTimeout(() => setPeek(false), 600);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') show(e.clientX >= window.innerWidth - NEAR);
    };
    const onLeave = (e: MouseEvent) => {
      if (!e.relatedTarget) show(false);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('mouseout', onLeave);
    return () => {
      window.clearTimeout(hideTimer);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseout', onLeave);
    };
  }, []);
  return peek;
}

export function ViewControls() {
  const spinning = useStage((s) => s.spinning);
  const zoom = useStage((s) => s.zoom);
  const st = useStage.getState;
  const peek = usePeek();
  return (
    <>
      <span className={`vc-grip ${peek ? 'peek' : ''}`} aria-hidden="true" />
      <div className={`view-controls autohide ${peek ? 'peek' : ''}`} data-no-stage="">
        <button onClick={() => st().front()} title="Front view (F)">
          <IconFront />
          <span className="lbl">Front</span>
        </button>
        <button onClick={() => st().back()} title="Back view (B)">
          <IconBack />
          <span className="lbl">Back</span>
        </button>
        <button onClick={() => st().side()} title="Side view">
          <IconSide />
          <span className="lbl">Side</span>
        </button>
        <button className={spinning ? 'on' : ''} onClick={() => st().toggleSpin()} title="Spin 360°">
          <IconRotate />
          <span className="lbl">360°</span>
        </button>
        <span className="sep" />
        {/* − % + in a row; stacked vertically it reads + % − (see app.css) */}
        <div className="vc-zoom">
          <button onClick={() => st().setZoom(zoom / 1.15)} title="Zoom out">
            <IconMinus />
          </button>
          <button className="vc-zoom-val" onClick={() => st().setZoom(1)} title="Reset zoom">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => st().setZoom(zoom * 1.15)} title="Zoom in">
            <IconPlus />
          </button>
        </div>
      </div>
    </>
  );
}

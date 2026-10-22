import { useEffect, useState } from 'react';
import { useStage } from '../shell/stageStore';
import { useCustomize } from '../core/customize/store';
import { getModel } from '../devices/registry';
import { IconBack, IconCamera, IconFront, IconMinus, IconPlus, IconRotate, IconSide, IconView } from './icons';
import { toast } from './toast';

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

/** Phones: a narrow screen with fingers rather than a mouse. */
const PHONE = '(max-width: 720px)';
function usePhone() {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(PHONE).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(PHONE);
    if (!mq) return;
    const update = () => setOn(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return on;
}

export function ViewControls() {
  return usePhone() ? <ViewMenu /> : <ViewBar />;
}

/**
 * On a phone the view controls fold into one round button in the corner,
 * which opens a short stack above it. Zoom is two fingers on the stage, and
 * a double tap faces the iPod front at 100% (Stage.tsx).
 */
function ViewMenu() {
  const spinning = useStage((s) => s.spinning);
  const [open, setOpen] = useState(false);
  const st = useStage.getState;
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.('.view-menu')) setOpen(false);
    };
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [open]);
  const act = (f: () => void) => () => {
    f();
    setOpen(false);
  };
  return (
    <div className={`view-menu ${open ? 'open' : ''}`} data-no-stage="">
      <div className="vm-items" aria-hidden={!open}>
        <SaveImageButton onDone={() => setOpen(false)} tabIndex={open ? 0 : -1} />
        <button className={spinning ? 'on' : ''} onClick={act(() => st().toggleSpin())} title="Spin 360°" tabIndex={open ? 0 : -1}>
          <IconRotate />
        </button>
        <button onClick={act(() => st().side())} title="Side view" tabIndex={open ? 0 : -1}>
          <IconSide />
        </button>
        <button onClick={act(() => st().back())} title="Back view" tabIndex={open ? 0 : -1}>
          <IconBack />
        </button>
        <button onClick={act(() => st().front())} title="Front view" tabIndex={open ? 0 : -1}>
          <IconFront />
        </button>
      </div>
      <button className={`vm-toggle glass ${spinning ? 'spinning' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label="View">
        <IconView />
      </button>
    </div>
  );
}

function ViewBar() {
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
        <SaveImageButton />
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

/** Download the iPod as a PNG, as decorated, on a transparent background. */
function SaveImageButton({ onDone, tabIndex }: { onDone?: () => void; tabIndex?: number }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={busy ? 'on' : ''}
      disabled={busy}
      title="Save image"
      tabIndex={tabIndex}
      onClick={async () => {
        onDone?.();
        setBusy(true);
        toast('Saving image…');
        try {
          const { saveImage } = await import('../shell/snapshot');
          await saveImage(`iPort ${getModel(useCustomize.getState().modelId).name}`);
          toast('Image saved');
        } catch {
          toast('Couldn’t save the image');
        } finally {
          setBusy(false);
        }
      }}
    >
      <IconCamera />
      <span className="lbl">Save</span>
    </button>
  );
}

import { useStage } from '../shell/stageStore';
import { IconBack, IconFront, IconMinus, IconPlus, IconRotate, IconSide } from './icons';

export function ViewControls() {
  const spinning = useStage((s) => s.spinning);
  const zoom = useStage((s) => s.zoom);
  const st = useStage.getState;
  return (
    <div className="view-controls" data-no-stage="">
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
      <button onClick={() => st().setZoom(zoom / 1.15)} title="Zoom out">
        <IconMinus />
      </button>
      <button onClick={() => st().setZoom(1)} title="Reset zoom" style={{ minWidth: 48, fontVariantNumeric: 'tabular-nums' }}>
        {Math.round(zoom * 100)}%
      </button>
      <button onClick={() => st().setZoom(zoom * 1.15)} title="Zoom in">
        <IconPlus />
      </button>
    </div>
  );
}

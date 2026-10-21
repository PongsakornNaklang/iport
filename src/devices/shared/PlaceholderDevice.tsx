import { Device3D } from '../../shell/Device3D';
import type { DeviceProps } from '../types';

/** Temporary body used while a model is being built. */
export function PlaceholderDevice({ model, appearance }: DeviceProps) {
  const { width, height, depth } = model.size;
  const body = Object.values(appearance.colors)[0] ?? '#ccc';
  return (
    <Device3D
      width={width}
      height={height}
      depth={depth}
      radius={Math.min(width, height) * 0.12}
      edge={(t) => ({ color: `color-mix(in srgb, ${body} ${90 - t * 30}%, #000)` })}
      front={
        <div style={{ position: 'absolute', inset: 0, background: body, display: 'grid', placeItems: 'center', color: '#333', font: '600 18px system-ui' }}>
          {model.name}
        </div>
      }
      back={<div style={{ position: 'absolute', inset: 0, background: body }} />}
    />
  );
}

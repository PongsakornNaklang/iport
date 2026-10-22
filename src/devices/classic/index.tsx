/**
 * iPod classic (160GB, late 2009) — the showpiece.
 *
 * 61.8 × 103.5 × 10.5 mm at 6.3 px/mm: anodized aluminium front, a
 * mirror-polished stainless steel back that curves into the sides, the Hold
 * switch and the headphone jack on top (as in Apple's dimensional drawings
 * of the 80GB and 160GB), the 30-pin dock connector on the bottom.
 */
import type { DeviceProps } from '../types';
import { ClickWheelIpod, type ClickWheelSpec } from './ClickWheelIpod';

const SPEC: ClickWheelSpec = {
  info: (finishId) => ({
    product: 'iPod classic',
    name: 'iPod',
    capacity: '160GB',
    capacityBytes: 160e9,
    version: '2.0.4',
    model: finishId === 'black' || finishId === 'u2' ? 'MC297' : 'MC293',
    serial: '8K9461PSZ2C',
    format: 'Mac',
  }),
  finish: 'aluminium',
  frontT: 0.17,
  // Apple's drawing: jack Ø~4.8 centred 8.1 mm from the right on the top edge
  jack: { side: 'top', x: 144 },
  holdX: -103,
  holdLen: 69,
  modelNo: 'A1238\u00a0\u00a0EMC No.: 2173',
};

export default function IpodClassic(props: DeviceProps) {
  return <ClickWheelIpod {...props} spec={SPEC} />;
}

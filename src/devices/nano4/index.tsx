/**
 * iPod nano (4th generation, 8GB, 2008), the "nano-chromatic".
 *
 * 38.7 × 90.7 × 6.2 mm at 7.87 px/mm: one piece of curved anodized
 * aluminium in nine colours, a tall 2" screen (240 × 320, upright), the
 * Click Wheel, the Hold switch on top, the headphone jack and the dock
 * connector on the bottom. The software has Cover Flow and Genius, in a
 * full-width menu suited to the tall screen.
 */
import type { DeviceProps } from '../types';
import { ClickWheelIpod, type ClickWheelSpec } from '../classic/ClickWheelIpod';

const SPEC: ClickWheelSpec = {
  info: () => ({
    product: 'iPod nano',
    name: 'iPod',
    capacity: '8GB',
    capacityBytes: 8e9,
    version: '1.0.4',
    model: 'MB598',
    serial: '5U8471BX1P2',
    format: 'Mac',
  }),
  finish: 'aluminium',
  frontT: 0,
  body: { kind: 'aluminium', round: 22 },
  jack: { side: 'bottom', x: -96 },
  holdX: 80,
  modelNo: 'A1285',
  wordmark: 'iPod nano',
  caps: { splitMenu: false },
};

export default function IpodNano4(props: DeviceProps) {
  return <ClickWheelIpod {...props} spec={SPEC} />;
}

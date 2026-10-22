/**
 * iPod (5th generation, 30GB, late 2005), "iPod with video".
 *
 * 61.8 × 103.5 × 11 mm at 6.3 px/mm: a glossy polycarbonate front in white
 * or black, the mirror steel back, Hold switch and headphone jack on top,
 * the dock connector alone on the bottom. The same Click Wheel software as
 * the classic, from before Cover Flow and Genius, with the plain full-width
 * main menu.
 */
import type { DeviceProps } from '../types';
import { ClickWheelIpod, type ClickWheelSpec } from '../classic/ClickWheelIpod';

const SPEC: ClickWheelSpec = {
  info: (finishId) => ({
    product: 'iPod',
    name: 'iPod',
    capacity: '30GB',
    capacityBytes: 30e9,
    version: '1.3',
    model: finishId === 'u2' ? 'MA452' : finishId === 'black' ? 'MA146' : 'MA002',
    serial: '4H5371ATTXK',
    format: 'Mac',
  }),
  finish: 'gloss',
  // the plastic front wraps further round the edge than the classic's plate
  frontT: 0.3,
  // Apple's drawing: jack Ø4.8 centred 8.1 mm from the right; Hold slot 10.7 mm long, 8.7–19.4 mm from the left
  jack: { side: 'top', x: 144 },
  holdX: -105,
  holdLen: 67,
  modelNo: 'A1136',
  caps: { coverFlow: false, genius: false, splitMenu: false },
};

export default function IpodVideo(props: DeviceProps) {
  return <ClickWheelIpod {...props} spec={SPEC} />;
}

/**
 * iPod mini (2nd generation, 6GB, 2005).
 *
 * 50.8 × 91 × 13 mm at 8.14 px/mm: a tube of anodized aluminium with
 * rounded sides and plastic end caps, a 1.67" grey-blue monochrome screen
 * (138 × 110, drawn at twice the size), the first Click Wheel with its
 * labels in the body's colour, the headphone jack and the Hold switch on
 * top, the dock connector on the bottom. Music only: no photos or video.
 */
import type { DeviceProps } from '../types';
import { ClickWheelIpod, type ClickWheelSpec } from '../classic/ClickWheelIpod';
import { EARLY_GAMES } from '../classic/os/core';

const SPEC: ClickWheelSpec = {
  info: () => ({
    product: 'iPod mini',
    name: 'iPod',
    capacity: '6GB',
    capacityBytes: 6e9,
    version: '1.4.1',
    model: 'M9806',
    serial: 'JQ5283TPSAZ',
    format: 'Mac',
  }),
  finish: 'aluminium',
  frontT: 0,
  body: { kind: 'aluminium', round: 60 },
  // Apple's drawing: jack Ø3.57 6.92 mm from the right (remote connector beside it); Hold 5.2–17.6 mm from the left
  jack: { side: 'top', x: 153 },
  holdX: -117,
  holdLen: 100,
  modelNo: 'A1051',
  wordmark: 'iPod',
  mono: true,
  endCaps: true,
  // software 1.4.1: music only, Podcasts in the Music menu, Backlight in the main
  // menu, Contrast for the grey LCD, four games; no stopwatch, screen lock or recording
  caps: {
    video: false,
    photos: false,
    coverFlow: false,
    genius: false,
    splitMenu: false,
    search: false,
    voiceMemos: false,
    stopwatch: false,
    screenLock: false,
    backlightItem: true,
    contrast: true,
    gameList: EARLY_GAMES,
  },
  // a dark Apple on the grey LCD
  bootStyle: 'light',
};

export default function IpodMini(props: DeviceProps) {
  return <ClickWheelIpod {...props} spec={SPEC} />;
}

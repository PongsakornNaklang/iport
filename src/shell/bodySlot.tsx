import { createContext, useContext, type ReactNode } from 'react';

/**
 * Things the stage puts inside the device's own 3D root: the case or sock
 * it is wearing, and the EarPods' jack markers. Inside the root they turn
 * with the device when it turns itself (the touch and nano rotate for
 * landscape video). Devices render <BodyExtras /> first, before any of
 * their own parts (see shell/cover for why first).
 */
export const BodySlotContext = createContext<ReactNode>(null);

export function BodyExtras() {
  return <>{useContext(BodySlotContext)}</>;
}

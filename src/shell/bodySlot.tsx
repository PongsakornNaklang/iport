import { createContext, useContext, type ReactNode } from 'react';

/**
 * Things the stage puts inside the device's own 3D root: the case or sock
 * it is wearing, and the EarPods' jack markers. Inside the root they turn
 * with the device when it turns itself (the touch and nano rotate for
 * landscape video).
 *
 * `before` is rendered first, before any of the device's own parts, and
 * `after` last (see shell/cover for which goes where, and why).
 */
export const BodySlotContext = createContext<{ before?: ReactNode; after?: ReactNode }>({});

export function BodyExtras({ after = false }: { after?: boolean }) {
  const slot = useContext(BodySlotContext);
  return <>{after ? slot.after : slot.before}</>;
}

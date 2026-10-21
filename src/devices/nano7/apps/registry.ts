import { useEffect, useRef } from 'react';
import type { NavApi } from '../os/Nav';
import type { AppId } from '../state';

const navs = new Map<AppId, { current: NavApi | null }>();

/** A nav-stack ref for an app, registered so hardware keys can go back. */
export function useAppNav(id: AppId) {
  const ref = useRef<NavApi | null>(null);
  useEffect(() => {
    navs.set(id, ref);
    return () => {
      if (navs.get(id) === ref) navs.delete(id);
    };
  }, [id]);
  return ref;
}

/** Pops the app's nav stack; false when already at its root. */
export function navBack(id: AppId): boolean {
  const n = navs.get(id)?.current;
  if (n && n.depth > 1) {
    n.pop();
    return true;
  }
  return false;
}

import { createContext, useContext } from 'react';

/** Element (in the screen root, above the MediaLayer) that Now Playing portals its artwork overlay into. */
export const ArtOverlayCtx = createContext<HTMLElement | null>(null);
export const useArtOverlay = () => useContext(ArtOverlayCtx);

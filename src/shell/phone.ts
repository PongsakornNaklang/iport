/**
 * A phone: a small screen turned by a finger. Some of the stage's detail is
 * dialled down there (fewer 3D pieces, fewer live iPods in the chooser),
 * where it can't be seen but a phone feels every extra layer.
 */
export const PHONE = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse) and (max-width: 900px)').matches;

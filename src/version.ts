/**
 * iPort's own version (Semantic Versioning, from package.json) and the
 * build it came from. Not to be confused with the simulated iPod software
 * versions shown in each device's About screen.
 */
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
export const APP_COMMIT: string = typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : 'dev';
export const BUILD_DATE: string = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '';

export const COPYRIGHT = '© 2026 Pongsakorn Naklang · PolyForm Noncommercial 1.0.0';

import API_BASE from './config.js';

// SBT deployment is detected from the API host; everything else keeps TMADJ branding.
export const IS_SBT = API_BASE.includes('api-sbt.tms11ss.com');

export const APP_NAME = IS_SBT ? 'SBT Management' : 'TMADJ Temple Management';
export const PDF_BRAND = IS_SBT ? 'SBT' : 'TMADJ Temple POS';
export const DEFAULT_TEMPLE_NAME = IS_SBT ? 'SBT' : 'TMADJ Temple';
export const FAVICON = IS_SBT ? '/icons/sbt.svg' : '/icons/diya.svg';

// Downloaded files: "SBT-" in front on SBT, unchanged otherwise.
export const downloadName = (name) => (IS_SBT ? `SBT-${name}` : name);
// Reports files already carry a brand prefix.
export const REPORT_PREFIX = IS_SBT ? 'SBT' : 'tmadj';

export function applyBranding() {
  document.title = APP_NAME;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
  link.type = 'image/svg+xml';
  link.href = FAVICON;
}

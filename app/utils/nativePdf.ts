import { Platform } from 'react-native';

/**
 * Lazy accessors for the PDF and share native modules.
 *
 * These packages call TurboModuleRegistry.getEnforcing at import time, which
 * throws on web where no native module exists. Because expo-router imports every
 * route eagerly, a single top-level import of either one crashes the entire web
 * app on load — not just the screen that uses it. Requiring them on demand keeps
 * web working while behaving identically on device.
 */

export const canGeneratePdf = Platform.OS !== 'web';

// deno-lint-ignore-file
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRNHTMLtoPDF(): any {
  if (!canGeneratePdf) {
    throw new Error('PDF generation is not available on web.');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-html-to-pdf').default;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getShare(): any {
  if (!canGeneratePdf) {
    throw new Error('Native sharing is not available on web.');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-share').default;
}

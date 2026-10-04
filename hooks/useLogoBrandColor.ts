import { useEffect, useState } from 'react';

/**
 * The dominant brand colour of a logo, as a hex string, or null when the logo
 * has no usable colour (a black wordmark, a grey icon).
 *
 * The sampling itself runs in a hidden WebView (see LogoColorProbe): the app has
 * no native image-decoding module, and adding one means a rebuild. A canvas in
 * the WebView the preview already depends on decodes the same data URI the
 * document uses, so there is no second fetch and no CORS.
 *
 * Results are cached per logo URI for the life of the app; a logo does not
 * change colour between invoices.
 */
const cache = new Map<string, string | null>();
const listeners = new Map<string, Set<(hex: string | null) => void>>();
let pending: string | null = null;
let setPendingUri: ((uri: string | null) => void) | null = null;

/** Called by LogoColorProbe when it has an answer. */
export function resolveLogoColor(uri: string, hex: string | null) {
  cache.set(uri, hex);
  listeners.get(uri)?.forEach((fn) => fn(hex));
  listeners.delete(uri);
  if (pending === uri) {
    pending = null;
    setPendingUri?.(null);
  }
}

/** Called by LogoColorProbe on mount so the hook can hand it work. */
export function registerLogoProbe(setter: ((uri: string | null) => void) | null) {
  setPendingUri = setter;
  if (setter && pending) setter(pending);
}

export function useLogoBrandColor(logoDataUri: string | null | undefined): string | null {
  const [hex, setHex] = useState<string | null>(() => (logoDataUri ? (cache.get(logoDataUri) ?? null) : null));

  useEffect(() => {
    if (!logoDataUri) {
      setHex(null);
      return;
    }
    if (cache.has(logoDataUri)) {
      setHex(cache.get(logoDataUri) ?? null);
      return;
    }
    const fn = (h: string | null) => setHex(h);
    if (!listeners.has(logoDataUri)) listeners.set(logoDataUri, new Set());
    listeners.get(logoDataUri)!.add(fn);
    if (pending !== logoDataUri) {
      pending = logoDataUri;
      setPendingUri?.(logoDataUri);
    }
    return () => {
      listeners.get(logoDataUri)?.delete(fn);
    };
  }, [logoDataUri]);

  return hex;
}

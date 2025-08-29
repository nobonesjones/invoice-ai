// Early diagnostics and hardening before expo-router/entry
/* eslint-disable no-console */

try {
  console.log('[Entry] App starting. typeof Promise:', typeof Promise);

  // Protect native Promise from being overwritten by polyfills
  (function hardenPromise() {
    const NativePromise = globalThis.Promise;
    if (!NativePromise) return;
    let current = NativePromise;
    try {
      Object.defineProperty(globalThis, 'Promise', {
        configurable: true,
        enumerable: false,
        get() {
          return current;
        },
        set(next) {
          try {
            // Log a short stack to device logs if anything tries to override
            throw new Error('[Entry] Promise override attempt');
          } catch (e) {
            console.error('[Entry] Promise override blocked:', String(e));
          }
          if (!__DEV__) return; // allow in dev only
          current = next;
        },
      });
      // Freeze prototype to avoid monkey patching methods
      Object.freeze(NativePromise.prototype);
    } catch {}
  })();

  // Minimal safe polyfills commonly needed in RN
  console.log('[Entry] Before url-polyfill. typeof Promise:', typeof Promise);
  require('react-native-url-polyfill/auto');

  // Global fatal error handler to surface early exceptions
  if (global.ErrorUtils && typeof global.ErrorUtils.setGlobalHandler === 'function') {
    const prev = global.ErrorUtils.getGlobalHandler?.();
    global.ErrorUtils.setGlobalHandler((err, isFatal) => {
      try {
        const msg = (err && err.message) || String(err);
        console.error('[FATAL]', isFatal, msg);
      } catch {}
      // Preserve default behavior
      if (typeof prev === 'function') return prev(err, isFatal);
    });
  }

  console.log('[Entry] Handing off to expo-router/entry');
  require('expo-router/entry');
} catch (e) {
  try {
    console.error('[Entry] Top-level init error:', e && e.message ? e.message : String(e));
  } catch {}
  throw e;
}


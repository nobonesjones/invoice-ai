// Early diagnostics and hardening before expo-router/entry
/* eslint-disable no-console */

try {
  console.log('[Entry] App starting. typeof Promise:', typeof Promise);

  // Protect native Promise from being overwritten by polyfills (production only)
  if (!__DEV__) {
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
              throw new Error('[Entry] Promise override attempt');
            } catch (e) {
              console.error('[Entry] Promise override blocked:', String(e));
            }
            // In production, never allow override
          },
        });
        // Freeze prototype to avoid monkey patching methods
        Object.freeze(NativePromise.prototype);
      } catch {}
    })();
  }

  // Minimal safe polyfills commonly needed in RN
  console.log('[Entry] Before url-polyfill. typeof Promise:', typeof Promise);
  require('react-native-url-polyfill/auto');

  // Hydrate process.env from expo-config extras in production
  try {
    const Constants = require('expo-constants').default;
    const extra = (Constants?.expoConfig?.extra) || (Constants?.manifest?.extra) || {};
    if (extra && typeof extra === 'object') {
      // Ensure process.env exists
      if (typeof process === 'object') {
        process.env = process.env || {};
        for (const [k, v] of Object.entries(extra)) {
          if (k.startsWith('EXPO_PUBLIC_') && process.env[k] == null && v != null) {
            process.env[k] = String(v);
          }
        }
      }
    }
    console.log('[Entry] Env hydration complete. Has ANON?', !!process.env?.EXPO_PUBLIC_ANON_KEY);
    console.log('[Entry] API URL:', process.env?.EXPO_PUBLIC_API_URL || '(missing)');
  } catch (e) {
    console.error('[Entry] Env hydration error:', e?.message || String(e));
  }

  // Global fetch logger to surface failing requests early
  try {
    if (!global.__FETCH_WRAPPED__) {
      global.__FETCH_WRAPPED__ = true;
      const originalFetch = global.fetch;
      global.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : (input?.url || String(input));
        const method = init?.method || 'GET';
        try {
          const res = await originalFetch(input, init);
          return res;
        } catch (err) {
          try {
            console.error('[Fetch Error]', method, url, '-', err?.message || String(err));
          } catch {}
          throw err;
        }
      };
    }
  } catch {}

  // Connectivity self-test: verify common endpoints
  (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const testUrl = 'https://www.google.com/generate_204';
      const r = await fetch(testUrl, { signal: controller.signal });
      clearTimeout(timeout);
      console.log('[NetTest] Internet reachability:', r.status);
    } catch (e) {
      console.error('[NetTest] Internet reachability failed:', e?.message || String(e));
    }

    const base = process.env?.EXPO_PUBLIC_API_URL;
    if (base) {
      // Supabase health endpoint is useful if available
      const health = base.replace(/\/$/, '') + '/auth/v1/health';
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const r = await fetch(health, { signal: controller.signal });
        clearTimeout(timeout);
        console.log('[NetTest] Supabase health:', r.status);
      } catch (e) {
        console.error('[NetTest] Supabase health failed:', e?.message || String(e));
      }

      const func = base.replace(/\/$/, '') + '/functions/v1/ai-chat';
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const r = await fetch(func, { method: 'OPTIONS', signal: controller.signal });
        clearTimeout(timeout);
        console.log('[NetTest] Functions preflight (OPTIONS) status:', r.status);
      } catch (e) {
        console.error('[NetTest] Functions preflight failed:', e?.message || String(e));
      }
    } else {
      console.warn('[NetTest] EXPO_PUBLIC_API_URL missing; skip tests');
    }
  })();

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

Got it—this smells like a Promise getting patched (or nuked) by a polyfill/order-of-ops only in production. Here’s a tight plan: quick containment, isolate the offender, then harden your startup so this can’t happen again.

0) Two quick questions (answer if you can)

Do you import core-js, es6-promise, promise-polyfill, bluebird, or zone.js anywhere?

Is your babel.config.js using @babel/preset-env (with useBuiltIns) instead of only babel-preset-expo / metro-react-native-babel-preset?

(If “yes” to either, that’s likely the culprit. Either way, proceed with the steps below.)

1) Contain it now (guard + load order)

Create a custom entry to control polyfill order and lock Promise before anything else runs.

index.js

// 1) Lock the native Promise before any other imports
import './polyfills/guard-promise';

// 2) Only the minimal, RN-safe polyfills BEFORE the app entry
// If you need URL in RN, this lib is safe:
import 'react-native-url-polyfill/auto';
// If you use crypto.getRandomValues:
import 'react-native-get-random-values';

// 3) Finally hand control to Expo Router
import 'expo-router/entry';


polyfills/guard-promise.js

/* Early guard: prevent accidental Promise overwrite and log who tries. */
(function () {
  const g = globalThis;
  const NativePromise = g.Promise;

  if (!NativePromise) return; // nothing to do

  let current = NativePromise;

  // Log any attempt to replace Promise
  Object.defineProperty(g, 'Promise', {
    configurable: true,
    enumerable: true,
    get() { return current; },
    set(next) {
      try { throw new Error('[Promise override detected]'); }
      catch (e) {
        // Keep this console.* so it appears in release device logs (Xcode/Console.app)
        console.error('[startup]', String(e), '\n', e.stack?.split('\n').slice(1,7).join('\n'));
      }
      // Hard block replacement in production builds
      if (!__DEV__) return;
      current = next;
    },
  });

  // Extra belt & braces: freeze the prototype so methods don’t get monkey-patched
  try { Object.freeze(NativePromise.prototype); } catch {}
})();


Ship a TestFlight build with this guard. If some code tries to replace Promise, you’ll see a clear stack in device logs and the guard will stop the crash.

2) Reproduce locally like production

Bundle like prod: npx expo start --no-dev --minify

Run release scheme: iOS: npx expo run:ios --configuration Release (or Xcode “Release”), Android: npx expo run:android --variant release.

Watch logs for [Promise override detected].

3) Remove the usual offenders

Delete any of these from app code and lockfile if present:

core-js, @babel/polyfill (deprecated), es6-promise, promise-polyfill, bluebird, zone.js, “polyfill.io” script usage (web only).

babel.config.js should be lean:

module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'], // or 'module:metro-react-native-babel-preset'
    plugins: [],
  };
};


Avoid @babel/preset-env and useBuiltIns—that’s how core-js sneaks in and tramples globals.

4) Verify Metro & Expo setup

No custom polyfills in Metro: ensure your metro.config.js doesn’t inject node/browser polyfills that include Promise.

Expo Router entry: only import 'expo-router/entry' from your controlled index.js (as above), so your guard runs first.

Hermes: stick with Hermes for both dev & prod. In Expo SDKs, don’t manually add core-js to “fix” things—Hermes’ native Promise is fine.

5) Find the exact package doing it (if guard logs a stack)

Once you get a stack from the guard:

Open the minified frame mapping via source maps (enable source maps in release for debugging).

Identify the module name (often a polyfill package or a library that bundles core-js).

Remove it or constrain its import to web-only:

Create foo.polyfills.web.ts vs foo.polyfills.native.ts, or

Use Platform.OS === 'web' conditional imports, or

Patch the library (patch-package) to not assign global.Promise.

6) Hardening checklist (post-fix)

 No core-js or global Promise polyfills in dependencies.

 Guard is in place (you can keep it—cheap and safe).

 Only RN-safe, targeted polyfills (URL, getRandomValues, TextEncoder/Decoder if needed).

 E2E check in “prod-like” bundle (--no-dev --minify) before cutting TestFlight.

 If you use Sentry/Bugsnag, disable any experimental Promise instrumentation for RN.

7) If you need URL & friends, use RN-safe polyfills only

react-native-url-polyfill/auto

react-native-get-random-values

(Optionally) text-encoding or fast-text-encoding if you truly need them (don’t touch Promise).
// Custom entry to control startup order and stabilize globals
// Runs before expo-router/entry

console.log('[Entry] index.js starting. typeof Promise =', typeof Promise);

// Harden global.Promise so late polyfills can’t replace it
(function hardenPromise() {
  const NativePromise = globalThis.Promise;
  if (typeof NativePromise !== 'function') {
    // As a last resort, load a minimal polyfill; should rarely happen
    require('es6-promise/auto');
  }
  const FinalPromise = globalThis.Promise;
  if (typeof FinalPromise === 'function') {
    try {
      Object.defineProperty(globalThis, 'Promise', {
        configurable: false,
        get: () => FinalPromise,
        set: () => {
          // Prevent silent overrides that lead to runtime crashes
          throw new Error('[Entry] Attempted to override global.Promise');
        },
      });
    } catch {
      // defineProperty may fail in some environments; ignore
    }
  }
})();

// Load any URL polyfills before router (keeps fetch/URL consistent)
console.log('[Entry] Before URL polyfill. typeof Promise =', typeof Promise);
require('react-native-url-polyfill/auto');

// Hand off to Expo Router
console.log('[Entry] Loading expo-router/entry. typeof Promise =', typeof Promise);
require('expo-router/entry');

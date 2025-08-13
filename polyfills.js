/**
 * Polyfills for React Native device-specific issues
 * This runs before any other code in the bundle
 */

// Ensure Promise is available
if (typeof Promise === 'undefined') {
  global.Promise = require('es6-promise').Promise;
}

// Fix for React Native accessibility modules on physical devices
// These modules might not be initialized properly on device vs simulator
if (typeof global !== 'undefined') {
  // Create mock implementations if they don't exist
  if (!global._NativeAccessibilityInfo) {
    global._NativeAccessibilityInfo = {
      default: {
        isReduceMotionEnabled: () => new Promise(resolve => resolve(false)),
        addEventListener: () => {},
        removeEventListener: () => {},
        announceForAccessibility: () => {},
        isBoldTextEnabled: () => new Promise(resolve => resolve(false)),
        isGrayscaleEnabled: () => new Promise(resolve => resolve(false)),
        isInvertColorsEnabled: () => new Promise(resolve => resolve(false)),
        isScreenReaderEnabled: () => new Promise(resolve => resolve(false)),
      }
    };
  }
  
  if (!global._NativeAccessibilityManager) {
    global._NativeAccessibilityManager = {
      default: {
        getCurrentReduceMotionState: (callback) => {
          if (callback) callback(false);
        },
        setAccessibilityFocus: () => {},
        announceForAccessibility: () => {},
        getMultiplier: () => 1,
      }
    };
  }
  
  // Also ensure NativeModules exists
  if (!global.NativeModules) {
    global.NativeModules = {};
  }
}

// Log to confirm polyfills loaded
console.log('[Polyfills] Device-specific polyfills loaded successfully');
# First Principles Plan: Identify & Fix Hermes/JSC Crash Issue

## Core Issue
**Problem**: App crashes immediately on production launch with "undefined is not a constructor (evaluating new Promise(...))"
**Root Cause Hypothesis**: A dependency or polyfill is overwriting the global Promise constructor during production bundle initialization

## First Principles Analysis

### What We Know (Facts)
1. Development works perfectly (both Hermes/JSC)
2. Production crashes immediately on both engines
3. Crash occurs during JavaScript initialization phase
4. Promise constructor becomes undefined/corrupted

### The Real Problem
React Native has two completely different execution environments:
- **Dev**: Metro bundler + dev polyfills + hot reload
- **Prod**: Compiled bundle + minification + different polyfill loading order

Something in the production bundle process is corrupting Promise.

## Diagnostic Plan

### Phase 1: Reproduce Locally (Critical)
```bash
# Test production-like environment locally
npx expo start --no-dev --minify
npx expo run:ios --configuration Release

# If that works, test actual EAS build locally
eas build -p ios --profile production --local
```

### Phase 2: Add Diagnostic Logging
Create minimal diagnostic entry point:

```javascript
// index.js - Diagnostic version
console.log('[DIAGNOSTIC] App start - Promise:', typeof Promise, Promise);

// Log before any imports
console.log('[DIAGNOSTIC] About to import expo-router');
import 'expo-router/entry';
console.log('[DIAGNOSTIC] expo-router imported successfully');
```

### Phase 3: Binary Search Dependencies
If we can reproduce the crash:

1. **Strip down to minimum**:
   ```javascript
   // Only expo-router import
   import 'expo-router/entry';
   ```

2. **Add back imports one by one** until crash occurs
3. **That import is the culprit**

### Phase 4: Identify Polyfill Culprits
Check for common Promise-overwriting packages:

```bash
# Search dependencies for polyfills
grep -r "core-js\|polyfill\|es6-promise\|bluebird" package.json node_modules/*/package.json

# Check build configs
grep -r "Promise\|polyfill\|useBuiltIns" babel.config.js metro.config.js

# Check for Babel preset-env (common culprit)
grep -r "@babel/preset-env" babel.config.js
```

### Phase 5: Test Actual Production Artifact
```bash
# Build exactly like App Store submission
eas build -p ios --profile production

# Download and test the exact .ipa that would go to App Store
```

## Likely Root Causes (Priority Order)

1. **core-js auto-polyfilling** via @babel/preset-env with useBuiltIns
2. **Promise polyfill package** imported by a dependency
3. **Metro polyfill configuration** injecting browser polyfills
4. **Third-party library** bundling its own Promise implementation

## Fix Strategy

### Immediate: Add Promise Guard (Diagnostic)
```javascript
// polyfills/guard-promise.js
(function() {
  const NativePromise = globalThis.Promise;
  if (!NativePromise) return;
  
  Object.defineProperty(globalThis, 'Promise', {
    get: () => NativePromise,
    set: (replacement) => {
      console.error('[PROMISE OVERRIDE DETECTED]', new Error().stack);
      // Block in production
      if (!__DEV__) return;
    }
  });
})();
```

### Long-term: Remove Root Cause
Once identified:
1. **Remove the offending package** from dependencies
2. **Configure Babel** to avoid auto-polyfilling
3. **Use React Native-safe alternatives** only

## Success Criteria

1.  Can reproduce crash in local production build
2.  Identify exact line/package causing Promise corruption  
3.  Remove root cause (not just guard against it)
4.  Test actual EAS production build works
5.  Verify App Store submission works

## Critical Principle
**Don't fix symptoms - eliminate the root cause**. 
The goal is to remove whatever is corrupting Promise, not just protect against it.
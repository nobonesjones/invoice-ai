# React Native Promise Crash - Comprehensive Analysis & Solutions

## Problem Summary
App crashes in production (TestFlight) with "undefined is not a constructor (evaluating new Promise(...))" but works fine in development.

## Root Cause Investigation

### Initial Hypothesis - INCORRECT
- **Theory:** JSC vs Hermes engine differences
- **Reality:** Both engines can handle Promise correctly when not corrupted

### Actual Root Cause - CONFIRMED
- **Issue:** Metro bundler polyfill loading order corruption
- **Specific:** `assert` polyfill in `metro.config.js` was importing `core-js` which overwrote the global Promise constructor
- **Evidence:** Promise became `undefined` during bundle initialization, before app code ran

## Failed Solutions Attempted

### 1. Custom Entry Point Only (FAILED)
```javascript
// index.js - Entry point with diagnostics
console.log('[DIAGNOSTIC] App start - Promise type:', typeof Promise);
import 'expo-router/entry';
```
**Result:** Still crashed - polyfill corruption happened before entry point

### 2. Promise Protection Guards (FAILED)
```javascript
// Attempted to prevent Promise overwriting
Object.defineProperty(globalThis, 'Promise', {
  get: () => NativePromise,
  set: (replacement) => {
    // Block overwrite attempts
    if (!__DEV__) return;
  }
});
```
**Result:** Too late - Promise already corrupted during bundle loading

### 3. JSEngine Configuration Only (FAILED)
- Removed `"jsEngine": "jsc"` from `app.json`
- Set Hermes in `ios/Podfile.properties.json`
**Result:** Still crashed - engine wasn't the issue

### 4. String Method Debugging (MISLEADING)
- Found crashes on `.split()`, `.trim()`, etc.
- These were symptoms, not the cause
- Real issue was Promise being undefined, affecting async operations

## Working Solution

### Core Fix: Remove Problematic Polyfill
```javascript
// metro.config.js - REMOVE THIS LINE:
// assert: require.resolve("assert"), // CAUSES Promise corruption via core-js

module.exports = {
  resolver: {
    alias: {
      // Keep other aliases, remove assert
    },
  },
};
```

### Engine Configuration
```json
// app.json - Remove jsEngine to default to Hermes
{
  "expo": {
    // Remove: "jsEngine": "jsc",
  }
}
```

```json
// ios/Podfile.properties.json - Use Hermes
{
  "expo.jsEngine": "hermes"
}
```

### Error Handling Safety Net
```javascript
// index.js - Fatal error capture
if (!__DEV__ && global.ErrorUtils?.setGlobalHandler) {
  const prev = global.ErrorUtils.getGlobalHandler?.();
  global.ErrorUtils.setGlobalHandler((e, isFatal) => {
    try {
      console.error('[FATAL]', isFatal, e?.message, e?.stack);
    } catch {}
    prev?.(e, isFatal);
  });
}

import 'expo-router/entry';
```

## Testing Methods Used

### Local Testing (Successful)
```bash
# Release build with Hermes - WORKED
npx expo run:ios --configuration Release

# Production bundle export - WORKED  
npx expo export --platform ios
# Result: 13.8 MB .hbc file created successfully
```

### EAS Build Issues Encountered

#### 1. Wrong Branch (SOLVED)
- **Problem:** EAS building from `main` branch instead of `restore/80854b5`
- **Solution:** Specify branch in build command or use git commit hash

#### 2. Provisioning Profile Conflicts (SOLVED)
```
Error: Provisioning profile doesn't support Push Notifications capability
```
- **Fix:** Remove `aps-environment` from entitlements file

#### 3. Invalid EAS Config (SOLVED)
```json
// eas.json - This is INVALID:
{
  "production": {
    "branch": "restore/80854b5"  // NOT ALLOWED
  }
}
```

## File Changes Made

### Critical Files Modified:
1. `metro.config.js` - Removed assert polyfill
2. `app.json` - Removed jsEngine config (defaults to Hermes)
3. `ios/Podfile.properties.json` - Set to Hermes
4. `index.js` - Added error capture + diagnostics
5. `ios/SuperInvoice/SuperInvoice.entitlements` - Removed push notifications

### Git Commits:
- `33a8ba0` - Fix Promise corruption crash by removing assert polyfill
- `d53806d` - Fix Promise crash: Switch to Hermes + add error handling  
- `e14a737` - Remove push notifications entitlement to fix provisioning profile

## Key Learnings

### 1. Polyfill Order Matters
- Metro bundler loads polyfills before app code
- Some polyfills (like assert → core-js) can corrupt global objects
- Always check metro.config.js when debugging global object issues

### 2. Local vs Production Differences  
- Development uses different bundling process
- Production bundles all polyfills together
- Always test with `--configuration Release` locally

### 3. EAS Build Considerations
- EAS builds from git, not local files
- Default branch is `main` unless specified
- Provisioning profiles must match entitlements exactly
- Invalid eas.json fields cause immediate build failure

### 4. Debugging Strategy
- Start with first principles: what's different between dev/prod?
- Use diagnostic logging at the earliest possible point
- Focus on global object corruption before app initialization
- Symptoms (string method crashes) ≠ Root cause (Promise undefined)

## Current Status
- ✅ Local Release builds work perfectly
- ✅ Production bundle exports successfully  
- ❌ EAS builds still failing (need to investigate latest error)
- ✅ Root cause identified and fixed in code

## Next Steps If EAS Still Fails
1. Check exact error message in EAS build logs
2. Verify all changes are committed and pushed
3. Confirm EAS is using correct commit hash
4. Consider provisioning profile regeneration if certificate issues persist
5. Test with `eas build --local` for faster iteration

## Files to Monitor
- `metro.config.js` - Don't add problematic polyfills
- `ios/Podfile.properties.json` - Keep Hermes engine
- `index.js` - Maintain error capture
- `ios/SuperInvoice/SuperInvoice.entitlements` - Match provisioning profile exactly
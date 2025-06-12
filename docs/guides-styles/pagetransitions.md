# Page Transitions & Navigation Bar Management

This document explains how to create smooth page transitions and properly manage the bottom navigation bar visibility in the VoiceInvoice app.

## Problem Overview

When creating new pages within the app, you may encounter:
- Bottom navigation bar showing when it shouldn't
- Clunky or jarring transitions
- Inconsistent navigation behavior

## Root Cause Analysis

The visibility of the bottom navigation bar depends on the **route hierarchy**:

### Pages WITHOUT Bottom Navigation (by default):
- **App Level Routes**: `app/(app)/business-information.tsx`
- These are **outside** the tab navigation scope
- No special handling needed

### Pages WITH Bottom Navigation (by default):
- **Tab Level Routes**: `app/(app)/(protected)/invoices/create.tsx`
- **Tab Level Routes**: `app/(app)/(protected)/invoices/previewbusinfoclose.tsx`
- These are **inside** the tab navigation scope
- Need explicit tab bar management

## Solutions

### Approach 1: App Level Placement (Business Information Style)

For pages that should always hide the bottom navigation, place them at the app level:

```
app/(app)/your-page.tsx  ✅ No bottom nav by default
```

**Implementation:**
```typescript
import React, { useEffect } from 'react';
import { useNavigation } from 'expo-router';

export default function YourPage() {
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      header: () => (
        <View style={[styles.headerContainer, { backgroundColor: theme.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border}]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
            <ChevronLeft size={26} color={theme.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: theme.foreground}]}>Page Title</Text>
        </View>
      ),
      headerShown: true, 
    });
  }, [navigation, router, theme, styles]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {/* Your content */}
    </SafeAreaView>
  );
}
```

### Approach 2: Tab Level with Manual Management (Create/Preview Style)

For pages within the tab navigation that need to hide the bottom bar:

```
app/(app)/(protected)/invoices/your-page.tsx  ⚠️ Needs manual tab bar management
```

**Implementation:**
```typescript
import React, { useEffect } from 'react';
import { useNavigation } from 'expo-router';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';

export default function YourPage() {
  const navigation = useNavigation();
  const { setIsTabBarVisible } = useTabBarVisibility();

  // Custom header setup
  useEffect(() => {
    navigation.setOptions({
      header: () => (
        <View style={[styles.headerContainer, { backgroundColor: theme.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border}]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
            <ChevronLeft size={26} color={theme.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: theme.foreground}]}>Page Title</Text>
        </View>
      ),
      headerShown: true, 
    });
  }, [navigation, router, theme, styles]);

  // Tab bar visibility management
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('[YourPage] Focus event: Hiding tab bar');
      setIsTabBarVisible(false);
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      console.log('[YourPage] Blur event: Showing tab bar');
      setIsTabBarVisible(true);
    });

    // Initial hide if screen is focused on mount
    if (navigation.isFocused()) {
      console.log('[YourPage] Initial focus: Hiding tab bar');
      setIsTabBarVisible(false);
    }

    return () => {
      console.log('[YourPage] Unmounting: Ensuring tab bar is visible');
      unsubscribeFocus();
      unsubscribeBlur();
      setIsTabBarVisible(true);
    };
  }, [navigation, setIsTabBarVisible]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {/* Your content */}
    </SafeAreaView>
  );
}
```

## Key Components for Smooth Transitions

### 1. Custom Header Styling
```typescript
const getStyles = (theme: any) => StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10, 
    paddingTop: Platform.OS === 'ios' ? 50 : 40, 
    paddingBottom: 10, 
  },
  headerTitle: {
    fontSize: 20, 
    fontWeight: 'bold', 
    marginLeft: 10,
  },
});
```

### 2. SafeAreaView Configuration
```typescript
<SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
```
**Note**: `edges={['bottom', 'left', 'right']}` excludes 'top' to work with custom header

### 3. Navigation Options Setup
```typescript
navigation.setOptions({
  header: () => (/* Custom header component */),
  headerShown: true, 
});
```

## When to Use Which Approach

### Use Approach 1 (App Level) When:
- Page is a standalone feature (business settings, onboarding, etc.)
- Page should never show bottom navigation
- Page is accessed from multiple places in the app

### Use Approach 2 (Tab Level) When:
- Page is part of a tab-specific flow (invoice creation, editing, etc.)
- Page needs access to tab-specific context/state
- Page is tightly coupled to tab functionality

## Examples in Codebase

### App Level Examples:
- `app/(app)/business-information.tsx` ✅ Smooth transitions, no bottom nav

### Tab Level Examples:
- `app/(app)/(protected)/invoices/create.tsx` ✅ Manual tab bar management
- `app/(app)/(protected)/invoices/previewbusinfoclose.tsx` ✅ Manual tab bar management
- `app/(app)/(protected)/invoices/preview.tsx` ❌ Initially broken (fixed by adding manual management)

## Troubleshooting

### Bottom Navigation Still Showing?
1. Check if page is in tab scope: `app/(app)/(protected)/...`
2. Ensure `useTabBarVisibility` is imported and used
3. Verify navigation listeners are properly set up
4. Check console logs for focus/blur events

### Transitions Not Smooth?
1. Ensure custom header is using `navigation.setOptions()`
2. Check SafeAreaView edges configuration
3. Verify theme colors are applied consistently
4. Ensure header styling matches other smooth pages

## Quick Checklist

For any new page that should hide bottom navigation:

- [ ] Choose correct approach based on route hierarchy
- [ ] Import required dependencies (`useNavigation`, `useTabBarVisibility` if needed)
- [ ] Set up custom header with `navigation.setOptions()`
- [ ] Configure SafeAreaView with correct edges
- [ ] Add navigation listeners for tab bar management (if in tab scope)
- [ ] Test transitions on both iOS and Android
- [ ] Verify tab bar shows/hides correctly when navigating to/from page

## Future Improvements

Consider creating a custom hook that encapsulates the tab bar visibility logic:

```typescript
// hooks/useTabBarVisibility.ts
const useTabBarManagement = () => {
  const navigation = useNavigation();
  const { setIsTabBarVisible } = useTabBarVisibility();

  useEffect(() => {
    // Navigation listener logic here
  }, [navigation, setIsTabBarVisible]);
};
```

This would reduce boilerplate code for future pages requiring tab bar management. 
# Safe Manual Log Cleanup Plan - No Risk of Code Destruction

## 🎯 **Strategy: Manual, File-by-File Review**

Instead of automation, we'll do this safely by:
1. **Identifying specific files** with the most logs
2. **Manual review** of each file 
3. **Selective removal** of only obvious debug logs
4. **Test after each file** (or batch of files)

## 📊 **Priority Order (High Impact Files First)**

### **Phase 1: Highest Log Count Files (Manual Review)**
1. `app/(app)/(protected)/invoices/create.tsx` (139 logs)
2. `app/(app)/(protected)/ai.tsx` (130 logs) 
3. `app/(app)/(protected)/estimates/create.tsx` (79 logs)
4. `supabase/functions/ai-chat-assistants-poc/index.ts` (263 logs)

**Approach for each file:**
- Open file in editor
- Search for `console.log`
- Remove only obvious debug logs like:
  - `console.log('[Debug] ...')`
  - `console.log('Loading...', data)`
  - `console.log('[Analytics TEST] ...')`
- **Keep all error handling:**
  - `console.error(...)`
  - `console.log('Error: ...')`
  - `console.log(...error...)`

### **Phase 2: Services (30-40 logs each)**
5. `services/chatService.ts` (39 logs)
6. `services/analyticsService.ts` (30 logs) 
7. `services/assistantService.ts` (18 logs)
8. `services/voiceService.ts` (29 logs)
9. `services/usageService.ts` (31 logs)

### **Phase 3: Components & Context (10-30 logs each)**
10. `context/onboarding-provider.tsx` (34 logs)
11. `app/(app)/business-information.tsx` (30 logs)
12. `context/paywall-provider.tsx` (6 logs)
13. All onboarding screens

### **Phase 4: Lower Priority (< 10 logs each)**
- All remaining files with < 10 logs
- Can batch these together safely

## 🔍 **What to Remove (Safe Patterns)**

### ✅ **Safe to Remove:**
```typescript
// Analytics/Testing
console.log('[Analytics TEST] ...');
console.log('[Analytics] 🎯 trackEvent called...');
console.log('🧪 TEST...');

// AI Debug
console.log('[AI Screen] ...');
console.log('[useAIChat] ...');
console.log('🤔 Thinking...');

// Loading/Status
console.log('Loading...');
console.log('✅ Success...');
console.log('🚀 Starting...');

// Simple debug
console.log('Current state:', someVariable);
console.log(someData);
```

### ❌ **Never Remove:**
```typescript
// Error handling
console.error('Authentication failed:', error);
console.log('Payment error:', error.message);
console.warn('Network timeout');

// Critical user feedback
console.log('User signup failed:', errorDetails);
```

## 📝 **Manual Process for Each File:**

1. **Open file in VS Code**
2. **Search for "console." (Ctrl/Cmd + F)**
3. **Review each result individually**
4. **Delete only obvious debug logs**
5. **Save file**
6. **Quick test if it's a critical file**
7. **Move to next file**

## ⏱️ **Time Estimate:**
- **High priority files (4 files):** 30-45 minutes each = 2-3 hours
- **Medium priority files (10 files):** 15 minutes each = 2.5 hours  
- **Low priority files (100+ files):** 2-5 minutes each = 3-8 hours

**Total: 8-14 hours of careful manual work**

## 🧪 **Testing Strategy:**
- Test after each high-priority file
- Test core functionality after each phase
- Full regression test at the end

This approach is **100% safe** - no risk of code destruction, just careful human review.
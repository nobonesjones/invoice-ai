# Manual Review Required - High Impact Files

## 🔴 Critical Files (Review Before Auto-Cleanup)

### Core Services (Keep Error Handling)
- `services/analyticsService.ts` (30 logs) - Remove debug, keep error logs
- `services/chatService.ts` (39 logs) - Remove AI debug, keep connection errors  
- `services/assistantService.ts` (18 logs) - Remove debug, keep API errors
- `services/revenueCatService.ts` (16 logs) - Keep payment errors
- `services/superwallService.ts` (17 logs) - Keep subscription errors

### Main App Screens (Lots of Debug Logs)
- `app/(app)/(protected)/ai.tsx` (130 logs) - Remove ALL AI debug logs
- `app/(app)/(protected)/estimates/create.tsx` (79 logs) - Keep save errors
- `app/(app)/(protected)/invoices/create.tsx` (139 logs) - Keep save errors

### Authentication & Onboarding (Keep Auth Errors)
- `components/auth/sign-up-modal.tsx` (4 logs) - Keep signup errors
- `components/auth/sign-in-modal.tsx` (8 logs) - Keep signin errors
- `context/supabase-provider.tsx` (7 logs) - Keep auth errors
- All `app/(auth)/onboarding-*.tsx` files - Remove tracking logs

### Edge Functions (Keep if Used in Production)
- `supabase/functions/ai-chat-assistants-poc/index.ts` (263 logs) - Review carefully

## 🟡 Medium Priority Files
- All component files with < 10 logs - Safe for auto-cleanup
- Hook files - Remove debug logs, keep error handling
- Context providers - Keep state error logs

## ✅ Auto-Cleanup Safe Files
- Test files (remove all logs)
- Utility files (remove debug logs)
- Components with < 5 logs (auto-cleanup safe)

## 🚫 Files to Skip (Not App Code)
- `node_modules/` (already excluded)
- `*.js` files in root (build scripts - leave alone)
- `supabase/functions/` (if not used in production)
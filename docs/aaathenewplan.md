React Native iOS Production Build Code Checklist
Essential code patterns and practices to prevent TestFlight/production crashes
📝 String & Type Safety

 Every string method is called on a verified string
 All variables are defined before use
 Optional chaining (?.) used for all object property access
 No assumptions about data types from API responses
 TypeScript/PropTypes validate all props if used
 No direct array index access without length check
 All JSON.parse() wrapped in try-catch

🎣 React Hooks & Lifecycle

 useEffect has proper dependency arrays
 Cleanup functions for all subscriptions/timers
 No setState calls after unmount
 No hooks inside conditions or loops
 Custom hooks follow rules of hooks
 No missing dependencies in hooks
 Async effects handled correctly

🏃 Async/Await & Promises

 Every async function has error handling
 No unhandled promise rejections
 Await is used for all async calls
 No async operations without cleanup
 Loading states for all async operations
 Race conditions prevented
 Network timeouts implemented

🔌 Native Modules & Platform Code

 All NativeModules checked for existence
 Platform.OS checks before iOS-specific code
 Native module methods wrapped in try-catch
 No assumption about native module availability
 Proper null checks for native responses
 Event emitters properly removed
 Bridge methods handle all data types correctly

💾 State Management

 Initial state never null if accessed immediately
 No direct state mutations
 Redux actions always return valid state
 Context providers have default values
 State updates are batched when needed
 No missing null checks in selectors
 Computed values handle edge cases

🖼️ Components & Rendering

 All map() functions have key props
 Conditional rendering checks for null/undefined
 FlatList has keyExtractor
 No array.length without null check
 Empty states for all lists
 Image sources validated before render
 No inline functions in render (performance)

📦 Third-Party Libraries

 All imports verified to exist
 Version compatibility confirmed
 Required peer dependencies installed
 Platform-specific setup completed
 No use of deprecated methods
 Error boundaries around risky libraries
 Fallbacks for optional libraries

🌐 API & Network

 No localhost or dev URLs
 HTTPS used everywhere
 Error handling for all status codes
 Timeout handling for all requests
 Offline mode handled gracefully
 Response validation before use
 Auth token refresh logic works

⚡ Performance & Memory

 No console.log in production
 Large lists virtualized
 Images properly sized
 Memoization where appropriate
 No memory leaks from listeners
 Animations use native driver
 Heavy computations off main thread

🔒 Data Validation

 User input sanitized
 API responses validated
 Type checking on all external data
 Bounds checking on numeric operations
 Date/time operations validated
 File operations check existence
 Database queries handle empty results

⚠️ Error Boundaries

 Global error boundary exists
 Screen-level error boundaries
 Error logging implemented
 Graceful fallback UI
 Recovery mechanisms in place
 User-friendly error messages
 No sensitive data in errors

🎯 Common Crash Points

 No .map() on undefined
 No accessing object.property.nested without checks
 No string methods on non-strings
 No math operations on NaN/undefined
 No array[index] without bounds check
 No assumed API response structure
 No date operations on invalid dates

🔧 iOS Specific

 SafeAreaView implemented
 Keyboard handling works
 Status bar configured
 Permissions properly requested
 Deep linking configured
 Push notifications handled
 Background tasks properly setup

🚦 Navigation

 All routes defined
 Navigation state persisted correctly
 Deep links have fallbacks
 Back button handled properly
 Navigation guards in place
 Screen params validated
 Stack navigation properly configured

📊 Data Flow

 Props drilling minimized
 Circular dependencies removed
 Data transformations are safe
 Filters/sorts handle edge cases
 Reducers are pure functions
 Side effects properly isolated
 Event handlers bound correctly

🔐 Security

 No hardcoded secrets
 API keys in environment variables
 Sensitive data encrypted
 Input validation on all forms
 SQL injection prevention (if applicable)
 XSS prevention in web views
 Certificate pinning (if required)

✅ Code Hygiene

 No TODO/FIXME in production
 No commented code blocks
 No debug flags enabled
 No test data in production
 Linting errors resolved
 No unused variables
 No unreachable code

🎨 UI Safety

 Text components handle empty/null
 Images have error handlers
 Buttons have proper press handlers
 TextInput has proper validation
 ScrollView has proper configuration
 Modal dismissal handled
 Gesture conflicts resolved

⏰ Timing Issues

 No race conditions
 SetTimeout cleared on unmount
 SetInterval cleared on unmount
 Debouncing implemented where needed
 Animation callbacks handled
 Async storage operations awaited
 State updates batched properly

🔄 App State Transitions

 Background/foreground handled
 App termination cleanup
 Memory warnings handled
 Network reconnection handled
 Deep link resumption works
 State restoration works
 Cache invalidation proper
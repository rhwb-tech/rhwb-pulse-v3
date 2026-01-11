# Public Laptop Checkbox Feature

## Summary

Added a checkbox to the OTP verification screen that allows users to indicate they are logging in from a public or shared laptop/device. When checked, the session will not persist after the browser is closed, providing enhanced security for shared devices.

## Changes Made

### 1. OTP Verification Component (`src/components/AuthOTPVerification.tsx`)

**Added:**
- `isPublicLaptop` state to track checkbox status
- Checkbox UI with explanatory text
- Logic to set/clear public laptop flag in sessionStorage
- Logic to clear localStorage when public laptop mode is enabled

**Key Features:**
- Checkbox is disabled when OTP is expired or verification is in progress
- Clear visual indication with background box and helpful text
- Automatically clears localStorage session data when checked
- Sets flag in sessionStorage (which is cleared when browser closes)

### 2. Supabase Client (`src/components/supabaseClient.ts`)

**Modified:**
- Added `isPublicLaptopMode()` helper function to check for public laptop flag
- Added `getStorage()` helper to return appropriate storage (sessionStorage or localStorage)
- Updated storage functions to use sessionStorage when public laptop mode is enabled

**How it works:**
- When public laptop flag is set, all session data is stored in sessionStorage instead of localStorage
- sessionStorage is automatically cleared when the browser tab/window is closed
- This ensures the session doesn't persist on shared devices

### 3. Auth Context (`src/contexts/AuthContext.tsx`)

**Modified:**
- Updated `logout()` function to clear public laptop flag from sessionStorage
- Ensures clean state when user logs out

### 4. Protected Route (`src/components/ProtectedRoute.tsx`)

**Modified:**
- Updated `handleOTPSuccess()` to accept `isPublicLaptop` parameter
- Simplified implementation (flag handling moved to OTP component)

## User Experience

### Visual Design

The checkbox appears in a highlighted box above the "Verify Code" button:

```
┌─────────────────────────────────────────────┐
│ ☐ I am logging in from a public or shared  │
│   laptop/device                              │
│   Your session will not be saved after you   │
│   close the browser                          │
└─────────────────────────────────────────────┘
```

### Behavior

**When Checkbox is Unchecked (Default):**
- Session is stored in localStorage
- Session persists across browser restarts
- User remains logged in after closing browser

**When Checkbox is Checked:**
- Session is stored in sessionStorage
- Session is cleared when browser tab/window closes
- User must log in again after closing browser
- All localStorage session data is cleared immediately

## Security Benefits

1. **Prevents Session Persistence on Shared Devices**
   - Session data is not saved to persistent storage
   - Automatically cleared when browser closes

2. **Immediate Cleanup**
   - localStorage session data is cleared immediately when checkbox is checked
   - No residual authentication data left on device

3. **User Control**
   - Users can choose whether to persist their session
   - Clear indication of what the checkbox does

## Technical Implementation

### Storage Strategy

```typescript
// Check if public laptop mode is enabled
const isPublicLaptopMode = (): boolean => {
  return sessionStorage.getItem('rhwb-pulse-public-laptop') === 'true';
};

// Use sessionStorage for public laptops, localStorage otherwise
const getStorage = () => {
  return isPublicLaptopMode() ? sessionStorage : localStorage;
};
```

### Flow

1. User enters OTP code
2. User checks/unchecks "public laptop" checkbox
3. User clicks "Verify Code"
4. If checked:
   - Set flag in sessionStorage: `rhwb-pulse-public-laptop = 'true'`
   - Clear all localStorage session data
   - Supabase uses sessionStorage for session persistence
5. If unchecked:
   - Clear flag from sessionStorage
   - Supabase uses localStorage for session persistence (default)

## Testing

### Test Case 1: Normal Login (Checkbox Unchecked)
1. Enter OTP code
2. Leave checkbox unchecked
3. Verify code
4. Close browser
5. Reopen browser
6. **Expected:** User should still be logged in

### Test Case 2: Public Laptop Login (Checkbox Checked)
1. Enter OTP code
2. Check "public laptop" checkbox
3. Verify code
4. Close browser tab/window
5. Reopen browser
6. **Expected:** User should be logged out (must log in again)

### Test Case 3: Checkbox State
1. Check checkbox
2. Uncheck checkbox
3. Verify code
4. **Expected:** Normal session persistence (localStorage)

## Files Modified

1. `src/components/AuthOTPVerification.tsx` - Added checkbox UI and logic
2. `src/components/supabaseClient.ts` - Added conditional storage logic
3. `src/contexts/AuthContext.tsx` - Clear flag on logout
4. `src/components/ProtectedRoute.tsx` - Updated handler signature

## Future Enhancements

1. Add visual indicator when public laptop mode is active
2. Show warning message when user tries to close browser with active session
3. Add option to switch between modes after login
4. Add analytics to track usage of public laptop mode

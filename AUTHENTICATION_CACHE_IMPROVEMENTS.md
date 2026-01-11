# Authentication Cache and Email Override Improvements

## Summary

Modified the authentication flow to properly handle email override URL parameters when users are not authenticated. The system now:

1. **Caches authentication sessions** in the browser (already implemented via Supabase localStorage)
2. **Preserves email override parameters** when no session exists
3. **Applies email override** automatically after authentication completes

## Changes Made

### 1. Added Pending Override Email Storage

Added a new ref to store email override parameters when the user is not authenticated:

```typescript
const pendingOverrideEmailRef = React.useRef<string | null>(null);
```

### 2. Enhanced Initial Session Loading

Modified the initial `useEffect` to check for email parameters and store them if no session exists:

```typescript
// Check for email parameter in URL and store it if no session exists
const urlParams = new URLSearchParams(window.location.search);
const overrideEmail = urlParams.get('email');
if (overrideEmail && !session) {
  pendingOverrideEmailRef.current = overrideEmail;
  console.log('URL Override - Stored pending email for after authentication:', overrideEmail);
}
```

### 3. Enhanced Auth State Change Handler

Updated `onAuthStateChange` to preserve email parameters after authentication:

- When session is established, preserves URL parameter if it exists
- Restores pending override email to URL if it was stored
- Clears pending override after processing

### 4. Enhanced Email Override useEffect

Modified the email override `useEffect` to:

- Check for pending override emails if URL parameter is missing
- Restore pending override to URL if needed
- Apply override after session is established

## How It Works

### Scenario 1: User with Cached Session + Email Parameter

1. User visits `/?email=sapnamysore@gmail.com`
2. Supabase checks localStorage for cached session
3. If session exists:
   - Session is restored automatically
   - Email override is applied immediately
   - Dashboard loads with override user's data

### Scenario 2: User without Session + Email Parameter

1. User visits `/?email=sapnamysore@gmail.com`
2. No cached session found
3. Email parameter is stored in `pendingOverrideEmailRef`
4. Login screen is displayed
5. User authenticates with OTP
6. After authentication:
   - Session is established
   - Pending email override is restored to URL
   - Email override is applied automatically
   - Dashboard loads with override user's data

### Scenario 3: User with Cached Session (No Email Parameter)

1. User visits `/` (no email parameter)
2. Cached session is restored
3. Dashboard loads with authenticated user's data
4. Normal operation continues

## Benefits

1. **Seamless Experience**: Users don't lose email override parameters during authentication
2. **Persistent Sessions**: Authentication is cached in browser localStorage
3. **Automatic Override**: Email override is applied automatically after authentication
4. **URL Preservation**: Email parameters are preserved through the auth flow

## Testing

To test the improvements:

1. **Test with cached session:**
   - Authenticate once
   - Close browser (or clear session manually)
   - Visit `/?email=sapnamysore@gmail.com`
   - Should restore session and apply override

2. **Test without session:**
   - Clear all browser data (or use incognito)
   - Visit `/?email=balajisankaran@gmail.com`
   - Should show login screen
   - After authentication, should apply override automatically

3. **Test session persistence:**
   - Authenticate
   - Refresh page
   - Should remain authenticated (no login screen)

## Technical Details

### Session Storage

Sessions are stored in browser localStorage with key: `rhwb-pulse-auth`

Configuration in `src/components/supabaseClient.ts`:
```typescript
auth: {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  storageKey: 'rhwb-pulse-auth',
  storage: {
    getItem: (key) => localStorage.getItem(`rhwb-pulse-${key}`),
    setItem: (key, value) => localStorage.setItem(`rhwb-pulse-${key}`, value),
    removeItem: (key) => localStorage.removeItem(`rhwb-pulse-${key}`)
  }
}
```

### Email Override Flow

1. **Detection**: Email parameter detected in URL
2. **Storage**: Stored in `pendingOverrideEmailRef` if no session
3. **Preservation**: Preserved through authentication flow
4. **Application**: Applied after session is established
5. **Validation**: Email is validated against `v_pulse_roles` table
6. **User Context**: User context is updated to override email

## Files Modified

- `src/contexts/AuthContext.tsx`
  - Added `pendingOverrideEmailRef` for storing pending overrides
  - Enhanced initial session loading
  - Enhanced auth state change handler
  - Enhanced email override useEffect

## Future Improvements

1. Add visual indicator when override mode is active
2. Add ability to clear override and return to authenticated user
3. Add validation feedback for invalid override emails
4. Add audit logging for override usage

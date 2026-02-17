import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, supabaseValidation } from '../components/supabaseClient';
import { UserRole } from '../types/user';

const IS_DEV = process.env.NODE_ENV !== 'production';

interface AuthUser {
  email: string;
  role: UserRole;
  name?: string;
  id: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  login: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  isEmailSent: boolean;
  clearEmailSent: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Authentication audit log entry
interface AuthAuditLog {
  email_id: string;
  event_name: string;
  value_text: string | null;
  value_label?: string;
}

// Helper to log authentication events (non-blocking with timeout)
const logAuthEvent = async (logEntry: AuthAuditLog): Promise<void> => {
  try {
    // Use timeout to prevent hanging - logging should not block auth flow
    const logTimeout = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.log('[AUTH] Log event timed out (non-critical)');
        resolve();
      }, 2000);
    });

    const logPromise = supabaseValidation
      .from('pulse_interactions')
      .insert({
        email_id: logEntry.email_id,
        event_name: logEntry.event_name,
        value_text: logEntry.value_text,
        value_label: logEntry.value_label || null
      })
      .then(() => {});

    await Promise.race([logPromise, logTimeout]);
  } catch (err) {
    console.error('Failed to log auth event:', err);
  }
};

// Cache for validation requests to prevent duplicate simultaneous calls
const validationCache = new Map<string, Promise<any>>();

// Session storage keys for role caching (Phase 1: coach-portal pattern)
const SESSION_KEYS = {
  USER_ROLE: 'rhwb-pulse-session-user-role',
  USER_EMAIL: 'rhwb-pulse-session-user-email',
  SESSION_START: 'rhwb-pulse-session-start'
};

// Persistent cache for validation results
const VALIDATION_CACHE_KEY = 'rhwb-pulse-validation-cache';
const VALIDATION_CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes (for fresh queries)
const VALIDATION_CACHE_SESSION_RESTORE_MS = 30 * 60 * 1000; // 30 minutes (for session restoration)

interface CachedValidation {
  email: string;
  role: UserRole;
  fullName: string;
  timestamp: number;
}

const getCachedValidation = (email: string, isSessionRestore: boolean = false): CachedValidation | null => {
  try {
    const cached = localStorage.getItem(VALIDATION_CACHE_KEY);
    if (!cached) return null;

    const validation: CachedValidation = JSON.parse(cached);

    // Check if cache is for the same email
    if (validation.email === email.toLowerCase()) {
      const age = Date.now() - validation.timestamp;
      const expiryMs = isSessionRestore ? VALIDATION_CACHE_SESSION_RESTORE_MS : VALIDATION_CACHE_EXPIRY_MS;
      
      if (age < expiryMs) {
        console.log(`[AUTH] Using cached validation (age: ${Math.round(age / 1000)}s, session restore: ${isSessionRestore})`);
        return validation;
      } else {
        console.log(`[AUTH] Cached validation expired (age: ${Math.round(age / 1000)}s, max: ${Math.round(expiryMs / 1000)}s)`);
      }
    }
  } catch (err) {
    console.error('[AUTH] Failed to read validation cache:', err);
  }
  return null;
};

const setCachedValidation = (email: string, role: UserRole, fullName: string): void => {
  try {
    const validation: CachedValidation = {
      email: email.toLowerCase(),
      role,
      fullName,
      timestamp: Date.now()
    };
    localStorage.setItem(VALIDATION_CACHE_KEY, JSON.stringify(validation));
    console.log('[AUTH] Cached validation result');
  } catch (err) {
    console.error('[AUTH] Failed to cache validation:', err);
  }
};

const clearCachedValidation = (): void => {
  try {
    localStorage.removeItem(VALIDATION_CACHE_KEY);
    console.log('[AUTH] Cleared validation cache');
  } catch (err) {
    console.error('[AUTH] Failed to clear validation cache:', err);
  }
};

// Email-based role determination (Phase 2: fallback for timeouts)
const determineRoleFromEmail = (email: string): UserRole => {
  const lowercaseEmail = email.toLowerCase();

  // Check email patterns
  if (lowercaseEmail.includes('@admin') || lowercaseEmail.endsWith('-admin@')) {
    return 'admin';
  }
  if (lowercaseEmail.includes('@coach') || lowercaseEmail.endsWith('-coach@')) {
    return 'coach';
  }
  if (lowercaseEmail.includes('@hybrid') || lowercaseEmail.endsWith('-hybrid@')) {
    return 'hybrid';
  }

  // Default to runner
  return 'runner';
};

// Session storage helper functions (Phase 1: coach-portal pattern)
const getSessionUserRole = (email: string): { role: UserRole; fromSession: boolean } | null => {
  try {
    const sessionEmail = sessionStorage.getItem(SESSION_KEYS.USER_EMAIL);
    const sessionRole = sessionStorage.getItem(SESSION_KEYS.USER_ROLE);
    const sessionStart = sessionStorage.getItem(SESSION_KEYS.SESSION_START);

    if (sessionEmail === email.toLowerCase() && sessionRole && sessionStart) {
      console.log('[AUTH] Found role in session cache:', sessionRole);
      return { role: sessionRole as UserRole, fromSession: true };
    }
    return null;
  } catch (error) {
    console.error('[AUTH] Error reading session role:', error);
    return null;
  }
};

const saveSessionUserRole = (email: string, role: UserRole): void => {
  try {
    sessionStorage.setItem(SESSION_KEYS.USER_EMAIL, email.toLowerCase());
    sessionStorage.setItem(SESSION_KEYS.USER_ROLE, role);
    sessionStorage.setItem(SESSION_KEYS.SESSION_START, Date.now().toString());
    console.log('[AUTH] Saved role to session cache:', role);
  } catch (error) {
    console.error('[AUTH] Error saving session role:', error);
  }
};

const clearSessionUserRole = (): void => {
  try {
    sessionStorage.removeItem(SESSION_KEYS.USER_EMAIL);
    sessionStorage.removeItem(SESSION_KEYS.USER_ROLE);
    sessionStorage.removeItem(SESSION_KEYS.SESSION_START);
    console.log('[AUTH] Cleared session role cache');
  } catch (error) {
    console.error('[AUTH] Error clearing session role:', error);
  }
};

// Helper function to validate email against v_pulse_roles table
const validateEmailAccess = async (email: string, retryCount = 0, isSessionRestore: boolean = false): Promise<{
  isValid: boolean;
  role?: UserRole;
  fullName?: string;
  error?: string;
  errorType?: 'config' | 'connection' | 'timeout' | 'unauthorized' | 'not_found';
}> => {
  const cacheKey = `${email.toLowerCase()}-${retryCount}-${isSessionRestore ? 'restore' : 'normal'}`;

  // Check if there's already a pending validation for this email
  if (validationCache.has(cacheKey)) {
    IS_DEV && console.log(`[AUTH] Using cached validation request for: ${email}`);
    return validationCache.get(cacheKey)!;
  }

  // Create the validation promise
  const validationPromise = (async () => {
    try {
      return await performValidation(email, retryCount, isSessionRestore);
    } finally {
      // Remove from cache after completion (success or failure)
      validationCache.delete(cacheKey);
    }
  })();

  // Store in cache
  validationCache.set(cacheKey, validationPromise);
  return validationPromise;
};

// Internal validation logic
const performValidation = async (email: string, retryCount: number, isSessionRestore: boolean = false): Promise<{
  isValid: boolean;
  role?: UserRole;
  fullName?: string;
  error?: string;
  errorType?: 'config' | 'connection' | 'timeout' | 'unauthorized' | 'not_found';
}> => {
  try {
    // Step 0a: Check session cache FIRST (cache-first approach from coach-portal)
    if (retryCount === 0) {
      const sessionRole = getSessionUserRole(email);
      if (sessionRole) {
        console.log('[AUTH] Using cached role from session:', sessionRole.role);
        return {
          isValid: true,
          role: sessionRole.role,
          fromSession: true
        } as any; // Add fromSession flag for tracking
      }
    }

    // Step 0b: Check persistent cache (only on first attempt)
    if (retryCount === 0) {
      const cached = getCachedValidation(email);
      if (cached) {
        return {
          isValid: true,
          role: cached.role,
          fullName: cached.fullName
        };
      }
    }

    // Step 1: Validate Supabase configuration
    if (!process.env.REACT_APP_SUPABASE_URL ||
        process.env.REACT_APP_SUPABASE_URL.includes('<YOUR_SUPABASE_URL>')) {
      console.error('SECURITY: Supabase URL not configured');
      await logAuthEvent({
        email_id: email,
        event_name: 'auth_attempt',
        value_text: 'failed',
        value_label: 'missing_supabase_url'
      });
      return {
        isValid: false,
        error: 'System configuration error. Please contact support.',
        errorType: 'config'
      };
    }

    if (!process.env.REACT_APP_SUPABASE_ANON_KEY ||
        process.env.REACT_APP_SUPABASE_ANON_KEY.includes('<YOUR_SUPABASE_ANON_KEY>')) {
      console.error('SECURITY: Supabase anon key not configured');
      await logAuthEvent({
        email_id: email,
        event_name: 'auth_attempt',
        value_text: 'failed',
        value_label: 'missing_supabase_key'
      });
      return {
        isValid: false,
        error: 'System configuration error. Please contact support.',
        errorType: 'config'
      };
    }

    // Step 2: Query user role from database with timeout
    // Phase 1: Reduced timeout to 3s (coach-portal pattern)
    // Use slightly longer timeout for session restoration (5s) vs normal queries (3s)
    const queryTimeout = isSessionRestore ? 5000 : 3000;
    IS_DEV && console.log(`[AUTH] Starting validation for: ${email} (attempt ${retryCount + 1}, session restore: ${isSessionRestore}, timeout: ${queryTimeout}ms)`);
    const startTime = Date.now();

    // Try to get the current session first to trigger any initialization (with short timeout)
    // Skip this for session restore to avoid double session checks
    if (!isSessionRestore) {
      try {
        console.log('[AUTH] Pre-checking session before query...');
        const sessionCheckTimeout = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Session check timeout')), 2000);
        });
        await Promise.race([
          supabaseValidation.auth.getSession(),
          sessionCheckTimeout
        ]).catch(() => {
          console.log('[AUTH] Session check timed out or failed, proceeding anyway');
        });
      } catch (err) {
        console.log('[AUTH] Session pre-check error (continuing):', err);
      }
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), queryTimeout);
    });

    IS_DEV && console.log(`[AUTH] Executing Supabase query for: ${email}`);

    let data, error;
    try {
      // Execute the query with explicit promise handling
      const queryExecutor = async () => {
        IS_DEV && console.log(`[AUTH] Query executor started for: ${email}`);
        const result = await supabaseValidation
          .from('v_pulse_roles')
          .select('email_id, role, full_name')
          .eq('email_id', email.toLowerCase())
          .single();
        IS_DEV && console.log(`[AUTH] Query executor completed for: ${email}`, result);
        return result;
      };

      const result = await Promise.race([
        queryExecutor(),
        timeoutPromise
      ]);

      const elapsed = Date.now() - startTime;
      IS_DEV && console.log(`[AUTH] Query completed in ${elapsed}ms for: ${email}`);
      data = result.data;
      error = result.error;
    } catch (timeoutError: any) {
      // Timeout occurred
      const elapsed = Date.now() - startTime;
      IS_DEV && console.error(`[AUTH] Database query timeout after ${elapsed}ms for: ${email}`);
      error = { message: 'timeout', code: 'TIMEOUT' };
    }

    if (error) {
      console.error('SECURITY: Database query error', error);

      // Specific error handling
      if (error.code === 'PGRST116') {
        await logAuthEvent({
          email_id: email,
          event_name: 'auth_attempt',
          value_text: 'failed',
          value_label: 'table_not_found'
        });
        return {
          isValid: false,
          error: 'Authentication system error. Please contact support.',
          errorType: 'config'
        };
      }

      if (error.message?.includes('timeout') || error.code === 'TIMEOUT') {
        // Phase 2: No retry logic - use email-based fallback instead (coach-portal pattern)
        IS_DEV && console.log(`[AUTH] Query timeout, using email-based fallback for: ${email}`);

        // Determine role from email pattern as fallback
        const fallbackRole = determineRoleFromEmail(email);

        // Save fallback role to cache so subsequent requests are instant
        saveSessionUserRole(email, fallbackRole);
        setCachedValidation(email, fallbackRole, email);

        await logAuthEvent({
          email_id: email,
          event_name: 'auth_attempt',
          value_text: 'timeout_fallback',
          value_label: `fallback_role_${fallbackRole}`
        });

        return {
          isValid: true,
          role: fallbackRole,
          fullName: email,
          fromFallback: true
        } as any;
      }

      await logAuthEvent({
        email_id: email,
        event_name: 'auth_attempt',
        value_text: 'failed',
        value_label: 'database_error'
      });

      return {
        isValid: false,
        error: 'Use the same email address that you registered with Final Surge.',
        errorType: 'unauthorized'
      };
    }

    if (!data) {
      await logAuthEvent({
        email_id: email,
        event_name: 'auth_attempt',
        value_text: 'failed',
        value_label: 'user_not_found'
      });
      return {
        isValid: false,
        error: 'Email address not found in authorized users list',
        errorType: 'not_found'
      };
    }

    // Map database role to UserRole type
    const roleMapping: Record<string, UserRole> = {
      'admin': 'admin',
      'coach': 'coach',
      'hybrid': 'hybrid',
      'runner': 'runner'
    };

    const role = roleMapping[data.role] || 'runner';

    // Success - log authorization
    await logAuthEvent({
      email_id: email,
      event_name: 'auth_attempt',
      value_text: 'success',
      value_label: `role_${role}`
    });

    // Cache the validation result (both session and persistent)
    saveSessionUserRole(email, role); // Phase 1: Session cache (fastest)
    setCachedValidation(email, role, data.full_name); // Persistent cache (localStorage)

    return { isValid: true, role, fullName: data.full_name };

  } catch (error) {
    // Final catch-all: FAIL CLOSED
    console.error('SECURITY: Unexpected error in validateEmailAccess', error);

    await logAuthEvent({
      email_id: email,
      event_name: 'auth_attempt',
      value_text: 'failed',
      value_label: 'unexpected_error'
    });

    return {
      isValid: false,
      error: 'An unexpected error occurred. Please try again later.',
      errorType: 'connection'
    };
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const isLoggingOutRef = React.useRef<boolean>(false);
  const isProcessingAuthChangeRef = React.useRef<boolean>(false); // Phase 3: Request deduplication

  // Initialize auth state
  useEffect(() => {
    console.log('[AUTH INIT] Initial auth effect running');

    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('[AUTH INIT] Checking for existing session...');

        // Add timeout protection to getSession - stale sessions can cause hangs
        const sessionTimeout = new Promise<{ data: { session: Session | null } }>((resolve) => {
          setTimeout(() => {
            console.log('[AUTH INIT] Session check timed out after 5s');
            resolve({ data: { session: null } });
          }, 5000);
        });

        const { data: { session } } = await Promise.race([
          supabase.auth.getSession(),
          sessionTimeout
        ]);

        console.log('[AUTH INIT] Session found:', session ? 'YES' : 'NO');
        setSession(session);

        if (session?.user) {
          // Skip if auth state change handler is already processing (prevents race condition)
          if (isProcessingAuthChangeRef.current) {
            console.log('[AUTH INIT] Auth change already in progress, skipping initial session validation');
            return;
          }

          IS_DEV && console.log('[AUTH INIT] Validating session user (session restore):', session.user.email);

          // ALWAYS validate authenticated user first (URL override will be handled by separate useEffect)
          // Pass isSessionRestore=true to use longer cache and timeout
          const validation = await validateEmailAccess(session.user.email!, 0, true);

          if (validation.isValid && validation.role) {
            const authUser: AuthUser = {
              email: session.user.email!,
              role: validation.role,
              name: validation.fullName || session.user.user_metadata?.name || session.user.email,
              id: session.user.id
            };
            setUser(authUser);
            setIsLoading(false);

            await logAuthEvent({
              email_id: session.user.email!,
              event_name: 'session_restored',
              value_text: 'success',
              value_label: `role_${validation.role}`
            });
          } else {
            // Check if it's a timeout error - don't sign out, just show error
            if (validation.errorType === 'timeout') {
              console.error('[AUTH INIT] Session validation timeout - keeping session');
              setUser(null);
              setIsLoading(false);
            } else {
              // User is authenticated but not authorized - log them out
              await logAuthEvent({
                email_id: session.user.email!,
                event_name: 'auth_attempt',
                value_text: 'failed',
                value_label: 'not_authorized'
              });
              await supabase.auth.signOut();
              setUser(null);
              setIsLoading(false);
            }
          }
        } else {
          // No session - user must authenticate
          setUser(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[AUTH INIT] Error during initial session load:', error);
        setUser(null);
        setSession(null);
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`[AUTH STATE CHANGE] Event: ${event}, Has session: ${!!session}, Current user: ${!!user}`);

        // Phase 3: Event filtering - only process specific events
        const allowedEvents = ['SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED'];
        if (!allowedEvents.includes(event)) {
          console.log(`[AUTH STATE CHANGE] Ignoring event: ${event} (not in allowed list)`);
          return;
        }

        // Phase 3: Request deduplication - skip if already processing
        if (isProcessingAuthChangeRef.current) {
          console.log('[AUTH STATE CHANGE] Already processing auth change, skipping duplicate');
          return;
        }

        // Skip all processing if logout is in progress
        if (isLoggingOutRef.current) {
          console.log('[AUTH STATE CHANGE] Logout in progress, skipping validation');
          // Don't update state during logout - let logout function handle it
          return;
        }

        // If we're getting a SIGNED_IN event but user is currently null, it might be a spurious event after logout
        if (event === 'SIGNED_IN' && !user && session?.user) {
          console.log('[AUTH STATE CHANGE] SIGNED_IN event with no current user - may be spurious, checking...');
          // This could be legitimate (first login) or spurious (after logout)
          // We'll process it but with caution
        }

        // Phase 3: Set processing flag
        isProcessingAuthChangeRef.current = true;

        try {
          setSession(session);

          if (session?.user) {
            IS_DEV && console.log(`[AUTH STATE CHANGE] Validating user: ${session.user.email}`);

            // ALWAYS validate authenticated user first (URL override handled by separate useEffect)
            const isSessionRestore = event === 'SIGNED_IN' && !user;
            const validation = await validateEmailAccess(session.user.email!, 0, isSessionRestore);

            if (validation.isValid && validation.role) {
              const authUser: AuthUser = {
                email: session.user.email!,
                role: validation.role,
                name: validation.fullName || session.user.user_metadata?.name || session.user.email,
                id: session.user.id
              };
              setUser(authUser);
              setIsLoading(false);

              IS_DEV && console.log(`[AUTH STATE CHANGE] User set successfully: ${authUser.email} (${authUser.role})`);

              await logAuthEvent({
                email_id: session.user.email!,
                event_name: `auth_state_${event}`,
                value_text: 'success',
                value_label: `role_${validation.role}`
              });
            } else {
              // Check if it's a timeout error - don't sign out, just show error
              if (validation.errorType === 'timeout') {
                console.error('[AUTH STATE CHANGE] Validation timeout - keeping session');
                setUser(null);
                setIsLoading(false);
              } else {
                // Not authorized - sign out
                await logAuthEvent({
                  email_id: session.user.email!,
                  event_name: 'auth_attempt',
                  value_text: 'failed',
                  value_label: 'not_authorized_on_state_change'
                });
                await supabase.auth.signOut();
                setUser(null);
                setIsLoading(false);
              }
            }
          } else {
            // No session - user must authenticate
            setUser(null);
            setIsLoading(false);
          }
        } catch (error) {
          console.error('[AUTH STATE CHANGE] Error in handler:', error);
          setUser(null);
          setSession(null);
          setIsLoading(false);
        } finally {
          // Phase 3: Clear processing flag
          isProcessingAuthChangeRef.current = false;
        }
      }
    );

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      IS_DEV && console.log('[LOGIN] Starting login for:', email);

      setIsLoading(true);

      const validation = await validateEmailAccess(email, 0, false);

      if (!validation.isValid) {
        await logAuthEvent({
          email_id: email,
          event_name: 'login_attempt',
          value_text: 'failed',
          value_label: validation.errorType || 'unknown_error'
        });

        // User-friendly error messages
        let userError = validation.error || 'Email address not authorized';

        if (validation.errorType === 'config') {
          userError = 'System configuration error. Please contact your administrator.';
        } else if (validation.errorType === 'connection' || validation.errorType === 'timeout') {
          userError = 'Unable to connect to authentication service. Please check your internet connection and try again.';
        }

        return { success: false, error: userError };
      }

      // Send OTP
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase(),
        options: {
          data: {
            app: 'RHWB Pulse',
            app_domain: window.location.hostname,
            auth_method: 'otp',
            validated_role: validation.role
          }
        }
      });

      if (error) {
        await logAuthEvent({
          email_id: email,
          event_name: 'otp_send',
          value_text: 'failed',
          value_label: 'supabase_error'
        });
        return { success: false, error: error.message };
      }

      await logAuthEvent({
        email_id: email,
        event_name: 'otp_send',
        value_text: 'success',
        value_label: `role_${validation.role}`
      });

      setIsEmailSent(true);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  };



  const logout = async (): Promise<void> => {
    // Prevent multiple simultaneous logout calls
    if (isLoggingOutRef.current) {
      console.log('[LOGOUT] Logout already in progress, skipping');
      return;
    }

    try {
      isLoggingOutRef.current = true;
      console.log('[LOGOUT] Starting logout - clearing all authentication state and cache');
      
      // Clear all state IMMEDIATELY so login screen shows right away
      setUser(null);
      setSession(null);
      setIsLoading(false);
      setIsEmailSent(false);

      // Clear validation cache (both session and persistent)
      clearSessionUserRole(); // Phase 1: Clear session cache
      clearCachedValidation(); // Clear localStorage cache
      validationCache.clear(); // Clear request cache
      console.log('[LOGOUT] Cleared all validation caches');

      // Clear public laptop flag if set
      try {
        sessionStorage.removeItem('rhwb-pulse-public-laptop');
      } catch (err) {
        // Handle silently
      }

      // Clear all Supabase storage FIRST (before signOut) to prevent session recovery
      try {
        // Clear both localStorage and sessionStorage
        const storages = [localStorage, sessionStorage];
        storages.forEach(storage => {
          const keysToRemove: string[] = [];
          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key && key.startsWith('rhwb-pulse-')) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => storage.removeItem(key));
          console.log(`[LOGOUT] Cleared ${keysToRemove.length} keys from ${storage === localStorage ? 'localStorage' : 'sessionStorage'}`);
        });
      } catch (err) {
        console.error('[LOGOUT] Error clearing storage:', err);
      }

      // Sign out from Supabase with timeout protection (non-blocking)
      // Don't wait for this to complete - we've already cleared all state
      // This runs in the background and won't block the logout
      (async () => {
        try {
          const signOutTimeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Sign out timeout')), 2000);
          });

          const result = await Promise.race([
            supabase.auth.signOut(),
            signOutTimeout
          ]).catch((err) => {
            console.warn('[LOGOUT] Sign out timed out or failed (non-critical):', err);
            return { error: err };
          }) as { error?: any };

          if (result?.error) {
            console.error('[LOGOUT] Supabase sign out error:', result.error);
          } else {
            console.log('[LOGOUT] Successfully signed out from Supabase');
          }
        } catch (err) {
          console.warn('[LOGOUT] Sign out error (non-critical):', err);
        }
      })();

      // Reset logout flag immediately (don't wait for signOut to complete)
      isLoggingOutRef.current = false;
      console.log('[LOGOUT] Logout complete - login screen should be visible');
    } catch (error) {
      console.error('[LOGOUT] Error during logout:', error);
      isLoggingOutRef.current = false;
    }
  };

  const clearEmailSent = () => {
    setIsEmailSent(false);
  };

  const value: AuthContextType = {
    user,
    session,
    login,
    logout,
    isAuthenticated: !!user && !!session,
    isLoading,
    isEmailSent,
    clearEmailSent
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
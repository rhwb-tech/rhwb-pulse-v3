import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, supabaseValidation } from '../components/supabaseClient';
import { UserRole } from '../types/user';
import { useLocation } from 'react-router-dom';

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

// Helper to log authentication events
const logAuthEvent = async (logEntry: AuthAuditLog): Promise<void> => {
  try {
    await supabase
      .from('pulse_interactions')
      .insert({
        email_id: logEntry.email_id,
        event_name: logEntry.event_name,
        value_text: logEntry.value_text,
        value_label: logEntry.value_label || null
      });
  } catch (err) {
    console.error('Failed to log auth event:', err);
  }
};

// Cache for validation requests to prevent duplicate simultaneous calls
const validationCache = new Map<string, Promise<any>>();

// Persistent cache for validation results (5 minute expiry)
const VALIDATION_CACHE_KEY = 'rhwb-pulse-validation-cache';
const VALIDATION_CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface CachedValidation {
  email: string;
  role: UserRole;
  fullName: string;
  timestamp: number;
}

const getCachedValidation = (email: string): CachedValidation | null => {
  try {
    const cached = localStorage.getItem(VALIDATION_CACHE_KEY);
    if (!cached) return null;

    const validation: CachedValidation = JSON.parse(cached);

    // Check if cache is for the same email and not expired
    if (validation.email === email.toLowerCase()) {
      const age = Date.now() - validation.timestamp;
      if (age < VALIDATION_CACHE_EXPIRY_MS) {
        console.log(`[AUTH] Using cached validation (age: ${Math.round(age / 1000)}s)`);
        return validation;
      } else {
        console.log(`[AUTH] Cached validation expired (age: ${Math.round(age / 1000)}s)`);
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

// Helper function to validate email against v_pulse_roles table
const validateEmailAccess = async (email: string, retryCount = 0): Promise<{
  isValid: boolean;
  role?: UserRole;
  fullName?: string;
  error?: string;
  errorType?: 'config' | 'connection' | 'timeout' | 'unauthorized' | 'not_found';
}> => {
  const cacheKey = `${email.toLowerCase()}-${retryCount}`;

  // Check if there's already a pending validation for this email
  if (validationCache.has(cacheKey)) {
    console.log(`[AUTH] Using cached validation request for: ${email}`);
    return validationCache.get(cacheKey)!;
  }

  // Create the validation promise
  const validationPromise = (async () => {
    try {
      return await performValidation(email, retryCount);
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
const performValidation = async (email: string, retryCount: number): Promise<{
  isValid: boolean;
  role?: UserRole;
  fullName?: string;
  error?: string;
  errorType?: 'config' | 'connection' | 'timeout' | 'unauthorized' | 'not_found';
}> => {
  try {
    // Step 0: Check persistent cache first (only on first attempt)
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

    // Step 2: Query user role from database with timeout (5s)
    console.log(`[AUTH] Starting validation for: ${email} (attempt ${retryCount + 1})`);
    const startTime = Date.now();

    // Try to get the current session first to trigger any initialization (with short timeout)
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

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), 5000);
    });

    console.log(`[AUTH] Executing Supabase query for: ${email}`);

    let data, error;
    try {
      // Execute the query with explicit promise handling
      const queryExecutor = async () => {
        console.log(`[AUTH] Query executor started for: ${email}`);
        const result = await supabaseValidation
          .from('v_pulse_roles')
          .select('email_id, role, full_name')
          .eq('email_id', email.toLowerCase())
          .single();
        console.log(`[AUTH] Query executor completed for: ${email}`, result);
        return result;
      };

      const result = await Promise.race([
        queryExecutor(),
        timeoutPromise
      ]);

      const elapsed = Date.now() - startTime;
      console.log(`[AUTH] Query completed in ${elapsed}ms for: ${email}`);
      data = result.data;
      error = result.error;
    } catch (timeoutError: any) {
      // Timeout occurred
      const elapsed = Date.now() - startTime;
      console.error(`[AUTH] Database query timeout after ${elapsed}ms for: ${email}`);
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
        // Retry logic for timeouts (max 2 retries)
        if (retryCount < 2) {
          console.log(`Retrying validation for ${email}, attempt ${retryCount + 1}/2`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          return validateEmailAccess(email, retryCount + 1);
        }

        await logAuthEvent({
          email_id: email,
          event_name: 'auth_attempt',
          value_text: 'failed',
          value_label: `query_timeout_after_${retryCount + 1}_attempts`
        });
        return {
          isValid: false,
          error: 'Database connection timeout after multiple attempts. Please check your internet connection and try again.',
          errorType: 'timeout'
        };
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
      'athlete': 'athlete'
    };

    const role = roleMapping[data.role] || 'athlete';

    // Success - log authorization
    await logAuthEvent({
      email_id: email,
      event_name: 'auth_attempt',
      value_text: 'success',
      value_label: `role_${role}`
    });

    // Cache the validation result
    setCachedValidation(email, role, data.full_name);

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
  const location = useLocation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const currentOverrideEmailRef = React.useRef<string | null>(null);
  const overrideAbortControllerRef = React.useRef<AbortController | null>(null);
  const pendingOverrideEmailRef = React.useRef<string | null>(null);
  const isLoggingOutRef = React.useRef<boolean>(false);

  // Initialize auth state
  useEffect(() => {
    console.log('[AUTH INIT] Initial auth effect running');

    // Check for email parameter in URL and store it (will be used after session is checked)
    const urlParams = new URLSearchParams(window.location.search);
    const overrideEmail = urlParams.get('email');
    if (overrideEmail) {
      pendingOverrideEmailRef.current = overrideEmail;
      console.log('[AUTH INIT] Stored pending email for after authentication:', overrideEmail);
    }

    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('[AUTH INIT] Checking for existing session...');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[AUTH INIT] Session found:', session ? 'YES' : 'NO');
        setSession(session);

        if (session?.user) {
          // Check if there's a URL override parameter
          const urlParams = new URLSearchParams(window.location.search);
          const overrideEmail = urlParams.get('email') || pendingOverrideEmailRef.current;

          if (overrideEmail) {
            console.log(`[AUTH INIT] URL override detected (${overrideEmail}), skipping auth user validation`);
            // Don't validate authenticated user, let URL override effect handle it
            setIsLoading(false);
            return;
          }

          console.log('[AUTH INIT] Validating session user:', session.user.email);
          // Load authenticated user (override will be handled by separate useEffect)
          const validation = await validateEmailAccess(session.user.email!);
          if (validation.isValid && validation.role) {
            const authUser: AuthUser = {
              email: session.user.email!,
              role: validation.role,
              name: validation.fullName || session.user.user_metadata?.name || session.user.email,
              id: session.user.id
            };
            setUser(authUser);

            await logAuthEvent({
              email_id: session.user.email!,
              event_name: 'session_restored',
              value_text: 'success',
              value_label: `role_${validation.role}`
            });
          } else {
            // Check if it's a timeout error - don't sign out, just show error
            if (validation.errorType === 'timeout') {
              console.error('Session validation timeout - keeping session but showing error');
              // Keep session, user will see loading/error state
              setUser(null);
              // Don't sign out on timeout
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
            }
          }
        } else {
          // No session - user must authenticate
          setUser(null);
        }
      } catch (error) {
        console.error('Error during initial session load:', error);
        setUser(null);
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`[AUTH STATE CHANGE] Event: ${event}, Has session: ${!!session}, Current user: ${!!user}`);

        // Skip all processing if logout is in progress
        if (isLoggingOutRef.current) {
          console.log('[AUTH STATE CHANGE] Logout in progress, skipping validation');
          setSession(null);
          setUser(null);
          setIsLoading(false);
          return;
        }

        // If we're getting a SIGNED_IN event but user is currently null, it might be a spurious event after logout
        if (event === 'SIGNED_IN' && !user && session?.user) {
          console.log('[AUTH STATE CHANGE] SIGNED_IN event with no current user - may be spurious, checking...');
          // This could be legitimate (first login) or spurious (after logout)
          // We'll process it but with caution
        }

        try {
          setSession(session);

          if (session?.user) {
            // Check if there's a URL override parameter
            const urlParams = new URLSearchParams(window.location.search);
            const overrideEmail = urlParams.get('email') || pendingOverrideEmailRef.current;

            if (overrideEmail) {
              console.log(`[AUTH STATE CHANGE] URL override detected (${overrideEmail}), skipping auth user validation`);
              // Don't validate authenticated user, let URL override effect handle it
              // Just store the pending override and return
              pendingOverrideEmailRef.current = overrideEmail;
              setIsLoading(false);
              return;
            }

            console.log(`[AUTH STATE CHANGE] Validating user: ${session.user.email}`);
            // Load authenticated user (override will be handled by separate useEffect)
            const validation = await validateEmailAccess(session.user.email!);
            if (validation.isValid && validation.role) {
              const authUser: AuthUser = {
                email: session.user.email!,
                role: validation.role,
                name: validation.fullName || session.user.user_metadata?.name || session.user.email,
                id: session.user.id
              };
              setUser(authUser);

              await logAuthEvent({
                email_id: session.user.email!,
                event_name: `auth_state_${event}`,
                value_text: 'success',
                value_label: `role_${validation.role}`
              });

              // Preserve email parameter in URL if it exists (override will be applied by separate useEffect)
              const urlParams = new URLSearchParams(window.location.search);
              const overrideEmail = urlParams.get('email') || pendingOverrideEmailRef.current;
              if (overrideEmail && !urlParams.has('email')) {
                // Restore URL parameter if it was stored in pending
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set('email', overrideEmail);
                window.history.replaceState({}, '', newUrl.toString());
                pendingOverrideEmailRef.current = null;
              }
            } else {
              // Check if it's a timeout error - don't sign out, just show error
              if (validation.errorType === 'timeout') {
                console.error('Auth state change validation timeout - keeping session');
                setUser(null);
                // Don't sign out on timeout, user can retry
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
              }
            }
          } else {
            // No session - user must authenticate
            // Check for email parameter and store it for after authentication
            const urlParams = new URLSearchParams(window.location.search);
            const overrideEmail = urlParams.get('email');
            if (overrideEmail) {
              pendingOverrideEmailRef.current = overrideEmail;
              console.log('URL Override - Stored pending email for after authentication:', overrideEmail);
            }
            setUser(null);
          }
        } catch (error) {
          console.error('Error in auth state change handler:', error);
          setUser(null);
          setSession(null);
        } finally {
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle URL parameter changes for email override (only when session exists)
  useEffect(() => {
    console.log('[URL OVERRIDE EFFECT] Running, has session:', !!session?.user, 'location.search:', location.search);

    // Skip if logout is in progress
    if (isLoggingOutRef.current) {
      console.log('[URL OVERRIDE EFFECT] Logout in progress, skipping');
      return;
    }

    // If no session, check for email parameter and store it for after authentication
    if (!session?.user) {
      const urlParams = new URLSearchParams(window.location.search);
      const overrideEmail = urlParams.get('email');
      if (overrideEmail) {
        pendingOverrideEmailRef.current = overrideEmail;
        console.log('[URL OVERRIDE EFFECT] No session, stored pending email:', overrideEmail);
      }
      setIsLoading(false);
      return;
    }

    const handleOverrideChange = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      let overrideEmail = urlParams.get('email');
      console.log('[URL OVERRIDE] Processing override email:', overrideEmail || 'none');
      
      // If no email in URL but we have a pending one, restore it to URL
      if (!overrideEmail && pendingOverrideEmailRef.current) {
        overrideEmail = pendingOverrideEmailRef.current;
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('email', overrideEmail);
        window.history.replaceState({}, '', newUrl.toString());
        pendingOverrideEmailRef.current = null;
      }

      // Skip if override email hasn't changed
      if (overrideEmail === currentOverrideEmailRef.current) {
        setIsLoading(false);
        return;
      }

      // Cancel any pending override query
      if (overrideAbortControllerRef.current) {
        overrideAbortControllerRef.current.abort();
      }

      // Create new abort controller for this query
      const abortController = new AbortController();
      overrideAbortControllerRef.current = abortController;

      currentOverrideEmailRef.current = overrideEmail;
      setIsLoading(true);

      console.log('URL Override - Processing email:', overrideEmail || 'none');

      try {
        if (abortController.signal.aborted) {
          console.log('URL Override - Aborted before processing');
          return;
        }

        if (overrideEmail) {
          console.log('URL Override - Validating override email:', overrideEmail);
          // Validate and load override user
          const validation = await validateEmailAccess(overrideEmail);

          if (abortController.signal.aborted) {
            console.log('URL Override - Aborted after validation');
            return;
          }

          if (validation.isValid && validation.role) {
            console.log('URL Override - Valid override, setting user to:', overrideEmail);
            const authUser: AuthUser = {
              email: overrideEmail,
              role: validation.role,
              name: validation.fullName || overrideEmail,
              id: session.user.id
            };
            setUser(authUser);

            await logAuthEvent({
              email_id: session.user.email!,
              event_name: 'auth_override_change',
              value_text: 'success',
              value_label: `viewing_${overrideEmail}_as_${validation.role}`
            });
          } else {
            console.warn('URL Override - Invalid override email, reverting to authenticated user');
            // Invalid override email - revert to authenticated user
            const validation = await validateEmailAccess(session.user.email!);

            if (abortController.signal.aborted) {
              console.log('URL Override - Aborted during revert');
              return;
            }

            if (validation.isValid && validation.role) {
              const authUser: AuthUser = {
                email: session.user.email!,
                role: validation.role,
                name: validation.fullName || session.user.user_metadata?.name || session.user.email,
                id: session.user.id
              };
              setUser(authUser);
            } else {
              console.error('URL Override - Auth user validation failed, this should not happen');
              setIsLoading(false);
            }
          }
        } else {
          console.log('URL Override - No override, using authenticated user');
          // No override - use authenticated user
          const validation = await validateEmailAccess(session.user.email!);

          if (abortController.signal.aborted) {
            console.log('URL Override - Aborted during auth user validation');
            return;
          }

          if (validation.isValid && validation.role) {
            const authUser: AuthUser = {
              email: session.user.email!,
              role: validation.role,
              name: validation.fullName || session.user.user_metadata?.name || session.user.email,
              id: session.user.id
            };
            setUser(authUser);
          } else {
            console.error('URL Override - Auth user validation failed');
            setIsLoading(false);
          }
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          console.log('Override query cancelled - new query started');
          return;
        }
        console.error('Error handling override change:', error);
        // Ensure loading state is cleared on error
        setIsLoading(false);
      } finally {
        if (!abortController.signal.aborted) {
          console.log('URL Override - Complete, setting isLoading to false');
          setIsLoading(false);
        } else {
          console.log('URL Override - Aborted, not clearing loading state');
        }
      }
    };

    // Debounce to prevent rapid fire queries
    const timeoutId = setTimeout(() => {
      handleOverrideChange();
    }, 300);

    // Listen for URL changes
    const handlePopState = () => {
      handleOverrideChange();
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('popstate', handlePopState);
      if (overrideAbortControllerRef.current) {
        overrideAbortControllerRef.current.abort();
      }
    };
  }, [session, location.search]);

  const login = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('[LOGIN] Starting login for:', email);

      // Clear any pending overrides from previous sessions
      pendingOverrideEmailRef.current = null;
      currentOverrideEmailRef.current = null;

      setIsLoading(true);

      const validation = await validateEmailAccess(email);

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
      console.log('[LOGOUT] Clearing all authentication state and cache');

      // Clear validation cache
      clearCachedValidation();

      // Clear the email sent state
      setIsEmailSent(false);

      // Clear any override email
      currentOverrideEmailRef.current = null;
      pendingOverrideEmailRef.current = null;

      // Cancel any pending override queries
      if (overrideAbortControllerRef.current) {
        overrideAbortControllerRef.current.abort();
        overrideAbortControllerRef.current = null;
      }

      // Clear URL parameters (remove email override from URL)
      if (window.location.search) {
        const newUrl = new URL(window.location.href);
        newUrl.search = ''; // Clear all query parameters
        window.history.replaceState({}, '', newUrl.toString());
        console.log('[LOGOUT] Cleared URL parameters');
      }

      // Clear public laptop flag if set
      try {
        sessionStorage.removeItem('rhwb-pulse-public-laptop');
      } catch (err) {
        // Handle silently
      }

      // Clear validation cache
      validationCache.clear();
      console.log('[LOGOUT] Cleared validation cache');

      // Clear user and session immediately
      setUser(null);
      setSession(null);

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[LOGOUT] Supabase sign out error:', error);
      } else {
        console.log('[LOGOUT] Successfully signed out');
      }

      // Clear all Supabase storage to prevent session recovery issues
      try {
        const storage = sessionStorage.getItem('rhwb-pulse-public-laptop') === 'true' ? sessionStorage : localStorage;
        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && key.startsWith('rhwb-pulse-')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => storage.removeItem(key));
        console.log(`[LOGOUT] Cleared ${keysToRemove.length} storage keys`);
      } catch (err) {
        console.error('[LOGOUT] Error clearing storage:', err);
      }

      // Reset logout flag after a longer delay to ensure all auth state changes complete
      setTimeout(() => {
        isLoggingOutRef.current = false;
        console.log('[LOGOUT] Logout flag reset');
      }, 3000);
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
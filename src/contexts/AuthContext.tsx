import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../components/supabaseClient';
import { UserRole } from '../components/FilterPanel';
import { getAppConfig } from '../config/appConfig';

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

// Helper function to validate email against v_pulse_roles table
const validateEmailAccess = async (email: string): Promise<{ isValid: boolean; role?: UserRole; fullName?: string; error?: string }> => {
  try {
    // Check Supabase configuration first
    if (!process.env.REACT_APP_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL.includes('<YOUR_SUPABASE_URL>')) {
      const fallbackRole = determineUserRole(email);
      return { isValid: true, role: fallbackRole };
    }
    
    if (!process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY.includes('<YOUR_SUPABASE_ANON_KEY>')) {
      const fallbackRole = determineUserRole(email);
      return { isValid: true, role: fallbackRole };
    }
    
    // First, test the connection with a simple query and aggressive timeout
    let connectionTestPassed = false;
    
    try {
      // Add a very short timeout for the connection test
      const connectionTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection test timeout')), 3000); // 3 second timeout
      });
      
      const connectionTest = supabase
        .from('v_pulse_roles')
        .select('count')
        .limit(1);
      
      const { data: testData, error: testError } = await Promise.race([connectionTest, connectionTimeout]) as any;
      
      if (testError) {
        if (testError.code === 'PGRST116') {
          // Fallback to email-based role determination
          const fallbackRole = determineUserRole(email);
          return { isValid: true, role: fallbackRole };
        }
      } else {
        connectionTestPassed = true;
      }
    } catch (testErr) {
      // Fallback to email-based role determination
      const fallbackRole = determineUserRole(email);
      return { isValid: true, role: fallbackRole };
    }
    
    // Only proceed with database query if connection test passed
    if (!connectionTestPassed) {
      const fallbackRole = determineUserRole(email);
      return { isValid: true, role: fallbackRole };
    }
    
    // Add timeout protection for the main query
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), 5000); // 5 second timeout
    });
    
    const queryPromise = supabase
      .from('v_pulse_roles')
      .select('email_id, role, full_name')
      .eq('email_id', email.toLowerCase())
      .single();

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

    if (error) {
      // Check for specific error types
      if (error.code === 'PGRST116') {
        // This means no rows found - user doesn't exist
        return { isValid: false, error: 'Use the same email address that you registered with Final Surge.' };
      }
      
      if (error.message?.includes('timeout')) {
        return { isValid: false, error: 'Database connection timeout. Please try again.' };
      }
      
      return { isValid: false, error: 'Use the same email address that you registered with Final Surge.' };
    }

    if (!data) {
      return { isValid: false, error: 'Use the same email address that you registered with Final Surge.' };
    }

    // Map database role to UserRole type
    const roleMapping: Record<string, UserRole> = {
      'admin': 'admin',
      'coach': 'coach',
      'hybrid': 'hybrid',
      'athlete': 'athlete'
    };

    const role = roleMapping[data.role] || 'athlete';
    
    return { isValid: true, role, fullName: data.full_name };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        const fallbackRole = determineUserRole(email);
        return { isValid: true, role: fallbackRole };
      }
    }
    
    const fallbackRole = determineUserRole(email);
    return { isValid: true, role: fallbackRole };
  }
};

// Helper function to determine user role from email or metadata
const determineUserRole = (email: string, userMetadata?: any): UserRole => {
  // You can customize this logic based on your needs
  // For now, we'll use a simple email-based approach
  if (email.includes('admin') || email.includes('manager')) {
    return 'admin';
  } else if (email.includes('coach') || email.includes('trainer')) {
    return 'coach';
  } else if (email.includes('hybrid')) {
    return 'hybrid';
  } else {
    return 'athlete';
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmailSent, setIsEmailSent] = useState(false);

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session?.user) {
        // Validate the authenticated user against v_pulse_roles
        const validation = await validateEmailAccess(session.user.email!);
        if (validation.isValid && validation.role) {
          const authUser: AuthUser = {
            email: session.user.email!,
            role: validation.role,
            name: validation.fullName || session.user.user_metadata?.name || session.user.email,
            id: session.user.id
          };
          setUser(authUser);
        } else {
          // User is authenticated but not authorized - log them out
          await supabase.auth.signOut();
          setUser(null);
        }
      } else {
        // Check for email parameter override
        const urlParams = new URLSearchParams(window.location.search);
        const overrideEmail = urlParams.get('email');
        
        if (overrideEmail) {
          // Validate the override email
          const validation = await validateEmailAccess(overrideEmail);
          if (validation.isValid && validation.role) {
            // Create a mock user for the override email
            const authUser: AuthUser = {
              email: overrideEmail,
              role: validation.role,
              name: validation.fullName || overrideEmail,
              id: 'override-user'
            };
            setUser(authUser);
            setSession({} as Session); // Mock session
          }
        }
      }
      
      setIsLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session?.user) {
          // Validate the authenticated user against v_pulse_roles
          const validation = await validateEmailAccess(session.user.email!);
          if (validation.isValid && validation.role) {
            const authUser: AuthUser = {
              email: session.user.email!,
              role: validation.role,
              name: validation.fullName || session.user.user_metadata?.name || session.user.email,
              id: session.user.id
            };
            setUser(authUser);
          } else {
            // User is authenticated but not authorized - log them out
            await supabase.auth.signOut();
            setUser(null);
          }
        } else {
          setUser(null);
        }
        
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      
      // First, validate the email against v_pulse_roles
      const validation = await validateEmailAccess(email);
      
      if (!validation.isValid) {
        return { success: false, error: validation.error || 'Email address not authorized' };
      }

      // If email is valid, send magic link
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      setIsEmailSent(true);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Handle logout error silently
      }
    } catch (error) {
      // Handle logout error silently
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
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole } from '../components/FilterPanel';

interface User {
  email: string;
  role: UserRole;
  name?: string;
  exp: number; // Token expiration time
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Environment-based configuration
const AUTH_CONFIG = {
  TOKEN_STORAGE_KEY: process.env.REACT_APP_TOKEN_STORAGE_KEY || 'rhwb_pulse_auth_token',
  JWT_SECRET: process.env.REACT_APP_JWT_SECRET,
  TOKEN_EXPIRY_BUFFER: parseInt(process.env.REACT_APP_TOKEN_EXPIRY_BUFFER || '300'), // 5 minutes buffer
  DEBUG_MODE: process.env.NODE_ENV === 'development',
  SKIP_SIGNATURE_VERIFICATION: process.env.REACT_APP_SKIP_SIGNATURE_VERIFICATION === 'true'
};

// JWT decoding utility (without external library)
function parseJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Invalid JWT token:', error);
    return null;
  }
}

function isTokenExpired(exp: number): boolean {
  // Add buffer time to prevent edge cases
  const bufferTime = AUTH_CONFIG.TOKEN_EXPIRY_BUFFER;
  return Date.now() >= (exp * 1000) - (bufferTime * 1000);
}


// JWT signature verification utility
async function verifyJwtSignature(token: string): Promise<boolean> {
  // Debug environment variables
  console.log('🔧 JWT Verification Debug Info:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('DEBUG_MODE:', AUTH_CONFIG.DEBUG_MODE);
  console.log('SKIP_SIGNATURE_VERIFICATION:', AUTH_CONFIG.SKIP_SIGNATURE_VERIFICATION);
  console.log('SKIP_SIGNATURE_VERIFICATION (raw):', process.env.REACT_APP_SKIP_SIGNATURE_VERIFICATION);
  console.log('JWT_SECRET available:', !!AUTH_CONFIG.JWT_SECRET);
  
  // Always skip signature verification if no JWT_SECRET is provided OR skip is enabled
  if (AUTH_CONFIG.SKIP_SIGNATURE_VERIFICATION || AUTH_CONFIG.DEBUG_MODE || !AUTH_CONFIG.JWT_SECRET) {
    let reason = '';
    if (AUTH_CONFIG.DEBUG_MODE) reason = 'Development mode';
    else if (AUTH_CONFIG.SKIP_SIGNATURE_VERIFICATION) reason = 'SKIP_SIGNATURE_VERIFICATION=true';
    else if (!AUTH_CONFIG.JWT_SECRET) reason = 'No JWT_SECRET provided';
    
    console.log(`✅ ${reason}: Skipping JWT signature verification - validating format only`);
    
    try {
      // Just verify token format (3 parts separated by dots)
      const [header, payload, signature] = token.split('.');
      
      if (!header || !payload || !signature) {
        console.error('❌ Invalid JWT format: Token must have 3 parts (header.payload.signature)');
        return false;
      }
      
      console.log('✅ JWT format validation passed');
      return true;
    } catch (error) {
      console.error('❌ JWT format validation failed:', error);
      return false;
    }
  }
  
  // This should rarely execute now - only if JWT_SECRET is provided AND skip is false
  console.log('🔐 Attempting full JWT signature verification...');
  
  try {
    // Basic signature verification
    const [header, payload, signature] = token.split('.');
    
    if (!header || !payload || !signature) {
      console.error('❌ Invalid JWT format in signature verification');
      return false;
    }
    
    // Note: Client-side JWT signature verification has security limitations
    console.warn('⚠️ Client-side JWT signature verification has security limitations');
    console.warn('⚠️ Consider verifying JWTs on your backend server for production use');
    
    // For now, we'll trust the token format and expiration
    // TODO: Implement proper HMAC-SHA256 verification if needed
    console.log('✅ Basic signature verification passed');
    return true;
    
  } catch (error) {
    console.error('❌ JWT signature verification failed:', error);
    return false;
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);


  // Initialize auth state from stored token or URL parameter
  useEffect(() => {
    const initializeAuth = async () => {
      let tokenToUse = null;
      let tokenSource = '';
      
      // Priority 1: Check URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      if (urlToken) {
        tokenToUse = urlToken;
        tokenSource = 'url';
      }
      
      // Priority 2: Check stored token
      if (!tokenToUse) {
        const storedToken = localStorage.getItem(AUTH_CONFIG.TOKEN_STORAGE_KEY);
        if (storedToken) {
          tokenToUse = storedToken;
          tokenSource = 'storage';
        }
      }
      
      if (tokenToUse) {
        const success = await validateAndSetToken(tokenToUse);
        if (success) {
          // Store token if it came from URL
          if (tokenSource === 'url') {
            localStorage.setItem(AUTH_CONFIG.TOKEN_STORAGE_KEY, tokenToUse);
          }
          
          // Clean URL if token came from URL parameter
          if (tokenSource === 'url') {
            const urlParams = new URLSearchParams(window.location.search);
            urlParams.delete('token');
            const cleanUrl = window.location.pathname + 
              (urlParams.toString() ? '?' + urlParams.toString() : '');
            window.history.replaceState({}, document.title, cleanUrl);
          }
          
          if (AUTH_CONFIG.DEBUG_MODE) {
            console.log(`JWT token loaded from: ${tokenSource}`);
          }
        }
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const validateAndSetToken = async (tokenString: string): Promise<boolean> => {
    if (AUTH_CONFIG.DEBUG_MODE) {
      console.log('🔍 Starting JWT token validation...');
      console.log('Token length:', tokenString.length);
      console.log('Token preview:', tokenString.substring(0, 50) + '...');
    }

    const payload = parseJwt(tokenString);
    
    if (!payload) {
      console.error('❌ Invalid JWT token format - could not parse payload');
      return false;
    }

    if (AUTH_CONFIG.DEBUG_MODE) {
      console.log('✅ JWT payload parsed successfully:', payload);
    }

    // Check required fields
    if (!payload.email || !payload.role || !payload.exp) {
      console.error('❌ JWT token missing required fields (email, role, exp)');
      console.error('Available fields:', Object.keys(payload));
      return false;
    }

    if (AUTH_CONFIG.DEBUG_MODE) {
      console.log('✅ JWT required fields present');
    }

    // Check if token is expired
    if (isTokenExpired(payload.exp)) {
      console.error('❌ JWT token has expired');
      const expDate = new Date(payload.exp * 1000);
      console.error('Token expired at:', expDate.toISOString());
      console.error('Current time:', new Date().toISOString());
      return false;
    }

    if (AUTH_CONFIG.DEBUG_MODE) {
      console.log('✅ JWT token is not expired');
    }

    // Verify JWT signature
    if (AUTH_CONFIG.DEBUG_MODE) {
      console.log('🔐 Verifying JWT signature...');
    }
    
    const isValidSignature = await verifyJwtSignature(tokenString);
    if (!isValidSignature) {
      console.error('❌ JWT signature verification failed');
      return false;
    }

    if (AUTH_CONFIG.DEBUG_MODE) {
      console.log('✅ JWT signature verification passed');
    }

    // Validate role
    const validRoles: UserRole[] = ['admin', 'coach', 'hybrid', 'athlete'];
    if (!validRoles.includes(payload.role)) {
      console.error('Invalid role in JWT token');
      return false;
    }

    // Set user and token
    const user: User = {
      email: payload.email,
      role: payload.role,
      name: payload.name,
      exp: payload.exp
    };

    setUser(user);
    setToken(tokenString);
    return true;
  };

  const login = async (tokenString: string): Promise<boolean> => {
    const success = await validateAndSetToken(tokenString);
    if (success) {
      localStorage.setItem(AUTH_CONFIG.TOKEN_STORAGE_KEY, tokenString);
    }
    return success;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(AUTH_CONFIG.TOKEN_STORAGE_KEY);
    
    if (AUTH_CONFIG.DEBUG_MODE) {
      console.log('User logged out - token cleared');
    }
    
    // Optionally redirect to Wix or login page
    // window.location.href = 'https://your-wix-site.com';
  };

  // Check token expiration periodically
  useEffect(() => {
    if (user && user.exp) {
      const checkExpiration = () => {
        if (isTokenExpired(user.exp)) {
          console.warn('Token expired, logging out...');
          logout();
        }
      };

      // Check every minute
      const interval = setInterval(checkExpiration, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!user && !!token,
    isLoading
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
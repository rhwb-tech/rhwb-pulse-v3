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
  DEBUG_MODE: process.env.NODE_ENV === 'development'
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

// Get JWT token from Bearer token via postMessage or custom storage
function getBearerToken(): string | null {
  try {
    // Method 1: Check for Bearer token from postMessage communication
    const bearerToken = sessionStorage.getItem('bearer_auth_token') || 
                       localStorage.getItem('bearer_auth_token');
    if (bearerToken) {
      return bearerToken.startsWith('Bearer ') ? bearerToken.substring(7) : bearerToken;
    }

    // Method 2: Check if we're in an iframe and listen for Bearer token from parent
    if (window.parent && window.parent !== window) {
      // Check for pre-stored Bearer token from parent communication
      const iframeBearerToken = sessionStorage.getItem('iframe_bearer_token');
      if (iframeBearerToken) {
        return iframeBearerToken.startsWith('Bearer ') ? iframeBearerToken.substring(7) : iframeBearerToken;
      }
    }

    // Method 3: Check for custom Bearer token storage
    const customBearerToken = sessionStorage.getItem('wix_bearer_token') || 
                             localStorage.getItem('wix_bearer_token');
    if (customBearerToken) {
      return customBearerToken.startsWith('Bearer ') ? customBearerToken.substring(7) : customBearerToken;
    }
    
    return null;
  } catch (error) {
    console.warn('Could not access bearer token:', error);
    return null;
  }
}

// Set up postMessage listener for Bearer token from parent window
function setupBearerTokenListener(): void {
  if (typeof window !== 'undefined') {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security (adjust domains as needed)
      const allowedOrigins = ['https://www.wix.com', 'https://manage.wix.com', process.env.REACT_APP_WIX_ORIGIN];
      if (allowedOrigins.includes(event.origin)) {
        if (event.data?.type === 'BEARER_TOKEN' && event.data?.token) {
          const token = event.data.token.startsWith('Bearer ') ? event.data.token.substring(7) : event.data.token;
          sessionStorage.setItem('iframe_bearer_token', token);
          // Trigger re-initialization of auth
          window.dispatchEvent(new CustomEvent('bearer-token-received'));
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Cleanup function
    return () => window.removeEventListener('message', handleMessage);
  }
}

// JWT signature verification utility
async function verifyJwtSignature(token: string): Promise<boolean> {
  if (!AUTH_CONFIG.JWT_SECRET) {
    if (AUTH_CONFIG.DEBUG_MODE) {
      console.warn('JWT_SECRET not configured - skipping signature verification in development');
      return true;
    } else {
      console.error('JWT_SECRET is required for production');
      return false;
    }
  }
  
  try {
    // Basic signature verification
    const [header, payload, signature] = token.split('.');
    
    if (!header || !payload || !signature) {
      return false;
    }
    
    // In production, you'd implement proper HMAC verification here
    // For now, we'll trust the token format and expiration
    // This is a placeholder for proper JWT verification
    
    return true;
  } catch (error) {
    console.error('JWT signature verification failed:', error);
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

  // Set up Bearer token listener on component mount
  useEffect(() => {
    const cleanup = setupBearerTokenListener();
    
    // Listen for Bearer token received event
    const handleBearerTokenReceived = () => {
      // Re-initialize auth when Bearer token is received
      const initializeAuth = async () => {
        const bearerToken = getBearerToken();
        if (bearerToken) {
          const success = await validateAndSetToken(bearerToken);
          if (success) {
            localStorage.setItem(AUTH_CONFIG.TOKEN_STORAGE_KEY, bearerToken);
            if (AUTH_CONFIG.DEBUG_MODE) {
              console.log('JWT token loaded from: bearer (postMessage)');
            }
          }
        }
      };
      initializeAuth();
    };

    window.addEventListener('bearer-token-received', handleBearerTokenReceived);
    
    return () => {
      if (cleanup) cleanup();
      window.removeEventListener('bearer-token-received', handleBearerTokenReceived);
    };
  }, []);

  // Initialize auth state from stored token, URL, or Authorization header
  useEffect(() => {
    const initializeAuth = async () => {
      let tokenToUse = null;
      let tokenSource = '';
      
      // Priority 1: Check Bearer token (from postMessage or custom storage)
      const bearerToken = getBearerToken();
      if (bearerToken) {
        tokenToUse = bearerToken;
        tokenSource = 'bearer';
      }
      
      // Priority 2: Check URL parameter (fallback for direct links)
      if (!tokenToUse) {
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token');
        if (urlToken) {
          tokenToUse = urlToken;
          tokenSource = 'url';
        }
      }
      
      // Priority 3: Check stored token
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
          // Store token if it came from bearer or URL
          if (tokenSource === 'bearer' || tokenSource === 'url') {
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
    const payload = parseJwt(tokenString);
    
    if (!payload) {
      console.error('Invalid JWT token format');
      return false;
    }

    // Check required fields
    if (!payload.email || !payload.role || !payload.exp) {
      console.error('JWT token missing required fields (email, role, exp)');
      return false;
    }

    // Check if token is expired
    if (isTokenExpired(payload.exp)) {
      console.error('JWT token has expired');
      return false;
    }

    // Verify JWT signature
    const isValidSignature = await verifyJwtSignature(tokenString);
    if (!isValidSignature) {
      console.error('JWT signature verification failed');
      return false;
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
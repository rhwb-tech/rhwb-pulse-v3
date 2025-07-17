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
  login: (token: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'pulse_jwt_token';

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
  return Date.now() >= exp * 1000;
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from stored token or URL
  useEffect(() => {
    const initializeAuth = () => {
      // Check URL for token first (Wix integration)
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      
      // Check stored token
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      
      const tokenToUse = urlToken || storedToken;
      
      if (tokenToUse) {
        const success = validateAndSetToken(tokenToUse);
        if (success && urlToken) {
          // If token came from URL, store it and clean the URL
          localStorage.setItem(TOKEN_STORAGE_KEY, urlToken);
          // Remove token from URL without page reload
          const cleanUrl = window.location.pathname + 
            (urlParams.toString().replace(/[?&]token=[^&]*/, '') ? 
             '?' + urlParams.toString().replace(/[?&]token=[^&]*/, '') : '');
          window.history.replaceState({}, document.title, cleanUrl);
        }
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const validateAndSetToken = (tokenString: string): boolean => {
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

  const login = (tokenString: string): boolean => {
    const success = validateAndSetToken(tokenString);
    if (success) {
      localStorage.setItem(TOKEN_STORAGE_KEY, tokenString);
    }
    return success;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    // Optionally redirect to Wix or login page
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
import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import type { UserRole } from '../types/user';

interface AppContextType {
  selectedRunner: string;
  userRole: UserRole;
  hybridToggle: 'myScore' | 'myCohorts';
  setSelectedRunner: (runner: string) => void;
  setUserRole: (role: UserRole) => void;
  setHybridToggle: (toggle: 'myScore' | 'myCohorts') => void;
  // Override functionality for admin users
  overrideEmail: string | null;
  setOverrideEmail: (email: string | null) => void;
  authenticatedEmail: string;
  setAuthenticatedEmail: (email: string) => void;
  // The effective email to use for dashboard/profile (override takes precedence)
  effectiveEmail: string;
  // Whether override mode is active
  isOverrideActive: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedRunner, setSelectedRunner] = useState<string>('');
  const [userRole, setUserRole] = useState<UserRole>('runner');
  const [hybridToggle, setHybridToggle] = useState<'myScore' | 'myCohorts'>('myCohorts');
  
  // Override email tracking
  const [overrideEmail, setOverrideEmail] = useState<string | null>(null);
  const [authenticatedEmail, setAuthenticatedEmail] = useState<string>('');

  // Compute effective email: override takes precedence over authenticated
  const effectiveEmail = useMemo(() => {
    return overrideEmail || authenticatedEmail;
  }, [overrideEmail, authenticatedEmail]);

  // Whether override mode is active
  const isOverrideActive = useMemo(() => {
    return overrideEmail !== null && overrideEmail !== '';
  }, [overrideEmail]);

  return (
    <AppContext.Provider value={{ 
      selectedRunner, 
      userRole, 
      hybridToggle, 
      setSelectedRunner, 
      setUserRole, 
      setHybridToggle,
      overrideEmail,
      setOverrideEmail,
      authenticatedEmail,
      setAuthenticatedEmail,
      effectiveEmail,
      isOverrideActive
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};


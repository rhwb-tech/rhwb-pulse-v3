import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { UserRole } from '../components/FilterPanel';

interface AppContextType {
  selectedRunner: string;
  userRole: UserRole;
  hybridToggle: 'myScore' | 'myCohorts';
  setSelectedRunner: (runner: string) => void;
  setUserRole: (role: UserRole) => void;
  setHybridToggle: (toggle: 'myScore' | 'myCohorts') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedRunner, setSelectedRunner] = useState<string>('');
  const [userRole, setUserRole] = useState<UserRole>('athlete');
  const [hybridToggle, setHybridToggle] = useState<'myScore' | 'myCohorts'>('myCohorts');

  return (
    <AppContext.Provider value={{ selectedRunner, userRole, hybridToggle, setSelectedRunner, setUserRole, setHybridToggle }}>
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


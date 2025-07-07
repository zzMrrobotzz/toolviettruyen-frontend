import React, { createContext, useState, useContext, ReactNode } from 'react';
import { ApiSettings, ApiProvider } from './types';
import { DEFAULT_API_PROVIDER } from './constants';

const API_BASE = "https://key-manager-backend.onrender.com/api";

interface AppContextType {
  apiSettings: ApiSettings;
  setApiSettings: React.Dispatch<React.SetStateAction<ApiSettings>>;
  key: string;
  setKey: React.Dispatch<React.SetStateAction<string>>;
}

const defaultApiSettings: ApiSettings = {
  provider: DEFAULT_API_PROVIDER as ApiProvider,
  apiKey: '',
  apiBase: API_BASE,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [apiSettings, setApiSettings] = useState<ApiSettings>(defaultApiSettings);
  const [key, setKey] = useState<string>('');

  const value = { apiSettings, setApiSettings, key, setKey };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}; 
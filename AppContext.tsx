import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { KeyInfo, ApiSettings, ApiProvider } from './types';
import { DEFAULT_API_PROVIDER } from './constants';
import { API_BASE_URL } from './config';

interface AppContextType {
  keyInfo: KeyInfo | null;
  isLoading: boolean;
  error: string | null;
  validateKey: (key: string) => Promise<boolean>;
  updateCredit: (newCredit: number) => void; // <--- THAY ĐỔI Ở ĐÂY
  logout: () => void;
  apiSettings: ApiSettings;
  setApiSettings: React.Dispatch<React.SetStateAction<ApiSettings>>;
  getAvailableAIProviders: () => Promise<string[]>;
  consumeCredit: (amount: number) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [apiSettings, setApiSettings] = useState<ApiSettings>(() => {
    const savedSettings = localStorage.getItem('apiSettings');
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings);
      } catch (e) {
        console.error("Failed to parse apiSettings from localStorage", e);
      }
    }
    return {
      provider: DEFAULT_API_PROVIDER as ApiProvider,
      apiBase: '',
    };
  });

  useEffect(() => {
    localStorage.setItem('apiSettings', JSON.stringify(apiSettings));
  }, [apiSettings]);

  const validateKey = useCallback(async (key: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/keys/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      if (data.success) {
        setKeyInfo(data.keyInfo);
        localStorage.setItem('user_key', key);
        setError(null);
        return true;
      } else {
        setKeyInfo(null);
        localStorage.removeItem('user_key');
        setError(data.message || 'Key không hợp lệ hoặc đã hết hạn.');
        return false;
      }
    } catch (err) {
      setError('Lỗi kết nối đến máy chủ. Vui lòng thử lại.');
      setKeyInfo(null);
      localStorage.removeItem('user_key');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Hàm mới để cập nhật credit một cách an toàn
  const updateCredit = useCallback((newCredit: number) => {
    if (typeof newCredit === 'number' && !isNaN(newCredit)) {
      setKeyInfo(prev => prev ? { ...prev, credit: newCredit } : null);
    }
  }, []);

  const logout = useCallback(() => {
    setKeyInfo(null);
    localStorage.removeItem('user_key');
    setError(null);
  }, []);

  const getAvailableAIProviders = useCallback(async (): Promise<string[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/providers`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('user_key')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch AI providers');
      }
      
      const data = await response.json();
      // Assuming the backend returns an array of provider objects
      return data.map((provider: any) => provider.name) || [];
    } catch (error) {
      console.error('Error fetching AI providers:', error);
      return ['gemini']; // Fallback to default
    }
  }, []);

  const consumeCredit = useCallback(async (amount: number): Promise<boolean> => {
    if (!keyInfo || typeof keyInfo.credit !== 'number') return false;
    if (keyInfo.credit < amount) return false;
    updateCredit(keyInfo.credit - amount);
    return true;
  }, [keyInfo, updateCredit]);

  useEffect(() => {
    const savedKey = localStorage.getItem('user_key');
    if (savedKey) {
      validateKey(savedKey);
    } else {
      setIsLoading(false);
    }
  }, [validateKey]);

  const contextValue = {
    keyInfo,
    isLoading,
    error,
    validateKey,
    updateCredit, // <--- THAY ĐỔI Ở ĐÂY
    logout,
    apiSettings,
    setApiSettings,
    getAvailableAIProviders,
    consumeCredit,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

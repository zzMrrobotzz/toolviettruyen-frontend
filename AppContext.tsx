import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { KeyInfo, ApiSettings, ApiProvider } from './types';
import { DEFAULT_API_PROVIDER } from './constants';

interface AppContextType {
  keyInfo: KeyInfo | null;
  isLoading: boolean;
  error: string | null;
  validateKey: (key: string) => Promise<boolean>;
  consumeCredit: (cost?: number) => Promise<boolean>;
  logout: () => void;
  apiSettings: ApiSettings;
  setApiSettings: React.Dispatch<React.SetStateAction<ApiSettings>>;
  // Thêm method để lấy AI provider từ backend
  getAvailableAIProviders: () => Promise<string[]>;
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
      const response = await fetch('/api/keys/validate', {
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
        setError('Key không hợp lệ hoặc đã hết hạn.');
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

  const consumeCredit = useCallback(async (cost: number = 1): Promise<boolean> => {
    const keyToUse = keyInfo?.key || localStorage.getItem('user_key');
    console.log('Gọi use-credit với:', { key: keyToUse, amount: cost });
    if (!keyToUse || !keyInfo || keyInfo.credit < cost) {
      setError('Bạn không đủ credit để thực hiện hành động này.');
      return false;
    }
    try {
      const optimisticKeyInfo = { ...keyInfo, credit: keyInfo.credit - cost };
      setKeyInfo(optimisticKeyInfo);

      const response = await fetch('/api/keys/use-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyToUse, amount: cost }),
      });

      const data = await response.json();

      if (data.success) {
        setKeyInfo(prev => prev ? { ...prev, credit: data.credit } : null);
        return true;
      } else {
        setKeyInfo(keyInfo); 
        setError(data.message || 'Có lỗi xảy ra khi trừ credit.');
        return false;
      }
    } catch (err) {
      setKeyInfo(keyInfo);
      setError('Lỗi mạng khi đang cố gắng trừ credit.');
      return false;
    }
  }, [keyInfo]);

  const logout = useCallback(() => {
    setKeyInfo(null);
    localStorage.removeItem('user_key');
    setError(null);
  }, []);

  const getAvailableAIProviders = useCallback(async (): Promise<string[]> => {
    try {
      const response = await fetch('/api/providers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('user_key')}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch AI providers');
      }
      
      const data = await response.json();
      return data.providers || [];
    } catch (error) {
      console.error('Error fetching AI providers:', error);
      return ['gemini']; // Fallback to default
    }
  }, []);

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
    consumeCredit,
    logout,
    apiSettings,
    setApiSettings,
    getAvailableAIProviders,
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

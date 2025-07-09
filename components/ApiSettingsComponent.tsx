
import React, { useState, useEffect } from 'react';
import { ApiSettings, ApiProvider } from '../types';
import { useAppContext } from '../AppContext';

const ApiSettingsComponent: React.FC = () => {
  const { apiSettings, setApiSettings, getAvailableAIProviders } = useAppContext();
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAvailableProviders();
  }, []);

  const loadAvailableProviders = async () => {
    try {
      setLoading(true);
      const providers = await getAvailableAIProviders();
      setAvailableProviders(providers);
    } catch (error) {
      console.error('Error loading providers:', error);
      // Fallback to default providers
      setAvailableProviders(['gemini']);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setApiSettings(prev => ({
      ...prev,
      provider: e.target.value as ApiProvider,
    }));
  };

  return (
    <div className="bg-gray-50 p-6 rounded-lg mb-8 border-2 border-gray-200">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">⚙️ Cài Đặt AI</h3>
      <div className="grid md:grid-cols-1 gap-6">
        <div>
          <label htmlFor="apiProvider" className="block text-sm font-medium text-gray-700 mb-1">
            Chọn nhà cung cấp AI:
          </label>
          <select
            id="apiProvider"
            value={apiSettings.provider}
            onChange={handleProviderChange}
            disabled={loading}
            className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            {loading ? (
              <option>Đang tải danh sách...</option>
            ) : (
              availableProviders.map(provider => (
                <option key={provider} value={provider}>
                  {provider === 'gemini' ? 'Google Gemini' : 
                   provider === 'openai' ? 'OpenAI (ChatGPT)' :
                   provider === 'deepseek' ? 'DeepSeek' :
                   provider === 'stability' ? 'Stability AI' :
                   provider === 'elevenlabs' ? 'ElevenLabs' :
                   provider.charAt(0).toUpperCase() + provider.slice(1)}
                </option>
              ))
            )}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Danh sách các AI provider được cấu hình bởi admin. API keys được quản lý tập trung và bảo mật.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ApiSettingsComponent;
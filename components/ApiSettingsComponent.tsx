
import React from 'react';
import { ApiSettings, ApiProvider } from '../types';

interface ApiSettingsProps {
  apiSettings: ApiSettings;
  setApiSettings: (settings: ApiSettings) => void;
}

const ApiSettingsComponent: React.FC<ApiSettingsProps> = ({ apiSettings, setApiSettings }) => {
  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setApiSettings({ ...apiSettings, provider: e.target.value as ApiProvider, apiKey: '' }); // Reset API key when provider changes for non-Gemini
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiSettings({ ...apiSettings, apiKey: e.target.value });
  };

  const getApiKeyLabel = () => {
    if (apiSettings.provider === 'minimax') {
      return 'MiniMax (GROUP_ID:API_KEY):';
    }
    return 'API Key (Văn bản):';
  };
  
  const getApiKeyPlaceholder = () => {
    if (apiSettings.provider === 'gemini') {
      return "Nhập API Key Gemini (nếu trống, dùng key từ cấu hình)";
    }
    return "Nhập API Key của bạn";
  }

  return (
    <div className="bg-gray-50 p-6 rounded-lg mb-8 border-2 border-gray-200">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">⚙️ Cài Đặt AI</h3>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="apiProvider" className="block text-sm font-medium text-gray-700 mb-1">
            Chọn nhà cung cấp AI (Văn bản):
          </label>
          <select
            id="apiProvider"
            value={apiSettings.provider}
            onChange={handleProviderChange}
            className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            <option value="gemini">Google Gemini (Mặc định)</option>
            <option value="deepseek">DeepSeek</option>
            {/* 
            <option value="openai">OpenAI (ChatGPT)</option>
            <option value="grok">Grok (xAI)</option>
            <option value="minimax">Minimax (abab)</option>
            */}
          </select>
        </div>
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
            {getApiKeyLabel()}
          </label>
          <input
            type="password"
            id="apiKey"
            value={apiSettings.apiKey}
            onChange={handleApiKeyChange}
            placeholder={getApiKeyPlaceholder()}
            className="w-full p-3 border-2 border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
           {apiSettings.provider === 'gemini' && (
            <p className="text-xs text-gray-500 mt-1">
              Nếu để trống, API Key Gemini từ cấu hình môi trường sẽ được sử dụng. Nếu nhập, key này sẽ được ưu tiên.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiSettingsComponent;
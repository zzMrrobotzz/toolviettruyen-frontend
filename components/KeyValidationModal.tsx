
import React, { useState } from 'react';
import { useAppContext } from '../AppContext';
import LoadingSpinner from './LoadingSpinner';

const KeyValidationModal: React.FC = () => {
  const [inputKey, setInputKey] = useState('');
  const { validateKey, isLoading, error } = useAppContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputKey.trim()) {
      await validateKey(inputKey.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full transform transition-all duration-300 scale-100">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Xác thực quyền truy cập</h2>
          <p className="text-gray-600 mb-6">Vui lòng nhập Key của bạn để sử dụng công cụ.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="apiKey" className="sr-only">API Key</label>
            <input
              id="apiKey"
              type="text"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Nhập Key của bạn ở đây..."
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              disabled={isLoading}
            />
          </div>
          
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-lg" role="alert">
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
            disabled={isLoading}
          >
            {isLoading ? <LoadingSpinner /> : 'Xác thực và tiếp tục'}
          </button>
        </form>
        <div className="text-center mt-6">
            <p className="text-sm text-gray-500">
                Chưa có key? <a href="https://zalo.me/0925263981" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-medium">Liên hệ để mua</a>
            </p>
        </div>
      </div>
    </div>
  );
};

export default KeyValidationModal;

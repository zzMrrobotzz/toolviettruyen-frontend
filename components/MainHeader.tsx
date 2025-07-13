
import React from 'react';
import { useAppContext } from '../AppContext';
import { FaCoins } from 'react-icons/fa';
import { FiLogOut } from 'react-icons/fi';

const MainHeader: React.FC = () => {
  const { keyInfo, logout } = useAppContext();

  return (
    <header className="bg-gradient-to-r from-slate-800 to-sky-700 text-white p-6 rounded-t-2xl shadow-lg relative">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          Tool Viết Truyện AI Story - ALL IN ONE
        </h1>
        <p className="text-lg font-medium opacity-90">
          Sáng Tạo Bởi Đức Đại MMO
        </p>
      </div>
      {keyInfo && (
        <div className="absolute top-4 right-4 flex items-center space-x-4">
          <div className="flex items-center bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 text-lg font-semibold">
            <FaCoins className="text-yellow-400 mr-2" />
            <span>{(keyInfo.credit || 0).toLocaleString()} Credits</span>
          </div>
          <button 
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 text-white rounded-full p-3 transition-colors duration-200 shadow-md"
            title="Đăng xuất"
          >
            <FiLogOut size={20} />
          </button>
        </div>
      )}
    </header>
  );
};

export default MainHeader;

import React, { useState, useEffect } from 'react';
import { ActiveModule } from '../types';
import { NAVIGATION_ITEMS } from '../constants';
import axios from 'axios';
import { useAppContext } from '../AppContext';

interface SidebarProps {
  activeModule: ActiveModule;
  setActiveModule: (module: ActiveModule) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeModule, setActiveModule }) => {
  const { apiSettings, key } = useAppContext();

  return (
    <aside className="w-64 bg-gray-800 text-gray-300 p-5 flex flex-col h-screen fixed top-0 left-0 overflow-y-auto">
      <div className="text-center mb-8">
        <div className="flex flex-col items-center">
          <span className="text-2xl font-semibold text-white">AI Story</span>
          <span className="text-xl font-semibold text-white -mt-0.5"> 
            ALL IN ONE
          </span>
        </div>
        <div className="bg-white/10 text-white py-1 px-3 rounded-full text-xs font-bold inline-block mt-2">
          Phiên Bản 1.1
        </div>
      </div>
      <nav className="flex-grow">
        {NAVIGATION_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveModule(item.id)}
            className={`flex items-center w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ease-in-out font-medium text-sm mb-1.5
                        ${activeModule === item.id 
                            ? 'bg-indigo-600 text-white shadow-md' 
                            : 'hover:bg-gray-700 hover:text-white'
                        }`}
          >
            <span className="mr-3">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <CreditBox apiBase={apiSettings.apiBase} currentKey={key} />
    </aside>
  );
};

const CreditBox: React.FC<{ apiBase: string, currentKey: string }> = ({ apiBase, currentKey }) => {
  const [credit, setCredit] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCredit = async () => {
    if (!currentKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${apiBase}/validate`, { key: currentKey });
      setCredit(res.data?.keyInfo?.credit ?? 0);
    } catch (err) {
      setError('Lỗi!');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCredit();
    const interval = setInterval(fetchCredit, 30000);
    return () => clearInterval(interval);
  }, [currentKey, apiBase]);

  return (
    <div style={{ margin: '24px 0 0 0', padding: 12, borderRadius: 10, background: 'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)', textAlign: 'center', boxShadow: '0 2px 8px #0001' }}>
      <div style={{ color: '#fff', fontWeight: 600, fontSize: 15, marginBottom: 2 }}>💳 Credit còn lại</div>
      <div style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 2 }}>{loading && credit === null ? '...' : (credit !== null ? credit : '?')}</div>
      {error && <div style={{ color: '#ffd6d6', fontSize: 12 }}>{error}</div>}
      <button
        onClick={fetchCredit}
        style={{ marginTop: 4, padding: '2px 10px', borderRadius: 6, border: 'none', background: '#fff', color: '#1e90ff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
        disabled={loading}
      >
        {loading ? '...' : 'Làm mới'}
      </button>
    </div>
  );
};

export default Sidebar;

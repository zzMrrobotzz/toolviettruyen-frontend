import React from 'react';
import { NAVIGATION_ITEMS } from '../constants';
import { ActiveModule } from '../types';
import { useAppContext } from '../AppContext';

interface SidebarProps {
  activeModule: ActiveModule;
  setActiveModule: (module: ActiveModule) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeModule, setActiveModule }) => {
  const { keyInfo } = useAppContext();

  return (
    <aside className="w-64 bg-slate-800 text-white fixed top-0 left-0 h-full overflow-y-auto shadow-lg">
      <div className="p-6 text-center">
        <h2 className="text-2xl font-bold text-sky-400">Tool Viết Truyện</h2>
        <p className="text-sm opacity-80">By Đức Đại MMO</p>
      </div>
      <nav>
        <ul>
          {NAVIGATION_ITEMS.map(item => (
            <li key={item.id} className="px-4 py-1">
              <button
                onClick={() => setActiveModule(item.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center space-x-3
                  ${activeModule === item.id 
                    ? 'bg-sky-500 shadow-inner' 
                    : 'hover:bg-slate-700 hover:translate-x-1'
                  }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {keyInfo && (
        <div className="p-4 mt-4 border-t border-slate-700 text-center text-xs">
          <p>Key: <span className="font-mono">{keyInfo.key}</span></p>
          <p>Credits: <span className="font-bold text-yellow-400">{keyInfo.credit.toLocaleString()}</span></p>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;

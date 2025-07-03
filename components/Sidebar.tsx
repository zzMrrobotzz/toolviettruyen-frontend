
import React from 'react';
import { ActiveModule } from '../types';
import { NAVIGATION_ITEMS } from '../constants';

interface SidebarProps {
  activeModule: ActiveModule;
  setActiveModule: (module: ActiveModule) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeModule, setActiveModule }) => {
  return (
    <aside className="w-64 bg-gray-800 text-gray-300 p-5 flex flex-col h-screen fixed top-0 left-0 overflow-y-auto">
      <div className="text-center mb-8">
        {/* Updated title structure */}
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
    </aside>
  );
};

export default Sidebar;
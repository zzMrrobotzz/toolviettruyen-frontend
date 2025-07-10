import React, { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminDashboard from './pages/AdminDashboard';
import AdminApiKeyManagement from './pages/AdminApiKeyManagement';
import AdminApiProviders from './pages/AdminApiProviders';
import AdminApiMonitoring from './pages/AdminApiMonitoring';
import AdminBilling from './pages/AdminBilling';
import AdminSuspiciousActivity from './pages/AdminSuspiciousActivity';
import AdminLogin from './pages/AdminLogin';
import AdminSettings from './pages/AdminSettings';
import ErrorBoundary from './components/ErrorBoundary';
import { AdminActiveModule } from './types';

const AdminApp: React.FC = () => {
  const [activeModule, setActiveModule] = useState<AdminActiveModule>('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('admin_logged_in'));

  const handleLogout = () => {
    localStorage.removeItem('admin_logged_in');
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return (
      <ErrorBoundary>
        <AdminLogin onLogin={() => setIsLoggedIn(true)} />
      </ErrorBoundary>
    );
  }

  const renderActiveModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'keyManagement':
        return <AdminApiKeyManagement />;
      case 'apiProviders':
        return <AdminApiProviders />;
      case 'apis':
        return <AdminApiMonitoring />;
      case 'billing': 
        return <AdminBilling />;
      case 'suspiciousActivity':
        return <AdminSuspiciousActivity />;
      case 'settings':
        return <AdminSettings />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-gray-100 font-sans">
        <AdminSidebar activeModule={activeModule} setActiveModule={setActiveModule} onLogout={handleLogout} />
        <main className="flex-1 ml-64 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary>
              {renderActiveModule()}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default AdminApp; 
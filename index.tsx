
import React from 'react';
import ReactDOM from 'react-dom/client';

// Robust app initialization with comprehensive error handling
async function initializeApp() {
  try {
    // Pre-validate environment
    if (typeof window === 'undefined') {
      throw new Error('Window object not available');
    }
    
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Could not find root element to mount to');
    }

    // Load components with timeout
    const modulePromise = Promise.race([
      Promise.all([
        import('./App'),
        import('./components/ErrorBoundary')
      ]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Module loading timeout')), 10000)
      )
    ]);

    const [{ default: App }, { default: ErrorBoundary }] = await modulePromise as [any, any];

    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
    
    console.log('✅ App initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    
    // Fallback UI
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 500px;">
            <h1 style="color: #1976d2; margin-bottom: 16px;">🚀 AI Story Creator Studio</h1>
            <p style="color: #666; margin-bottom: 24px;">Đang khởi tạo ứng dụng, vui lòng đợi một chút...</p>
            <div style="margin-bottom: 24px;">
              <div style="width: 100%; height: 4px; background: #f0f0f0; border-radius: 2px; overflow: hidden;">
                <div style="width: 60%; height: 100%; background: linear-gradient(90deg, #1976d2, #42a5f5); animation: loading 2s ease-in-out infinite;"></div>
              </div>
            </div>
            <button onclick="window.location.reload()" style="padding: 12px 24px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">Thử lại</button>
          </div>
          <style>
            @keyframes loading { 0% { transform: translateX(-100%); } 50% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
          </style>
        </div>
      `;
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
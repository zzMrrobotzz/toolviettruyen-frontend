import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  },
  base: './',
  define: {
    // Complete browser environment compatibility
    'process.env.NODE_ENV': '"production"',
    'global': 'globalThis',
    'process': 'globalThis.process',
    'require': 'undefined',
  },
  resolve: {
    alias: {
      // Prevent Node.js modules from causing issues
      'buffer': 'buffer',
      'process': 'process/browser',
    }
  },
  optimizeDeps: {
    include: ['buffer', 'process']
  },
  build: {
    sourcemap: false,
    target: 'es2015',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        }
      }
    }
  }
});

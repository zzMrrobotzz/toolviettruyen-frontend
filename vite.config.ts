import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A clean Vite configuration, removing all potentially problematic polyfills.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  },
  base: './',
  // All custom 'define', 'resolve.alias', and 'optimizeDeps' have been removed.
  // If the build fails with a specific error like "process is not defined",
  // we will add back the necessary polyfills in a safer way.
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
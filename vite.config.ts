import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  define: {
    // Simple static definitions to prevent runtime errors
    'process.env.NODE_ENV': '"production"',
    'global': 'globalThis',
  },
  build: {
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

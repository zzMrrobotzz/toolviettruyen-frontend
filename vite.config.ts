import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  define: {
    // Complete browser environment compatibility
    'process.env.NODE_ENV': '"production"',
    'global': 'globalThis',
    'process': 'globalThis.process',
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
    minify: false, // Disable minification for debugging
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

import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || 'default_key'),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || 'default_key'),
        'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY || 'default_key'),
        'process.env.ELEVENLABS_API_KEY': JSON.stringify(env.ELEVENLABS_API_KEY || 'default_key'),
        'process.env.STABILITY_API_KEY': JSON.stringify(env.STABILITY_API_KEY || 'default_key'),
        global: 'globalThis',
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        include: ['react', 'react-dom']
      },
      build: {
        target: 'es2015',
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              antd: ['antd']
            }
          }
        }
      }
    };
});

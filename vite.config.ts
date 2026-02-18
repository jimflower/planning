import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/proxy/login': {
        target: 'https://login.procore.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/login/, ''),
        secure: true,
      },
      '/proxy/api': {
        target: 'https://api.procore.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/api/, ''),
        secure: true,
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});

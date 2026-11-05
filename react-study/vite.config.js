import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  server: {
    port: 5176,
    open: false,
    allowedHosts: [
      'bbwildmaster.com' // Allows Nginx to forward this clean domain
    ],
    hmr: {
      protocol: 'wss',
      host: 'bbwildmaster.com',
    }
  },
});

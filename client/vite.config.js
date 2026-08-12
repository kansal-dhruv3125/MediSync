import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration for the React app.
// The client uses relative API URLs (see src/services/api.js). In
// development, Vite proxies API calls to the Express/JSON Server backend on
// port 3001; in production the Express server serves both the app and the
// API from the same origin, so no proxy is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/medications': 'http://localhost:3001',
    },
  },
})

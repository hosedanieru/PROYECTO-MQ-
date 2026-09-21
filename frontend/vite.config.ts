import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    /**
     * En desarrollo, el navegador llama a `/api/...` en el mismo origen
     * (localhost:5173) y Vite reenvía la petición al backend. Así no hay
     * CORS que configurar y el código del frontend no conoce el puerto
     * del backend: en producción `/api` lo resuelve el servidor web.
     */
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})

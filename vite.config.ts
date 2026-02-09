import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'backend/public', // Output build files to backend/public
    emptyOutDir: true, // Clean the output directory before building
  },
})

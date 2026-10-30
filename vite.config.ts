import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@appdeploy/client": path.resolve(__dirname, "src/appdeploy/client.ts")
    }
  }
})

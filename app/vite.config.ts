import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // relative asset paths: the built app works from any folder or host (itch.io, GitHub Pages, a zip)
})

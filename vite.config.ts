import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths, so the built `dist` folder works whether it is served
  // from a domain root (Netlify, Vercel) or a subfolder (GitHub Pages project
  // site). With the default '/' the subfolder case 404s on every asset.
  base: './',
  plugins: [react()],
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

// `npm run build:single` produces one self-contained HTML file (dist-single/index.html)
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // single mode: one classic (non-module) script at the end of <body>, so it also runs in previewers that sandbox or rewrite pages
  build: mode === 'single' ? { outDir: 'dist-single', modulePreload: false, rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } } } : {},
}))

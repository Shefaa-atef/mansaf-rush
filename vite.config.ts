import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    // three.js is ~700 kB minified by itself and is only fetched with the lazy 3D scene chunk.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // The engine gets its own chunk: it downloads in parallel with the scene code and stays
        // cached across deploys that only touch game code.
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three';
        },
      },
    },
  },
});

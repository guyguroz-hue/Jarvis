import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // exposes the dev server on your LAN so you can test on a phone
    port: 5173,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        /**
         * Split the heavy engines into their own chunks so the HUD shell paints
         * before they load.
         *
         * This is a FUNCTION, not a static { three: [...] } map, on purpose: a
         * static map forces those packages into the bundle even when nothing
         * imports them yet, shipping dead weight in the early phases. This form
         * only splits modules that actually made it into the graph.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // Match on path segments so a package merely NAMED '...three...'
          // can't be swept into the wrong chunk.
          if (/node_modules\/(three|@react-three)\//.test(id)) return 'three'
          if (/node_modules\/@mediapipe\//.test(id)) return 'mediapipe'
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
        },
      },
    },
  },
})

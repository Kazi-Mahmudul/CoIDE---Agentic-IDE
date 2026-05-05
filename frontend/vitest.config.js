import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    css: false,
    deps: {
      optimizer: {
        web: {
          include: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-search',
                    '@xterm/addon-serialize', '@xterm/addon-web-links', '@xterm/addon-unicode11'],
        },
      },
    },
  },
})

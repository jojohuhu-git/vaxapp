import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/vaxapp/',
  plugins: [react()],
  test: {
    // Default environment for logic-engine tests. UI rendering tests opt into
    // happy-dom per-file with `// @vitest-environment happy-dom` at the top.
    environment: 'node',
    // Loaded for ALL tests; safe in node (it's a no-op until DOM matchers
    // are accessed) and provides matchers like toBeInTheDocument for UI tests.
    setupFiles: ['./src/test-setup.js'],
  },
})

import { defineConfig } from 'vitest/config';

// H8 fix: vitest.config.js takes precedence over the `test` block in vite.config.js
// when both files are present. Move ALL vitest configuration here so it is actually
// applied. The `test` block in vite.config.js is kept as documentation only.
export default defineConfig({
  test: {
    // Default environment for logic-engine tests. UI rendering tests opt into
    // happy-dom per-file with `// @vitest-environment happy-dom` at the top.
    environment: 'node',
    // Loaded for ALL tests; safe in node (it's a no-op until DOM matchers
    // are accessed) and provides matchers like toBeInTheDocument for UI tests.
    setupFiles: ['./src/test-setup.js'],
    // The cool-elbakyan optimal-schedule test is a standalone Node assert
    // script, not a vitest suite. Run it via `npm run test:optimal`.
    // Step 4 of the master plan will rewrite this as a true vitest suite.
    exclude: ['**/buildOptimalSchedule.test.js', '**/node_modules/**', '**/.claude/worktrees/**'],
  },
});

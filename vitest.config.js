import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The cool-elbakyan optimal-schedule test is a standalone Node assert
    // script, not a vitest suite. Run it via `npm run test:optimal`.
    // Step 4 of the master plan will rewrite this as a true vitest suite.
    exclude: ['**/buildOptimalSchedule.test.js', '**/node_modules/**'],
  },
});

// Vitest global setup. Loaded once per test file via vite.config.js setupFiles.
//
// jest-dom extends `expect` with DOM matchers (toBeInTheDocument, toHaveTextContent,
// etc.). Importing it has no side effects in node — it only attaches matchers.
//
// React Testing Library cleanup runs after each test to unmount components and
// reset the DOM. Without this, a previous test's DOM leaks into the next one
// and queries return stale nodes. Wrapped in try/catch so the import is safe
// in node-environment tests (where @testing-library/react would fail to load
// because there's no DOM).
import '@testing-library/jest-dom/vitest';

if (typeof document !== 'undefined') {
  const { afterEach } = await import('vitest');
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => cleanup());
}

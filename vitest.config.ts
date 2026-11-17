import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  // Gives tests the same `@/` imports and auto-imports as the extension,
  // plus an in-memory fake `browser` API (storage, runtime, tabs).
  plugins: [WxtVitest()],
  test: {
    // jsdom gives tests a DOM to run repair and extraction logic against.
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
  },
});

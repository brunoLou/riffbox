import { defineConfig } from 'vitest/config';

// Unit tests: pure logic only (no browser, no build plugins).
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});

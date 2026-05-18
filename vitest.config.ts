import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './src',
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['core/**/*.ts', 'reporting/**/*.ts'],
      exclude: ['**/*.test.ts', 'extension/**', 'test-fixtures/**'],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90
      },
      reporter: ['text', 'text-summary', 'lcov']
    }
  }
});

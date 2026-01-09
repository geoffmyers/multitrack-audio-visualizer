import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.ts', 'cli/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist', 'public'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'public/**',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/types/**',
        'cli/index.ts',
        'src/main.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});

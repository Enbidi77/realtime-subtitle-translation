import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts', 'apps/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@echo-lingo/contracts': path.resolve(__dirname, 'packages/contracts/src'),
      '@echo-lingo/config': path.resolve(__dirname, 'packages/config/src'),
      '@echo-lingo/subtitle-core': path.resolve(__dirname, 'packages/subtitle-core/src'),
      '@echo-lingo/translation-core': path.resolve(__dirname, 'packages/translation-core/src'),
      '@echo-lingo/speech-core': path.resolve(__dirname, 'packages/speech-core/src'),
      '@echo-lingo/provider-adapters': path.resolve(__dirname, 'packages/provider-adapters/src'),
      '@echo-lingo/database': path.resolve(__dirname, 'packages/database/src'),
      '@echo-lingo/ocr-core': path.resolve(__dirname, 'packages/ocr-core/src'),
      '@echo-lingo/test-utils': path.resolve(__dirname, 'packages/test-utils/src'),
      '@echo-lingo/logger': path.resolve(__dirname, 'packages/logger/src'),
      '@echo-lingo/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@': path.resolve(__dirname, 'apps/desktop/src/renderer'),
    },
  },
});

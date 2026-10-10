import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const workspacePackages = [
  '@echo-lingo/contracts',
  '@echo-lingo/config',
  '@echo-lingo/subtitle-core',
  '@echo-lingo/translation-core',
  '@echo-lingo/speech-core',
  '@echo-lingo/provider-adapters',
  '@echo-lingo/database',
  'zod',
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
    resolve: {
      alias: {
        '@echo-lingo/contracts': resolve(__dirname, '../../packages/contracts/src'),
        '@echo-lingo/config': resolve(__dirname, '../../packages/config/src'),
        '@echo-lingo/subtitle-core': resolve(__dirname, '../../packages/subtitle-core/src'),
        '@echo-lingo/translation-core': resolve(__dirname, '../../packages/translation-core/src'),
        '@echo-lingo/speech-core': resolve(__dirname, '../../packages/speech-core/src'),
        '@echo-lingo/provider-adapters': resolve(__dirname, '../../packages/provider-adapters/src'),
        '@echo-lingo/database': resolve(__dirname, '../../packages/database/src'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@echo-lingo/contracts', 'zod'] })],
    resolve: {
      alias: {
        '@echo-lingo/contracts': resolve(__dirname, '../../packages/contracts/src'),
      },
    },
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          overlay: resolve(__dirname, 'src/renderer/overlay.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
        '@echo-lingo/contracts': resolve(__dirname, '../../packages/contracts/src'),
        '@echo-lingo/config': resolve(__dirname, '../../packages/config/src'),
        '@echo-lingo/subtitle-core': resolve(__dirname, '../../packages/subtitle-core/src'),
      },
    },
  },
});

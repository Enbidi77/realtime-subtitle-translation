import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Prevent Electron from running in Node mode when launched from VS Code debug sessions
delete process.env.ELECTRON_RUN_AS_NODE;

const workspacePackages = [
  '@echo-lingo/contracts',
  '@echo-lingo/config',
  '@echo-lingo/subtitle-core',
  '@echo-lingo/translation-core',
  '@echo-lingo/speech-core',
  '@echo-lingo/provider-adapters',
  '@echo-lingo/dotnet-bridge',
  '@echo-lingo/database',
  '@echo-lingo/ocr-core',
  '@echo-lingo/logger',
  '@echo-lingo/shared',
  'zod',
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
    build: {
      sourcemap: true,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/main'),
        '@echo-lingo/contracts': resolve(__dirname, '../../packages/contracts/src'),
        '@echo-lingo/config': resolve(__dirname, '../../packages/config/src'),
        '@echo-lingo/logger': resolve(__dirname, '../../packages/logger/src'),
        '@echo-lingo/shared': resolve(__dirname, '../../packages/shared/src'),
        '@echo-lingo/subtitle-core': resolve(__dirname, '../../packages/subtitle-core/src'),
        '@echo-lingo/translation-core': resolve(__dirname, '../../packages/translation-core/src'),
        '@echo-lingo/speech-core': resolve(__dirname, '../../packages/speech-core/src'),
        '@echo-lingo/provider-adapters': resolve(__dirname, '../../packages/provider-adapters/src'),
        '@echo-lingo/dotnet-bridge': resolve(__dirname, '../../packages/dotnet-bridge/src'),
        '@echo-lingo/database': resolve(__dirname, '../../packages/database/src'),
        '@echo-lingo/ocr-core': resolve(__dirname, '../../packages/ocr-core/src'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@echo-lingo/contracts', 'zod'] })],
    build: {
      sourcemap: true,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/preload'),
        '@preload': resolve(__dirname, 'src/preload'),
        '@echo-lingo/contracts': resolve(__dirname, '../../packages/contracts/src'),
        '@echo-lingo/ocr-core': resolve(__dirname, '../../packages/ocr-core/src'),
      },
    },
  },
  renderer: {
    plugins: [react()],
    publicDir: resolve(__dirname, 'src/renderer/public'),
    build: {
      sourcemap: true,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          overlay: resolve(__dirname, 'src/renderer/overlay.html'),
          selection: resolve(__dirname, 'src/renderer/selection.html'),
          'ocr-panel': resolve(__dirname, 'src/renderer/ocr-panel.html'),
          splash: resolve(__dirname, 'src/renderer/splash.html'),
          'radial-menu': resolve(__dirname, 'src/renderer/radial-menu.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
        '@preload': resolve(__dirname, 'src/preload'),
        '@echo-lingo/contracts': resolve(__dirname, '../../packages/contracts/src'),
        '@echo-lingo/config': resolve(__dirname, '../../packages/config/src'),
        '@echo-lingo/subtitle-core': resolve(__dirname, '../../packages/subtitle-core/src'),
        '@echo-lingo/ocr-core': resolve(__dirname, '../../packages/ocr-core/src'),
        '@echo-lingo/logger': resolve(__dirname, '../../packages/logger/src/browser.ts'),
      },
    },
  },
});

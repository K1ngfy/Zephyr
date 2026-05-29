import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      emptyOutDir: false,
      rollupOptions: {
        input: {
          background: path.resolve(__dirname, 'src/background.ts'),
        },
        output: {
          entryFileNames: 'background.js',
          format: 'iife' as const
        }
      }
    }
  };
});

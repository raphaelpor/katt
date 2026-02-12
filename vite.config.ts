import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    outDir: 'dist',
    emptyOutDir: true,
    target: 'node18',
    rollupOptions: {
      external: [
        /^node:/,
        /^@github\/copilot-sdk$/,
        /^@github\/copilot(\/|$)/,
        /^vscode-jsonrpc(\/|$)/,
        /^zod$/,
      ],
      output: {
        banner: '#!/usr/bin/env node',
      },
    },
  },
  plugins: [
    dts({
      entryRoot: 'src',
      outDir: 'dist',
      rollupTypes: true,
    }),
  ],
});

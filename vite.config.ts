import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        katt: 'src/cli.ts',
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
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
        banner: (chunk) => (chunk.fileName === 'katt.js' ? '#!/usr/bin/env node' : ''),
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

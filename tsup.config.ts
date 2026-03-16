import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['bin/miyagi.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist/bin',
  clean: true,
  sourcemap: true,
  dts: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});

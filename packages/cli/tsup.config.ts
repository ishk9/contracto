import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'bin/contractcheck.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
});

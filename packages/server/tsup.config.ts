import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: ['src/index.ts', 'src/main.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  async onSuccess() {
    const destDir = join(root, 'dist', 'migrations');
    mkdirSync(destDir, { recursive: true });
    copyFileSync(
      join(root, 'src', 'store', 'sqlite', 'migrations', '001_initial.sql'),
      join(destDir, '001_initial.sql'),
    );
  },
});

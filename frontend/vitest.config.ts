import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export default defineConfig({
  root: projectRoot,
  esbuild: { jsx: 'automatic' },
  cacheDir: resolve(projectRoot, '.cache/vite'),
  resolve: {
    alias: [
      { find: /^@app\/api$/, replacement: resolve(projectRoot, '../package/api/index.ts') },
      { find: /^@app\/awcp$/, replacement: resolve(projectRoot, '../package/awcp/index.ts') },
      { find: /^@app\/ui$/, replacement: resolve(projectRoot, '../package/ui/index.ts') },
      { find: /^react-dom(?=\/|$)/, replacement: dirname(require.resolve('react-dom/package.json')) },
      { find: /^react(?=\/|$)/, replacement: dirname(require.resolve('react/package.json')) }
    ],
    dedupe: ['react', 'react-dom']
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { execArgv: Number(process.versions.node.split('.')[0]) >= 25 ? ['--no-experimental-webstorage'] : [] } },
    minWorkers: 1,
    maxWorkers: 1,
    clearMocks: true
  }
});

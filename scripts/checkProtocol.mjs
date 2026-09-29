import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const allowedScopes = new Set(['ant-design', 'app', 'swc', 'types', 'typescript-eslint']);
for (const name of [...Object.keys(manifest.dependencies), ...Object.keys(manifest.devDependencies)]) {
  assertAllowedScopes(name, 'package.json');
}
assert.equal(manifest.dependencies.ajv, '8.20.0');
assert.equal(manifest.dependencies.dayjs, '1.11.10');

const bridge = readFileSync(resolve(root, 'package/awcp/bridge.ts'), 'utf8');
assert.match(bridge, /protocolVersion: 1 as const/);
for (const method of ['manual', 'invoke', 'cancel']) assert.match(bridge, new RegExp(`\\b${method}\\(`));

const scanPaths = ['src', 'tests', 'package', 'build', 'scripts'];
const configPaths = ['package.json', 'webpack.config.cjs', 'vitest.config.ts', 'tsconfig.json'];
for (const path of scanPaths) {
  for (const file of files(resolve(root, path))) {
    const content = readFileSync(file, 'utf8');
    assertAllowedScopes(content, file);
    if (path === 'build') assertNoSiblingPath(content, file);
  }
}
for (const path of configPaths) {
  const content = readFileSync(resolve(root, path), 'utf8');
  assertAllowedScopes(content, path);
  assertNoSiblingPath(content, path);
}
process.stdout.write('Local AWCP source and dependency boundaries are consistent.\n');

function assertAllowedScopes(content, file) {
  for (const match of content.matchAll(/@([a-z][a-z0-9-]*)\//g)) {
    assert.ok(allowedScopes.has(match[1]), `Unexpected package scope @${match[1]}/ in ${file}`);
  }
}

function assertNoSiblingPath(content, file) {
  if (/['"`]\.\.\/[^'"`]+/.test(content)) throw new Error(`Sibling project path in ${file}`);
}

function* files(path) {
  for (const item of readdirSync(path, { withFileTypes: true })) {
    const child = resolve(path, item.name);
    if (item.isDirectory()) yield* files(child);
    else if (item.isFile()) yield child;
  }
}

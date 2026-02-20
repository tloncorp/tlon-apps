import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(packageRoot, 'dist');
const sourcePackagePath = path.resolve(packageRoot, 'package.json');

const sourcePackage = JSON.parse(await readFile(sourcePackagePath, 'utf8'));

const publishExports = {
  '.': './index.js',
  './lib/utilityTypes': './lib/utilityTypes.d.ts',
  './lib/*': './lib/*.js',
  './urbit': './urbit/index.js',
  './urbit/*': './urbit/*.js',
  './http-api': './http-api/index.js',
  './http-api/*': './http-api/*.js',
  './types': './types/index.js',
  './types/*': './types/*.js',
  './package.json': './package.json',
};

const publishPackage = {
  name: sourcePackage.name,
  version: sourcePackage.version,
  type: 'module',
  main: './index.js',
  types: './index.d.ts',
  exports: publishExports,
  files: ['**/*'],
  sideEffects: false,
  dependencies: sourcePackage.dependencies,
  publishConfig: {
    access: 'public',
    provenance: true,
  },
};

await mkdir(distDir, { recursive: true });
await writeFile(
  path.resolve(distDir, 'package.json'),
  `${JSON.stringify(publishPackage, null, 2)}\n`
);

const readmePath = path.resolve(packageRoot, 'README.md');
try {
  await copyFile(readmePath, path.resolve(distDir, 'README.md'));
} catch {
  // README is optional for publish builds.
}

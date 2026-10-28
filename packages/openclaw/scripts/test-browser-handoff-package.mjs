import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pluginRoot = fileURLToPath(new URL('../', import.meta.url));
const apiRoot = join(pluginRoot, '../api');
const tempRoot = mkdtempSync(join(tmpdir(), 'tlon-browser-package-'));
const modules = join(tempRoot, 'node_modules');

function dependencyDirectory(root, name) {
  for (let directory = root; ; directory = dirname(directory)) {
    const candidate = join(directory, 'node_modules', name);
    if (existsSync(candidate)) return realpathSync(candidate);
    if (dirname(directory) === directory) {
      throw new Error(`Dependency is not installed: ${name}`);
    }
  }
}

function installBuiltPackage(root) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const target = join(modules, pkg.name);
  mkdirSync(target, { recursive: true });
  cpSync(join(root, 'package.json'), join(target, 'package.json'));
  for (const entry of pkg.files) {
    if (existsSync(join(root, entry))) {
      cpSync(join(root, entry), join(target, entry), { recursive: true });
    }
  }
  for (const name of Object.keys({
    ...pkg.dependencies,
    ...pkg.peerDependencies,
  })) {
    if (name === '@tloncorp/api' || name === '@tloncorp/openclaw') continue;
    const destination = join(modules, name);
    if (existsSync(destination)) continue;
    mkdirSync(dirname(destination), { recursive: true });
    symlinkSync(dependencyDirectory(root, name), destination, 'dir');
  }
  return target;
}

try {
  const api = installBuiltPackage(apiRoot);
  const plugin = installBuiltPackage(pluginRoot);
  // Real directories under node_modules expose Node's package-loading rules;
  // workspace symlinks and TypeScript test loaders do not exercise that boundary.
  assert.equal(realpathSync(api), api);
  const entry = pathToFileURL(
    join(plugin, 'dist/src/browser-session-handoff.js')
  ).href;
  const stdout = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    import { isTrustedBrowserViewerHost, MAX_BROWSER_VIEWER_URL_LENGTH } from '@tloncorp/api';
    const { runBrowserSessionHandoff } = await import(${JSON.stringify(entry)});
    assert.equal(MAX_BROWSER_VIEWER_URL_LENGTH, 2048);
    assert.equal(isTrustedBrowserViewerHost('browser-session-ovh2.tlon.network'), true);
    assert.equal(isTrustedBrowserViewerHost('browser-session.tlon.network.evil.example'), false);
    const help = await runBrowserSessionHandoff('unused', ['browser', '--help'], {});
    assert.match(help, /browser handoff <session_id>/);
    console.log('PASS: packaged browser handoff loads through emitted JavaScript');
  `,
    ],
    { cwd: tempRoot, encoding: 'utf8', timeout: 30_000 }
  );
  process.stdout.write(stdout);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createHash } from 'node:crypto';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  symlinkSync,
  existsSync,
  cpSync,
  rmSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const installed = dirname(dirname(require.resolve('stim-cli/cache-manifest')));
const metadata = JSON.parse(
  readFileSync(join(installed, 'package.json'), 'utf8')
);
assert.equal(metadata.version, '1.0.0-rc.7');
const installedRequire = createRequire(join(installed, 'package.json'));
const dir = mkdtempSync(join(tmpdir(), 'stim-scheme-controls-'));
const pkg = join(dir, 'package');
mkdirSync(pkg);
cpSync(join(installed, 'dist'), join(pkg, 'dist'), { recursive: true });
writeFileSync(join(pkg, 'package.json'), JSON.stringify(metadata));
// Each copied entry resolves the exact installed dependency, including any
// nested version chosen by pnpm. The installed package remains untouched.
for (const name of Object.keys(metadata.dependencies)) {
  let dependency = dirname(installedRequire.resolve(name));
  for (;;) {
    const manifest = join(dependency, 'package.json');
    if (
      existsSync(manifest) &&
      JSON.parse(readFileSync(manifest, 'utf8')).name === name
    )
      break;
    const parent = dirname(dependency);
    assert.notEqual(parent, dependency, `Could not resolve ${name}`);
    dependency = parent;
  }
  const link = join(pkg, 'node_modules', name);
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(dependency, link, 'dir');
}
// Expose the real packaged command's DI seam; remove only CLI startup.
const source = readFileSync(join(pkg, 'dist/cli.mjs'), 'utf8');
assert.equal(source.split('//#region bin/cli.ts').length, 2);
writeFileSync(
  join(pkg, 'dist/scheme-test-api.mjs'),
  source.split('//#region bin/cli.ts')[0] +
    '\nexport { runIos, registerIos, xcodebuildArgs, listSchemes, storeBuild, resolveBuild, storedSources, acquireBuildLock, releaseBuildLock, buildLockPath };\n'
);
const originalStimHome = process.env.STIM_HOME;
process.env.STIM_HOME = join(dir, 'home');
after(() => {
  if (originalStimHome === undefined) delete process.env.STIM_HOME;
  else process.env.STIM_HOME = originalStimHome;
  rmSync(dir, { recursive: true, force: true });
});
const api = await import(pathToFileURL(join(pkg, 'dist/scheme-test-api.mjs')));
const { Command } = await import(
  pathToFileURL(installedRequire.resolve('commander'))
);
const HASH = 'a'.repeat(40),
  NEW_HASH = 'b'.repeat(40);
const UDID = 'C4020000-0000-4000-8000-000000000000';
const expectedKey = (hash, scheme) =>
  hash +
  '-release-sim' +
  (scheme
    ? '-scheme-' + createHash('sha256').update(scheme).digest('hex')
    : '');

async function run(opts = {}, changes = {}, parse = null) {
  const root = mkdtempSync(join(dir, 'test-project-'));
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      dependencies: { 'react-native': '0.81.0' },
    })
  );
  const calls = [];
  const record = (name, args, result) => {
    calls.push({ name, args });
    return result;
  };
  const app = join(root, 'Landscape-preview.app');
  const defaults = {
    findProjectRoot: () => root,
    repoRoot: () => root,
    gitCommonDir: () => null,
    resolveSettings: () => ({}),
    resolveCacheProviderConfig: () => null,
    ensureWorkspaceStorage: async () => {},
    discoverXcodeProject: () => ({
      name: 'Landscape',
      path: join(root, 'ios/Landscape.xcworkspace'),
      flag: '-workspace',
    }),
    listSchemes: (p) =>
      record('listSchemes', p, {
        name: 'Landscape',
        schemes: ['Landscape', 'Landscape-preview'],
      }),
    detectBundleId: () => 'io.tlon.groups',
    detectIsExpo: () => true,
    upsertProject: () => {},
    getProject: () => ({ metroPort: 8089 }),
    projectShortcut: () => 'test',
    getConcurrencyLimits: () => ({ maxDevices: 1, maxBuilds: 1 }),
    checkDeviceCapacity: () => null,
    ensureOwnedDevice: async (p) =>
      record('ensureOwnedDevice', p, {
        deviceUdid: UDID,
        deviceName: 'stim-test',
        owned: true,
      }),
    ensureBooted: async (p) =>
      record('ensureBooted', p, { ok: true, udid: UDID }),
    fingerprintProject: async (p) =>
      record('fingerprintProject', p, { hash: HASH, sources: [] }),
    untrackedNativeFiles: () => [],
    readWorkspaceState: () => ({}),
    writeWorkspaceState: () => {},
    resolveBuild: (platform, key) =>
      record('resolveBuild', { platform, key }, null),
    storeBuild: (platform, key, path, options) =>
      record('storeBuild', { platform, key, path, options }, path),
    loadProjectProvider: async (p) =>
      record('loadProjectProvider', p, { none: true }),
    resolveRemote: async (p) => record('resolveRemote', p, null),
    uploadRemote: async (p) => record('uploadRemote', p, { uploaded: true }),
    acquireBuildLock: (p) =>
      record('acquireBuildLock', p, {
        acquired: true,
        path: join(root, 'lock'),
        lock: { pid: process.pid },
      }),
    releaseBuildLock: () => {},
    acquireBuildSlot: () => ({ acquired: true }),
    releaseBuildSlot: () => {},
    needsPrebuild: () => false,
    runPrebuild: async () => ({ ok: true }),
    readPodState: () => ({
      hasPodfile: true,
      lockText: 'same',
      manifestText: 'same',
    }),
    podsAreStale: () => ({ stale: false }),
    runPodInstall: async (p) => record('runPodInstall', p, { ok: true }),
    buildIos: async (p) =>
      record('buildIos', p, {
        appPath: app,
        bundleId: 'io.tlon.groups.preview',
        durationMs: 12,
      }),
    readBundleId: () => 'io.tlon.groups.preview',
    swapJsBundle: async (p) =>
      record('swapJsBundle', p, { ok: true, appPath: app, durationMs: 2 }),
    installIosApp: (p) => record('installIosApp', p, { ok: true }),
    launchIosApp: (p) => record('launchIosApp', p, { ok: true, pid: 99999 }),
    verifyReleaseLaunch: async () => ({ verified: true }),
    replaceCollector: async () => ({}),
    createWriter: () => ({ write: () => {}, close: () => {} }),
    ...changes,
  };
  const outputs = [],
    old = { log: console.log, error: console.error, exit: process.exit };
  let exitCode = null,
    result;
  console.log = (...v) => outputs.push(v.join(' '));
  console.error = (...v) => outputs.push(v.join(' '));
  process.exit = (code) => {
    exitCode = code;
  };
  try {
    if (parse) {
      const program = new Command();
      program.exitOverride();
      program.configureOutput({ writeErr: () => {} });
      api.registerIos(program, defaults);
      await program.parseAsync(parse, { from: 'user' });
    } else
      result = await api.runIos(
        { configuration: 'Release', json: true, ...opts },
        defaults
      );
  } finally {
    console.log = old.log;
    console.error = old.error;
    process.exit = old.exit;
  }
  return { result, calls, exitCode, outputs };
}
const named = (r, n) => r.calls.filter((c) => c.name === n);

test('CLI forwards exact explicit shared scheme and Release through the real command', async () => {
  const r = await run({}, {}, [
    'ios',
    '--scheme',
    'Landscape-preview',
    '--configuration',
    'Release',
    '--json',
  ]);
  assert.equal(r.exitCode, null);
  assert.equal(named(r, 'buildIos')[0].args.scheme, 'Landscape-preview');
  assert.equal(named(r, 'buildIos')[0].args.configuration, 'Release');
});
test('unknown scheme rejects before device, cache, build or install', async () => {
  const r = await run({ scheme: 'Not-a-shared-scheme' });
  assert.equal(r.exitCode, 1);
  assert.match(r.outputs.join('\n'), /STIM_NO_SCHEME/);
  for (const name of [
    'ensureOwnedDevice',
    'resolveBuild',
    'buildIos',
    'installIosApp',
  ])
    assert.equal(named(r, name).length, 0, name);
});
test('empty scheme and unavailable listing fail closed', async () => {
  for (const [opts, changes] of [
    [{ scheme: '  ' }, {}],
    [{ scheme: 'Landscape-preview' }, { listSchemes: () => null }],
  ]) {
    const r = await run(opts, changes);
    assert.equal(r.exitCode, 1);
    assert.equal(named(r, 'buildIos').length, 0);
    assert.equal(named(r, 'installIosApp').length, 0);
  }
});
test('default selection and its prior cache key remain unchanged', async () => {
  const r = await run();
  assert.equal(r.exitCode, null);
  assert.equal(named(r, 'listSchemes').length, 0);
  assert.equal(named(r, 'buildIos')[0].args.scheme, undefined);
  assert.equal(named(r, 'resolveBuild')[0].args.key, expectedKey(HASH));
  assert.equal(named(r, 'loadProjectProvider').length, 1);
});
test('production and preview selection separate lookup, lock and stored keys', async () => {
  const keys = [];
  for (const scheme of ['Landscape', 'Landscape-preview']) {
    const r = await run({ scheme });
    assert.equal(r.exitCode, null);
    const expected = expectedKey(HASH, scheme);
    keys.push(expected);
    for (const name of ['resolveBuild', 'acquireBuildLock', 'storeBuild'])
      assert.equal(named(r, name)[0].args.key, expected, name);
    assert.equal(r.result.cacheKey, expected);
    assert.equal(r.result.fingerprint, HASH);
    assert.equal(r.result.xcodeScheme, scheme);
    assert.equal(named(r, 'loadProjectProvider').length, 0);
    assert.equal(named(r, 'resolveRemote').length, 0);
  }
  assert.notEqual(keys[0], keys[1]);
  assert.notEqual(keys[0], expectedKey(HASH));
});
test('post-Pods fingerprint uses the same selected-scheme key for lookup and store', async () => {
  let fingerprints = 0;
  const lookups = [];
  const r = await run(
    { scheme: 'Landscape-preview' },
    {
      podsAreStale: () => ({ stale: true }),
      fingerprintProject: async () => ({
        hash: ++fingerprints === 1 ? HASH : NEW_HASH,
        sources: [],
      }),
      resolveBuild: (platform, key) => {
        lookups.push(key);
        return null;
      },
    }
  );
  assert.equal(r.exitCode, null);
  assert.deepEqual(lookups, [
    expectedKey(HASH, 'Landscape-preview'),
    expectedKey(NEW_HASH, 'Landscape-preview'),
  ]);
  assert.equal(
    named(r, 'storeBuild')[0].args.key,
    expectedKey(NEW_HASH, 'Landscape-preview')
  );
  assert.equal(named(r, 'buildIos')[0].args.scheme, 'Landscape-preview');
});
test('matching initial warm hit swaps JS and never builds', async () => {
  const requested = [];
  const r = await run(
    { scheme: 'Landscape-preview' },
    {
      resolveBuild: (platform, key) => {
        requested.push(key);
        return key === expectedKey(HASH, 'Landscape-preview')
          ? '/cache/Landscape-preview.app'
          : null;
      },
    }
  );
  assert.equal(r.exitCode, null);
  assert.equal(named(r, 'buildIos').length, 0);
  assert.equal(named(r, 'swapJsBundle').length, 1);
  assert.equal(
    named(r, 'swapJsBundle')[0].args.cachedAppPath,
    '/cache/Landscape-preview.app'
  );
  assert.equal(r.result.bundleId, 'io.tlon.groups.preview');
  assert.equal(r.result.udid, UDID);
  assert.equal(r.result.xcodeScheme, 'Landscape-preview');
});
test('matching post-Pods warm hit swaps JS and never builds or stores another artifact', async () => {
  let fingerprints = 0;
  const r = await run(
    { scheme: 'Landscape-preview' },
    {
      podsAreStale: () => ({ stale: true }),
      fingerprintProject: async () => ({
        hash: ++fingerprints === 1 ? HASH : NEW_HASH,
        sources: [],
      }),
      resolveBuild: (platform, key) =>
        key === expectedKey(NEW_HASH, 'Landscape-preview')
          ? '/cache/Landscape-preview.app'
          : null,
    }
  );
  assert.equal(r.exitCode, null);
  assert.equal(named(r, 'buildIos').length, 0);
  assert.equal(named(r, 'storeBuild').length, 0);
  assert.equal(named(r, 'swapJsBundle').length, 1);
  assert.equal(r.result.cacheKey, expectedKey(NEW_HASH, 'Landscape-preview'));
});
test('failed warm swap falls back to same-scheme build', async () => {
  const r = await run(
    { scheme: 'Landscape-preview' },
    {
      resolveBuild: () => '/cache/Landscape-preview.app',
      swapJsBundle: async () => ({ ok: false, reason: 'controlled failure' }),
    }
  );
  assert.equal(r.exitCode, null);
  assert.equal(named(r, 'buildIos')[0].args.scheme, 'Landscape-preview');
});
test('actual engine argv carries exact scheme as one argument', () => {
  const args = api.xcodebuildArgs({
    project: { flag: '-workspace', path: '/tmp/Landscape.xcworkspace' },
    scheme: 'Landscape-preview',
    udid: UDID,
    configuration: 'Release',
    derivedDataPath: '/tmp/dd',
  });
  assert.equal(args[args.indexOf('-scheme') + 1], 'Landscape-preview');
  assert.equal(args[args.indexOf('-destination') + 1], `id=${UDID}`);
});
test('key-based provider receives selected lookup/store keys and legacy provider stays unused', async () => {
  const seen = [];
  const r = await run(
    { scheme: 'Landscape-preview' },
    {
      resolveCacheProviderConfig: () => ({
        provider: './controlled-cache.mjs',
        options: {},
        baseDir: dir,
      }),
      loadCacheProvider: async () => ({
        name: 'controlled',
        provider: {
          builds: {
            resolve: (v) => {
              seen.push(['resolve', v.key]);
              return null;
            },
            store: (v) => {
              seen.push(['store', v.key]);
            },
          },
        },
      }),
    }
  );
  assert.equal(r.exitCode, null);
  assert.deepEqual(seen, [
    ['resolve', expectedKey(HASH, 'Landscape-preview')],
    ['store', expectedKey(HASH, 'Landscape-preview')],
  ]);
  assert.equal(named(r, 'loadProjectProvider').length, 0);
});
test('waiting for the same-scheme lock uses the scoped key and preserves warm swap', async () => {
  const waited = [];
  const r = await run(
    { scheme: 'Landscape-preview' },
    {
      acquireBuildLock: () => ({
        held: { pid: 23456, projectRoot: '/other/workspace' },
      }),
      waitForBuild: async (v) => {
        waited.push(v.key);
        return { hit: '/cache/Landscape-preview.app', waitedMs: 12 };
      },
    }
  );
  assert.equal(r.exitCode, null);
  assert.deepEqual(waited, [expectedKey(HASH, 'Landscape-preview')]);
  assert.equal(named(r, 'buildIos').length, 0);
  assert.equal(named(r, 'swapJsBundle').length, 1);
});

test('real cache copy/resolve, source manifest and real lock preserve each scheme key', () => {
  const cache = mkdtempSync(join(dir, 'real-cache-'));
  const source = mkdtempSync(join(dir, 'real-artifact-'));
  const schemes = ['Landscape', 'Landscape-preview'];
  const handles = [];
  try {
    for (const scheme of schemes) {
      const app = join(source, scheme + '.app');
      mkdirSync(app);
      writeFileSync(join(app, 'main.jsbundle'), scheme);
      const key = expectedKey(HASH, scheme),
        sources = [{ filePath: 'ios/project.pbxproj', hash: HASH }];
      const stored = api.storeBuild('ios', key, app, { root: cache, sources });
      assert.equal(stored, join(cache, 'ios', key, scheme + '.app'));
      assert.equal(api.resolveBuild('ios', key, cache), stored);
      assert.equal(readFileSync(join(stored, 'main.jsbundle'), 'utf8'), scheme);
      assert.deepEqual(api.storedSources('ios', key, cache), sources);
      const held = api.acquireBuildLock({ platform: 'ios', key, root: source });
      handles.push(held);
      assert.equal(held.acquired, true);
      assert.equal(held.path, api.buildLockPath('ios', key));
      assert(held.path.startsWith(process.env.STIM_HOME + '/'));
    }
    assert.notEqual(handles[0].path, handles[1].path);
    assert.equal(api.resolveBuild('ios', expectedKey(HASH), cache), null);
  } finally {
    for (const held of handles) api.releaseBuildLock(held);
  }
});

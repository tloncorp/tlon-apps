/**
 * macOS host controls for actual installed React Native MVCP method bodies.
 * node scripts/test-rn-mvcp.mjs [--source FILE] [--report FILE]
 * --source supports an immutable archived base for an explicit red run.
 * Foundation/CoreGraphics and ARC execute natively; UIKit and mounting are
 * modeled by the adjacent fixture. This is not simulator or paint evidence.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const options = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const option = process.argv[i];
  assert.ok(
    ['--source', '--report'].includes(option),
    `Unknown option: ${option}`
  );
  assert.ok(process.argv[i + 1] && !process.argv[i + 1].startsWith('--'));
  assert.ok(!(option in options), `Repeated option: ${option}`);
  options[option] = path.resolve(process.argv[i + 1]);
}
if (process.platform !== 'darwin') {
  console.error(
    'UNAVAILABLE: RN MVCP host controls require macOS Foundation/CoreGraphics and clang++.'
  );
  process.exit(2);
}
const require = createRequire(
  new URL('../packages/app/package.json', import.meta.url)
);
const sourcePath =
  options['--source'] ??
  path.join(
    path.dirname(require.resolve('react-native/package.json')),
    'React/Fabric/Mounting/ComponentViews/ScrollView/RCTScrollViewComponentView.mm'
  );
const fixturePath = fileURLToPath(
  new URL('./fixtures/rn-mvcp.controls.mm', import.meta.url)
);
const source = fs.readFileSync(sourcePath, 'utf8');
const fixture = fs.readFileSync(fixturePath);
const startMarker = '- (void)_prepareForMaintainVisibleScrollPosition\n{';
const endMarker = '#pragma mark - RCTVirtualViewContainerProtocol';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
assert.ok(start >= 0 && end > start, 'Required RN methods were not found');
assert.equal(
  source.indexOf(startMarker, start + 1),
  -1,
  'Duplicate preparation method'
);
const methods = source.slice(start, end);
assert.equal(
  (
    methods.match(/- \(void\)_adjustForMaintainVisibleContentPosition\n\{/g) ??
    []
  ).length,
  1
);
const recycleGuard =
  /- \(void\)prepareForRecycle\s*\{\s*(?:\[self invalidateReadPointLease\];\s*)?\+\+_mvcpPreparationRevision;\s*_preparedMVCPContentView = nil;\s*\[super prepareForRecycle\];/.test(
    source
  );
const declaredOwners =
  /__weak UIView \*_preparedMVCPContentView;/.test(source) &&
  /NSUInteger _mvcpPreparationRevision;/.test(source);
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rn-mvcp-controls-'));
let phase = 'toolchain';
let lastProcess;
const invoke = (name, command, args, timeout) => {
  phase = name;
  const result = spawnSync(command, args, { encoding: 'utf8', timeout });
  lastProcess = {
    command,
    args,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error && {
      message: result.error.message,
      code: result.error.code,
    },
  };
  return result;
};
const writeReport = (receipt) => {
  if (!options['--report']) return;
  fs.mkdirSync(path.dirname(options['--report']), { recursive: true });
  fs.writeFileSync(
    options['--report'],
    `${JSON.stringify(receipt, null, 2)}\n`
  );
};
try {
  const locate = (args) => {
    const result = invoke(
      'toolchain',
      '/usr/bin/xcrun',
      ['--sdk', 'macosx', ...args],
      10000
    );
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const compiler = locate(['--find', 'clang++']);
  const sdk = locate(['--show-sdk-path']);
  fs.writeFileSync(path.join(directory, 'actual-methods.inc'), methods);
  const executable = path.join(directory, 'controls');
  const compiled = invoke(
    'compile',
    compiler,
    [
      '-isysroot',
      sdk,
      '-std=c++20',
      '-fobjc-arc',
      '-framework',
      'Foundation',
      '-framework',
      'CoreGraphics',
      fixturePath,
      '-I',
      directory,
      '-o',
      executable,
    ],
    180000
  );
  assert.equal(compiled.error, undefined, compiled.error?.message);
  assert.equal(compiled.status, 0, compiled.stderr);
  const run = invoke('execute', executable, [], 10000);
  assert.equal(run.error, undefined, run.error?.message);
  assert.ok(run.status === 0 || run.status === 1, run.stderr);
  phase = 'validate-output';
  const result = JSON.parse(run.stdout);
  assert.equal(result.records.length, 17);
  assert.equal(new Set(result.records.map((record) => record.name)).size, 17);
  for (const record of result.records) {
    assert.equal(typeof record.pass, 'boolean');
    assert.ok(
      Number.isFinite(record.actualOffset) &&
        Number.isFinite(record.expectedOffset)
    );
    assert.equal(
      record.pass,
      Math.abs(record.actualOffset - record.expectedOffset) < 0.00001
    );
  }
  const passed = result.records.filter((record) => record.pass).length;
  assert.equal(result.passed, passed);
  assert.equal(result.failed, 17 - passed);
  assert.equal(run.status, result.failed ? 1 : 0);
  const receipt = {
    ...result,
    sourcePath,
    sourceSha256: sha(source),
    methodSha256: sha(methods),
    fixtureSha256: sha(fixture),
    compiler,
    sdk,
    productionLifecycleWiring: { declaredOwners, recycleGuard },
    compileWarnings: compiled.stderr,
  };
  writeReport(receipt);
  console.log(
    JSON.stringify({
      passed,
      failed: result.failed,
      declaredOwners,
      recycleGuard,
      sourceSha256: receipt.sourceSha256,
    })
  );
  if (result.failed || !declaredOwners || !recycleGuard) process.exitCode = 1;
} catch (error) {
  // Preserve the compiler/runtime output and exact extracted input before cleanup.
  // A setup or compiler error is unavailable evidence, never 17 passing controls.
  writeReport({
    status: 'ERROR',
    phase,
    sourcePath,
    sourceSha256: sha(source),
    methodSha256: sha(methods),
    fixtureSha256: sha(fixture),
    lastProcess,
    error: error instanceof Error ? error.stack : String(error),
  });
  if (options['--report']) {
    fs.writeFileSync(`${options['--report']}.methods.inc`, methods);
  }
  throw error;
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}

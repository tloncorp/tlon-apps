import { describe, expect, it } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  assetHash,
  snapshotWebSources,
  outputManifest,
  verifyCurrentWebBuild,
  sourceIdentities,
  createWebTestIsolationPlugin,
  assessBuildReceipt,
  assessProductionAssets,
} from '../../../scripts/scroll-stability-web-assets.mjs';
import { concurrentEvidence } from './scrollConcurrentContentTestSupport';
import { replayConcurrentContentProof } from '../../../scripts/scroll-stability-concurrent-content-evidence.mjs';
import AttemptClockReporter from '../../../apps/tlon-web/e2e/helpers/scrollerAttemptClockReporter.cjs';
import {
  readPlaywrightReport,
  assessWebEvidence,
} from '../../../scripts/scroll-stability-web-evidence.mjs';
import { concurrentScenarioRegistry } from '../../../scripts/scroll-stability-concurrent-content-evidence.mjs';

const digest = (value) => assetHash(JSON.stringify(value));
const file = (path, body) => ({
  path,
  sha256: assetHash(body),
  bytes: Buffer.byteLength(body),
});
function evidence() {
  const sourceFiles = [
    file('apps/tlon-web/package.json', '{"scripts":{"build":"vite build"}}'),
  ];
  const outputFiles = [
    file('assets/index-abc123.js', 'console.log("built")'),
    file(
      'index.html',
      '<script src="/apps/groups/assets/index-abc123.js"></script>'
    ),
  ];
  const payload = {
    version: 1,
    kind: 'vite-production-build',
    source: {
      root: '/repo',
      workspaceLinks: ['ui', 'app', 'api', 'shared'].map((folder) => ({
        path: `apps/tlon-web/node_modules/@tloncorp/${folder}`,
        target: `packages/${folder}`,
      })),
      head: 'a'.repeat(40),
      files: sourceFiles,
      digest: digest(sourceFiles),
    },
    sourceAfterDigest: digest(sourceFiles),
    build: {
      environment: [],
      package: 'tlon-web',
      script: 'vite build',
      scriptSha256: assetHash('vite build'),
      packageJsonSha256: sourceFiles[0].sha256,
      argv: [
        'corepack',
        'pnpm',
        '--filter',
        'tlon-web',
        'build',
        '--outDir',
        '/dist',
      ],
      startedAt: 1,
      completedAt: 100,
      exitCode: 0,
    },
    output: { root: '/dist', files: outputFiles, digest: digest(outputFiles) },
  };
  const receipt = { ...payload, digest: digest(payload) };
  const origin = 'http://localhost:3000',
    scope = '/apps/groups/group/g/channel/c';
  const proof = {
    version: 1,
    kind: 'served-production-assets',
    receipt,
    currentCheck: {
      checkedAt: 150,
      sourceDigest: receipt.source.digest,
      outputDigest: receipt.output.digest,
    },
    startedAt: 200,
    completedAt: 3000,
    timeOrigin: 1000,
    performanceEnd: 2000,
    origin,
    scope,
    errors: [],
    vitePreamble: false,
    resources: [
      {
        url: origin + '/apps/groups/assets/index-abc123.js',
        initiatorType: 'script',
      },
    ],
    scripts: [origin + '/apps/groups/assets/index-abc123.js'],
    responses: outputFiles.map((f) => ({
      url: origin + '/apps/groups/' + (f.path === 'index.html' ? '' : f.path),
      type: f.path === 'index.html' ? 'document' : 'script',
      status: 200,
      bytes: f.bytes,
      sha256: f.sha256,
      observedAt: 250,
      fromServiceWorker: false,
    })),
  };
  for (const path of ['/apps/groups/desk.js', '/session.js']) {
    const url = origin + path;
    proof.scripts.push(url);
    proof.resources.push({ url, initiatorType: 'script' });
    proof.responses.push({
      url,
      type: 'script',
      status: 200,
      bytes: 12,
      sha256: assetHash('bootstrap'),
      observedAt: 250,
      fromServiceWorker: false,
    });
  }
  const expected = {
    origin,
    scope,
    attemptStartTime: '1970-01-01T00:00:00.000Z',
    attemptDurationMs: 4000,
    performanceEndTime: 1800,
  };
  return { proof, expected };
}
const resign = (r) => {
  const { digest: old, ...payload } = r;
  r.digest = digest(payload);
};
describe('served production web build provenance', () => {
  it('uses observed reporter wall end when timeout-slot duration omits time', () => {
    const { proof, expected } = evidence();
    expected.attemptDurationMs = 2000;
    expect(assessProductionAssets(proof, expected)).not.toEqual([]);
    expected.attemptWallEndTime = 3500;
    expect(assessProductionAssets(proof, expected)).toEqual([]);
  });
  it('accepts exact wall containment when monotonic duration exceeds wall span by 7ms', () => {
    const { proof, expected } = evidence();
    expected.attemptDurationMs = 3507;
    expected.attemptWallEndTime = 3500;
    expect(assessProductionAssets(proof, expected)).toEqual([]);
  });
  it.each([NaN, Infinity, -1, 0])(
    'rejects invalid duration %s even with a valid explicit wall end',
    (duration) => {
      const { proof, expected } = evidence();
      expected.attemptDurationMs = duration;
      expected.attemptWallEndTime = 3500;
      expect(assessProductionAssets(proof, expected)).not.toEqual([]);
    }
  );
  it('retains byte qualification when the independent clocks differ', () => {
    const { proof, expected } = evidence();
    expected.attemptDurationMs = 3507;
    expected.attemptWallEndTime = 3500;
    proof.responses[0].sha256 = '0'.repeat(64);
    expect(assessProductionAssets(proof, expected)).not.toEqual([]);
  });
  it('rejects capture beyond the actual wall bound without extra tolerance', () => {
    const { proof, expected } = evidence();
    expected.attemptDurationMs = 2000;
    expected.attemptWallEndTime = proof.completedAt - 1;
    expect(assessProductionAssets(proof, expected)).not.toEqual([]);
  });
  it('does not fall back from a malformed reported clock to duration', () => {
    const { proof, expected } = evidence();
    expected.attemptClockError = 'Invalid clock';
    expect(assessProductionAssets(proof, expected)).not.toEqual([]);
  });
  it('accepts actual document/bundle observations linked to an unchanged source/build receipt', () => {
    const { proof, expected } = evidence();
    expect(assessBuildReceipt(proof.receipt)).toEqual([]);
    expect(assessProductionAssets(proof, expected)).toEqual([]);
  });
  for (const [name, mutate] of [
    [
      'missing ship bootstrap',
      (d) => {
        d.proof.scripts = d.proof.scripts.filter(
          (url) => !url.endsWith('/session.js')
        );
      },
    ],
    [
      'foreign bootstrap exception',
      (d) => {
        d.proof.responses.at(-1).url = 'https://foreign.invalid/session.js';
      },
    ],
    [
      'receipt digest',
      (d) => {
        d.proof.receipt.digest = '0'.repeat(64);
      },
    ],
    [
      'foreign workspace package',
      (d) => {
        d.proof.receipt.source.workspaceLinks[0].target =
          '/other/checkout/packages/ui';
        resign(d.proof.receipt);
      },
    ],
    [
      'source digest',
      (d) => {
        d.proof.receipt.source.digest = '0'.repeat(64);
        resign(d.proof.receipt);
      },
    ],
    [
      'source changes during build',
      (d) => {
        d.proof.receipt.sourceAfterDigest = '0'.repeat(64);
        resign(d.proof.receipt);
      },
    ],
    [
      'changed build script',
      (d) => {
        d.proof.receipt.build.script = 'vite';
        resign(d.proof.receipt);
      },
    ],
    [
      'changed package script input',
      (d) => {
        d.proof.receipt.build.packageJsonSha256 = '0'.repeat(64);
        resign(d.proof.receipt);
      },
    ],
    [
      'failed build',
      (d) => {
        d.proof.receipt.build.exitCode = 1;
        resign(d.proof.receipt);
      },
    ],
    [
      'build argument',
      (d) => {
        d.proof.receipt.build.argv.push('--mode', 'dev');
        resign(d.proof.receipt);
      },
    ],
    [
      'output traversal',
      (d) => {
        d.proof.receipt.output.files[0].path = '../bundle.js';
        resign(d.proof.receipt);
      },
    ],
    [
      'stale workspace',
      (d) => {
        d.proof.currentCheck.sourceDigest = '0'.repeat(64);
      },
    ],
    [
      'altered served bundle',
      (d) => {
        d.proof.responses[0].sha256 = '0'.repeat(64);
      },
    ],
    [
      'different length',
      (d) => {
        d.proof.responses[0].bytes++;
      },
    ],
    [
      'missing response',
      (d) => {
        d.proof.responses.pop();
      },
    ],
    [
      'missing inventory',
      (d) => {
        delete d.proof.resources;
      },
    ],
    [
      'foreign document',
      (d) => {
        d.proof.responses[1].url = 'https://elsewhere.invalid/apps/groups/';
      },
    ],
    [
      'dev client',
      (d) => {
        d.proof.resources.push({
          url: 'http://localhost:3000/@vite/client',
          initiatorType: 'script',
        });
      },
    ],
    [
      'dev source',
      (d) => {
        d.proof.scripts.push('http://localhost:3000/apps/groups/src/main.tsx');
      },
    ],
    [
      'dev preamble',
      (d) => {
        d.proof.vitePreamble = true;
      },
    ],
    [
      'wrong scope',
      (d) => {
        d.proof.scope += '/wrong';
      },
    ],
    [
      'old attempt',
      (d) => {
        d.expected.attemptStartTime = '2026-09-07T00:00:00.000Z';
      },
    ],
    [
      'capture ending early',
      (d) => {
        d.proof.performanceEnd = 1500;
        d.proof.completedAt = 2500;
      },
    ],
    [
      'invented wall/performance link',
      (d) => {
        d.proof.timeOrigin = 0;
      },
    ],
  ])
    it(`rejects ${name}`, () => {
      const d = evidence();
      mutate(d);
      expect(
        assessProductionAssets(d.proof, d.expected).some(
          (i) => i.kind === 'incomplete'
        )
      ).toBe(true);
    });
  it('retains old development proof compatibility', () => {
    expect(replayConcurrentContentProof(concurrentEvidence()).verdict).toBe(
      'PASS'
    );
  });
  it('cannot qualify a production label without actual asset evidence', () => {
    const proof = concurrentEvidence();
    proof.preparation.assets = 'Built production assets';
    proof.preparation.assetProof = {};
    expect(
      replayConcurrentContentProof(proof, {
        startTime: '1970-01-01T00:00:00.000Z',
        duration: 4000,
      }).verdict
    ).toBe('INCOMPLETE');
  });
  it('preserves an observed reading failure alongside missing production provenance', () => {
    const proof = concurrentEvidence('history');
    proof.preparation.assets = 'Built production assets';
    proof.preparation.assetProof = {};
    proof.reading.trace.samples.at(-1).point.relativeY -= 100;
    const replay = replayConcurrentContentProof(proof);
    expect(replay.verdict).toBe('FAIL');
    expect(replay.issues.some((i) => i.kind === 'incomplete')).toBe(true);
  });
  it('accepts complete production evidence through the concurrent raw entry point', () => {
    const p = concurrentEvidence(),
      { proof, expected } = evidence();
    proof.scope = p.preparation.scope;
    p.preparation.assets = 'Built production assets';
    p.preparation.assetProof = proof;
    expect(
      replayConcurrentContentProof(p, {
        startTime: expected.attemptStartTime,
        duration: expected.attemptDurationMs,
      }).verdict
    ).toBe('PASS');
  });
});

describe('enclosing Playwright attempt clock', () => {
  function reportData(position = 'latest') {
    const contract = concurrentScenarioRegistry.find(
      (entry) =>
        entry.concurrentPosition === position &&
        entry.concurrentFirst === 'portrait'
    );
    const proof = concurrentEvidence(position);
    const { proof: assets } = evidence();
    assets.scope = proof.preparation.scope;
    proof.preparation.assets = 'Built production assets';
    proof.preparation.assetProof = assets;
    const result = {
      annotations: [],
      retry: 0,
      status: 'passed',
      startTime: new Date(0),
      duration: 2000,
      attachments: [
        {
          name: contract.concurrentAttachment,
          contentType: 'application/json',
          body: Buffer.from(JSON.stringify(proof)).toString('base64'),
        },
      ],
    };
    const reporter = new AttemptClockReporter();
    const realNow = Date.now;
    Date.now = () => 3500;
    try {
      reporter.onTestEnd({ id: 'exact-test' }, result);
    } finally {
      Date.now = realNow;
    }
    const attempt = { ...result, startTime: result.startTime.toISOString() };
    const report = {
      suites: [
        {
          title: '',
          specs: [
            {
              id: 'exact-test',
              title: contract.title,
              file: contract.source,
              tests: [
                {
                  projectName: 'chromium',
                  expectedStatus: 'passed',
                  results: [attempt],
                },
              ],
            },
          ],
        },
      ],
    };
    return { attempt, report };
  }
  const read = (d) =>
    readPlaywrightReport(d.report, '/tmp/clock-control.json')[0];
  it('replays production bytes inside actual enclosing reporter lifetime', () => {
    const d = reportData(),
      record = read(d);
    expect(record.attemptDurationMs).toBe(2000);
    expect(record.attemptWallEndTime).toBe(3500);
    expect(assessWebEvidence(record).status).toBe('recorded-sampled-pass');
  });
  it('uses the explicit reporter endpoint when timeout duration is 7ms longer', () => {
    const d = reportData();
    d.attempt.duration = 3507;
    const record = read(d);
    expect(record.attemptClockError).toBeUndefined();
    expect(record.attemptWallEndTime).toBe(3500);
    expect(assessWebEvidence(record).status).toBe('recorded-sampled-pass');
  });
  it('rejects content after a valid wall end even when the timeout duration would contain it', () => {
    const d = reportData();
    d.attempt.duration = 4000;
    const annotation = d.attempt.annotations[0];
    const clock = JSON.parse(annotation.description);
    clock.endedAt = 1999;
    annotation.description = JSON.stringify(clock);
    const record = read(d);
    expect(record.attemptClockError).toBeUndefined();
    expect(record.attemptWallEndTime).toBe(1999);
    expect(assessWebEvidence(record).status).toBe('incomplete');
  });
  it.each([NaN, Infinity, -1])(
    'rejects a malformed enclosing duration %s',
    (duration) => {
      const d = reportData();
      d.attempt.duration = duration;
      expect(read(d).attemptClockError).toBeTruthy();
      expect(assessWebEvidence(read(d)).status).toBe('incomplete');
    }
  );
  it('preserves missing-clock historical boundary rejection', () => {
    const d = reportData();
    d.attempt.annotations = [];
    expect(read(d).attemptWallEndTime).toBeUndefined();
    expect(assessWebEvidence(read(d)).status).toBe('incomplete');
  });
  it('retains an independently observed reading failure alongside an invalid clock', () => {
    const d = reportData('history');
    d.attempt.annotations[0].description = '{';
    const attachment = d.attempt.attachments[0];
    const proof = JSON.parse(Buffer.from(attachment.body, 'base64').toString());
    proof.reading.trace.samples.at(-1).point.relativeY -= 100;
    attachment.body = Buffer.from(JSON.stringify(proof)).toString('base64');
    expect(assessWebEvidence(read(d)).status).toBe('fail');
  });
  for (const [name, mutate] of [
    ['duplicate', (d) => d.attempt.annotations.push(d.attempt.annotations[0])],
    [
      'invalid JSON',
      (d) => {
        d.attempt.annotations[0].description = '{';
      },
    ],
    [
      'non-array annotations',
      (d) => {
        d.attempt.annotations = {};
      },
    ],
    ...['version', 'source', 'testId', 'retry', 'startTime', 'endedAt'].map(
      (key) => [
        `mismatched ${key}`,
        (d) => {
          const annotation = d.attempt.annotations[0];
          const clock = JSON.parse(annotation.description);
          clock[key] = key === 'endedAt' ? -1 : 'wrong';
          annotation.description = JSON.stringify(clock);
        },
      ]
    ),
  ])
    it(`rejects ${name} instead of using a producer or duration fallback`, () => {
      const d = reportData();
      mutate(d);
      expect(read(d).attemptClockError).toBeTruthy();
      expect(assessWebEvidence(read(d)).status).toBe('incomplete');
    });
});

// Receipt/control models do not execute Vite. Temporary Git and output bytes
// exercise the actual current-workspace verifier, while plugin hooks are called
// with an explicitly modeled Vite module inventory. A real v2 build remains due.
function v2Evidence() {
  const d = evidence(),
    r = d.proof.receipt;
  r.version = 2;
  r.source.files.push(
    file('apps/tlon-web/e2e/helpers/exact.ts', 'export const exact=1;')
  );
  r.source.files.sort((a, b) => a.path.localeCompare(b.path));
  r.source.digest = digest(r.source.files);
  r.sourceAfterDigest = r.source.digest;
  r.source.identity = sourceIdentities(r.source.files);
  r.build.environment.push({
    name: 'SCROLLER_WEB_BUILD_RECEIPT_GUARD',
    sha256: assetHash('1'),
  });
  r.isolation = {};
  for (const scope of ['main', 'worker']) {
    r.isolation[scope] = {
      version: 1,
      policy: 'existing-e2e-and-readers-v1',
      scope,
      root: r.source.root,
      moduleCount: 2,
    };
    r.output.files.push(
      file(
        `scroller-build-isolation-${scope}.json`,
        JSON.stringify(r.isolation[scope])
      )
    );
  }
  r.output.digest = digest(r.output.files);
  resign(r);
  Object.assign(d.proof.currentCheck, {
    version: 2,
    root: r.source.root,
    head: r.source.head,
    sourceDigest: r.source.digest,
    identity: structuredClone(r.source.identity),
    workspaceLinks: structuredClone(r.source.workspaceLinks),
    outputDigest: r.output.digest,
  });
  return d;
}
function sourceRepository(run) {
  const home = mkdtempSync(join(tmpdir(), 'scroller-web-receipt-control-'));
  const root = join(home, 'repo'),
    output = join(home, 'output');
  const put = (path, body) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  };
  mkdirSync(root);
  mkdirSync(output);
  try {
    put('apps/tlon-web/package.json', '{"scripts":{"build":"vite build"}}');
    put('apps/tlon-web/src/main.ts', 'export const app=1;');
    put('apps/tlon-web/e2e/helpers/exact.ts', 'export const input=1;');
    put(
      'apps/tlon-web/playwright.scroller-product.config.ts',
      'export default {};'
    );
    put(
      'packages/app/fixtures/NativeScrollerObservation.tsx',
      'export const actualFixture=1;'
    );
    put('pnpm-lock.yaml', 'lockfileVersion:9');
    put('tsconfig.json', '{}');
    put('patches/react-native.patch', 'original installed dependency patch');
    put('scripts/build-plugin.cjs', 'module.exports = {};');
    put('scripts/scroll-stability-web-evidence.mjs', 'export const reader=1;');
    put('scripts/scroll-stability-web-assets.cjs', 'module.exports = {};');
    put('apps/tlon-web/.env', 'VITE_SOME_INPUT=original');
    for (const folder of ['ui', 'app', 'api', 'shared']) {
      put(
        `packages/${folder}/package.json`,
        JSON.stringify({ name: `@tloncorp/${folder}` })
      );
      const link = join(root, 'apps/tlon-web/node_modules/@tloncorp', folder);
      mkdirSync(dirname(link), { recursive: true });
      symlinkSync(join(root, 'packages', folder), link);
    }
    const git = (...args) =>
      execFileSync('git', args, { cwd: root, stdio: 'pipe' });
    git('init', '-q');
    git('add', '.');
    git(
      '-c',
      'user.name=ReceiptControl',
      '-c',
      'user.email=receipt@example.invalid',
      'commit',
      '-qm',
      'base'
    );
    const source = snapshotWebSources(root);
    const isolation = {};
    for (const scope of ['main', 'worker']) {
      const plugin = createWebTestIsolationPlugin(root, scope);
      plugin.configResolved({
        configFileDependencies: [join(root, 'scripts/build-plugin.cjs')],
      });
      plugin.generateBundle.call({
        getModuleIds: () => [join(root, 'apps/tlon-web/src/main.ts')],
        getModuleInfo: () => ({ isExternal: false }),
        emitFile: (asset) => {
          writeFileSync(join(output, asset.fileName), asset.source);
          isolation[scope] = JSON.parse(asset.source);
        },
      });
    }
    mkdirSync(join(output, 'assets'));
    writeFileSync(join(output, 'assets/index-abc.js'), 'built');
    writeFileSync(join(output, 'index.html'), 'built html');
    const files = outputManifest(output);
    const payload = {
      version: 2,
      kind: 'vite-production-build',
      source,
      sourceAfterDigest: source.digest,
      isolation,
      build: {
        environment: [
          { name: 'SCROLLER_WEB_BUILD_RECEIPT_GUARD', sha256: assetHash('1') },
          { name: 'VITE_BUILD_ONLY_NOT_ON_RUNNER', sha256: assetHash('on') },
        ],
        package: 'tlon-web',
        script: 'vite build',
        scriptSha256: assetHash('vite build'),
        packageJsonSha256: source.files.find(
          (f) => f.path === 'apps/tlon-web/package.json'
        ).sha256,
        argv: [
          'corepack',
          'pnpm',
          '--filter',
          'tlon-web',
          'build',
          '--outDir',
          output,
        ],
        startedAt: 1,
        completedAt: 2,
        exitCode: 0,
      },
      output: { root: output, files, digest: digest(files) },
    };
    const receipt = { ...payload, digest: digest(payload) };
    return run({ root, output, put, git, receipt });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}
describe('v2 isolated runtime versus E2E identity', () => {
  it('accepts the installed Vite production shim but still rejects unknown module paths', () =>
    sourceRepository(({ root }) => {
      const plugin = createWebTestIsolationPlugin(root, 'main');
      expect(plugin.transform('', '__vite-browser-external')).toBeNull();
      expect(() => plugin.transform('', 'unknown-relative.ts')).toThrow(
        /Unknown build module path/
      );
      expect(() =>
        plugin.transform('', '__vite-browser-external/../e2e/exact.ts')
      ).toThrow(/Unknown build module path/);
    }));
  it('reuses unchanged app bytes after an existing helper-only commit and retains both identities', () =>
    sourceRepository(({ root, put, git, receipt }) => {
      const before = verifyCurrentWebBuild(receipt, root);
      put('apps/tlon-web/e2e/helpers/exact.ts', 'export const input=2;');
      git('add', '.');
      git(
        '-c',
        'user.name=ReceiptControl',
        '-c',
        'user.email=receipt@example.invalid',
        'commit',
        '-qm',
        'helper only'
      );
      const after = verifyCurrentWebBuild(receipt, root);
      expect(after.identity.runtimeDigest).toBe(before.identity.runtimeDigest);
      expect(after.sourceDigest).not.toBe(before.sourceDigest);
      expect(after.identity.testDigest).not.toBe(before.identity.testDigest);
      expect(after.head).not.toBe(before.head);
      expect(after.outputDigest).toBe(before.outputDigest);
    }));
  it('reuses an existing Playwright config edit without requiring build env on the runner', () =>
    sourceRepository(({ root, put, receipt }) => {
      put(
        'apps/tlon-web/playwright.scroller-product.config.ts',
        'export default {retries:0};'
      );
      expect(verifyCurrentWebBuild(receipt, root).identity.runtimeDigest).toBe(
        receipt.source.identity.runtimeDigest
      );
    }));
  it('reuses an existing canonical reader edit and binds the new test bytes', () =>
    sourceRepository(({ root, put, receipt }) => {
      put(
        'scripts/scroll-stability-web-evidence.mjs',
        'export const reader=2;'
      );
      const current = verifyCurrentWebBuild(receipt, root);
      expect(current.identity.runtimeDigest).toBe(
        receipt.source.identity.runtimeDigest
      );
      expect(current.identity.testDigest).not.toBe(
        receipt.source.identity.testDigest
      );
      expect(
        current.identity.testFiles.find(
          (f) => f.path === 'scripts/scroll-stability-web-evidence.mjs'
        ).sha256
      ).toBe(assetHash('export const reader=2;'));
      const plugin = createWebTestIsolationPlugin(root, 'main');
      expect(() =>
        plugin.transform(
          '',
          join(root, 'scripts/scroll-stability-web-evidence.mjs')
        )
      ).toThrow(/test-only/);
    }));
  it.each([
    'apps/tlon-web/src/main.ts',
    'apps/tlon-web/package.json',
    'packages/app/fixtures/NativeScrollerObservation.tsx',
    'pnpm-lock.yaml',
    'tsconfig.json',
    'patches/react-native.patch',
    'scripts/build-plugin.cjs',
    'scripts/scroll-stability-web-assets.cjs',
    'apps/tlon-web/.env',
  ])('invalidates actual runtime input %s', (path) =>
    sourceRepository(({ root, put, receipt }) => {
      put(path, 'changed runtime bytes');
      expect(() => verifyCurrentWebBuild(receipt, root)).toThrow();
    })
  );
  it.each([
    'apps/tlon-web/e2e/helpers/new.ts',
    'apps/tlon-web/e2e/helpers/unknown.wasm',
    'apps/tlon-web/src/new-entry.ts',
  ])('does not guess a new input safe: %s', (path) =>
    sourceRepository(({ root, put, receipt }) => {
      put(path, 'new bytes');
      expect(() => verifyCurrentWebBuild(receipt, root)).toThrow();
    })
  );
  it('rejects deletion, symlink substitution and changed outputs', () =>
    sourceRepository(({ root, output, put, receipt }) => {
      const helper = 'apps/tlon-web/e2e/helpers/exact.ts';
      rmSync(join(root, helper));
      expect(() => verifyCurrentWebBuild(receipt, root)).toThrow();
      symlinkSync(join(root, 'apps/tlon-web/src/main.ts'), join(root, helper));
      expect(() => verifyCurrentWebBuild(receipt, root)).toThrow(/symlink/);
      rmSync(join(root, helper));
      put(helper, 'export const input=1;');
      writeFileSync(join(output, 'assets/index-abc.js'), 'tampered');
      expect(() => verifyCurrentWebBuild(receipt, root)).toThrow(
        /output files changed/
      );
    }));
  it.each(['main', 'worker'])(
    'actual %s guard rejects test imports and accepts runtime modules',
    (scope) =>
      sourceRepository(({ root }) => {
        const plugin = createWebTestIsolationPlugin(root, scope);
        const forbidden = join(root, 'apps/tlon-web/e2e/helpers/exact.ts');
        expect(() =>
          plugin.configResolved({ configFileDependencies: [forbidden] })
        ).toThrow(/test-only/);
        plugin.configResolved({
          configFileDependencies: [join(root, 'scripts/build-plugin.cjs')],
        });
        expect(() => plugin.transform('', forbidden + '?raw')).toThrow(
          /test-only/
        );
        expect(
          plugin.transform('', join(root, 'apps/tlon-web/src/main.ts'))
        ).toBe(null);
        expect(() =>
          plugin.generateBundle.call({
            getModuleIds: () => [forbidden],
            getModuleInfo: () => ({ isExternal: false }),
          })
        ).toThrow(/test-only/);
        expect(() => plugin.transform('', 'unknown-module')).toThrow(
          /Unknown build/
        );
      })
  );
  it('reconstructs a changed test identity in independent served-asset replay', () => {
    const d = v2Evidence(),
      check = d.proof.currentCheck;
    const changed = file(
      'apps/tlon-web/e2e/helpers/exact.ts',
      'export const exact=2;'
    );
    const files = d.proof.receipt.source.files.map((f) =>
      f.path === changed.path ? changed : f
    );
    check.identity = sourceIdentities(files);
    check.sourceDigest = digest(files);
    check.head = 'b'.repeat(40);
    expect(assessProductionAssets(d.proof, d.expected)).toEqual([]);
    d.proof.responses[0].sha256 = '0'.repeat(64);
    expect(assessProductionAssets(d.proof, d.expected)).not.toEqual([]);
  });
  it.each(['main', 'worker'])(
    'requires the original %s guard artifact',
    (scope) => {
      const d = v2Evidence();
      delete d.proof.receipt.isolation[scope];
      resign(d.proof.receipt);
      expect(assessProductionAssets(d.proof, d.expected)).not.toEqual([]);
    }
  );
  it.each([
    'opaque current digest',
    'forged runtime digest',
    'unknown policy',
    'app fixture masquerades as test',
    'new test input',
  ])('rejects %s in independent current-source proof', (fault) => {
    const d = v2Evidence(),
      c = d.proof.currentCheck;
    if (fault === 'opaque current digest') c.sourceDigest = '0'.repeat(64);
    if (fault === 'forged runtime digest')
      c.identity.runtimeDigest = '0'.repeat(64);
    if (fault === 'unknown policy') c.identity.policy = 'other';
    if (fault === 'app fixture masquerades as test')
      c.identity.testFiles.push(
        file(
          'packages/app/fixtures/NativeScrollerObservation.tsx',
          'test claim'
        )
      );
    if (fault === 'new test input')
      c.identity.testFiles.push(
        file('apps/tlon-web/e2e/helpers/new.ts', 'new')
      );
    expect(assessProductionAssets(d.proof, d.expected)).not.toEqual([]);
  });
});

// Actual installed Vite/esbuild config loader; no server or application build.
function loadActualReceiptViteConfig(staticCjsImport = false) {
  const root = resolve(import.meta.dirname, '../../..'),
    web = join(root, 'apps/tlon-web');
  const temp = mkdtempSync(join(tmpdir(), 'scroller-vite-loader-'));
  try {
    const dir = join(temp, 'apps/tlon-web');
    mkdirSync(dir, { recursive: true });
    for (const name of readdirSync(web)) {
      if (
        name === 'vite.config.mts' ||
        name.startsWith('vite.config.mts.timestamp-')
      )
        continue;
      symlinkSync(join(web, name), join(dir, name));
    }
    symlinkSync(join(root, 'scripts'), join(temp, 'scripts'));
    symlinkSync(join(root, 'node_modules'), join(temp, 'node_modules'));
    let config = readFileSync(join(web, 'vite.config.mts'), 'utf8');
    if (staticCjsImport) {
      const fixed =
        /const webAssetReceipt = createRequire\(import\.meta\.url\)\([\s\S]*?\) as typeof import\([^\n]+\);/;
      if (!fixed.test(config))
        throw Error('Expected current typed createRequire boundary');
      config = config.replace(
        fixed,
        "import webAssetReceipt from '../../scripts/scroll-stability-web-assets.cjs';"
      );
    }
    const configPath = join(dir, 'vite.config.mts');
    writeFileSync(configPath, config);
    const loader = join(temp, 'load.mjs');
    writeFileSync(
      loader,
      `
      import {pathToFileURL} from 'node:url';
      const {loadConfigFromFile}=await import(pathToFileURL(process.argv[2]));
      const result=await loadConfigFromFile({command:'build',mode:'production'},process.argv[3],process.argv[4],'silent');
      if(!result) throw Error('Actual Vite config unavailable');
      const names=result.config.plugins.flat(Infinity).filter(Boolean).map(p=>p.name);
      console.log('SCROLLER_CONFIG_RESULT:'+JSON.stringify({mainGuard:names.filter(n=>n==='scroller-test-isolation-main-v1').length,dependencies:result.dependencies.length}));
    `
    );
    return spawnSync(
      process.execPath,
      [
        loader,
        join(root, 'node_modules/vite/dist/node/index.js'),
        configPath,
        dir,
      ],
      {
        cwd: web,
        encoding: 'utf8',
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          CI: 'false',
          SCROLLER_WEB_BUILD_RECEIPT_GUARD: '1',
        },
      }
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
describe('actual installed production Vite config boundary', () => {
  it('loads the real receipt-enabled config with Node createRequire', () => {
    const result = loadActualReceiptViteConfig();
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    const line = result.stdout
      .split('\n')
      .find((line) => line.startsWith('SCROLLER_CONFIG_RESULT:'));
    expect(line).toBeTruthy();
    expect(
      JSON.parse(line.slice('SCROLLER_CONFIG_RESULT:'.length)).mainGuard
    ).toBe(1);
  });
  it('retains the original static CJS import failure through that same loader', () => {
    const result = loadActualReceiptViteConfig(true);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'Dynamic require of "node:crypto" is not supported'
    );
  });
});

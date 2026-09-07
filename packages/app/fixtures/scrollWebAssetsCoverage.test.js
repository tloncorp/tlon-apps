import { describe, expect, it } from 'vitest';
import {
  assetHash,
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
          clock[key] = key === 'endedAt' ? 1999 : 'wrong';
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

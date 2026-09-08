import { describe, expect, it } from 'vitest';
import { concurrentEvidence } from './scrollConcurrentContentTestSupport';
import {
  concurrentScenarioRegistry,
  replayWebConcurrent,
} from '../../../scripts/scroll-stability-concurrent-content-evidence.mjs';
import {
  readPlaywrightReport,
  assessWebEvidence,
  webScenarioRegistry,
} from '../../../scripts/scroll-stability-web-evidence.mjs';
import { createCoverageReport } from '../../../scripts/scroll-stability-report.mjs';

const attachment = (name, value) => ({
  name,
  contentType: 'application/json',
  body: Buffer.from(JSON.stringify(value)).toString('base64'),
});
function data(position = 'latest', first = 'portrait') {
  const contract = concurrentScenarioRegistry.find(
    (r) => r.concurrentPosition === position && r.concurrentFirst === first
  );
  const proof = concurrentEvidence(position, first);
  const attempt = {
    status: 'passed',
    startTime: '1970-01-01T00:00:00.000Z',
    duration: 10000,
    attachments: [attachment(contract.concurrentAttachment, proof)],
  };
  const report = {
    suites: [
      {
        title: '',
        file: contract.source,
        specs: [
          {
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
  return { contract, proof, attempt, report };
}
const read = (d) =>
  readPlaywrightReport(d.report, '/tmp/concurrent-report.json')[0];
const refresh = (d) => {
  d.attempt.attachments = [
    attachment(d.contract.concurrentAttachment, d.proof),
  ];
  return d;
};

describe('concurrent raw Playwright report integration', () => {
  for (const position of ['latest', 'history'])
    for (const first of ['portrait', 'landscape'])
      it(`replays all raw dimensions for ${position}/${first}`, () => {
        const d = data(position, first);
        const record = read(d);
        expect(record.scenario).toBe(d.contract.scenario);
        expect(record.browserTraces).toEqual([]);
        expect(replayWebConcurrent(record)).toEqual([]);
        expect(assessWebEvidence(record).status).toBe('recorded-sampled-pass');
      });
  it('registers the required product families without keyboard calibration', () => {
    expect(
      webScenarioRegistry.filter((r) => r.requirePendingSendProof)
    ).toHaveLength(2);
    expect(
      webScenarioRegistry.filter((r) => r.requireConcurrentContentProof)
    ).toHaveLength(4);
    expect(
      webScenarioRegistry.filter((r) => r.requireKeyboardProof)
    ).toHaveLength(2);
    expect(
      webScenarioRegistry.filter((r) => r.requireNavigationProof)
    ).toHaveLength(4);
    expect(
      webScenarioRegistry.some((r) =>
        r.source.endsWith('scroller-keyboard-controls.spec.ts')
      )
    ).toBe(false);
  });
  for (const [name, change] of [
    [
      'missing proof',
      (d) => {
        d.attempt.attachments = [];
      },
    ],
    [
      'duplicate proof',
      (d) => {
        d.attempt.attachments.push(d.attempt.attachments[0]);
      },
    ],
    [
      'malformed JSON',
      (d) => {
        d.attempt.attachments[0].body = Buffer.from('{').toString('base64');
      },
    ],
    [
      'only producer PASS',
      (d) => {
        d.attempt.attachments = [
          attachment(
            d.contract.concurrentAttachment.replace('-proof', '-assessment'),
            { verdict: 'PASS' }
          ),
        ];
      },
    ],
    [
      'wrong position',
      (d) => {
        d.proof.position = 'history';
        refresh(d);
      },
    ],
    [
      'wrong order',
      (d) => {
        d.proof.order.reverse();
        refresh(d);
      },
    ],
    [
      'past attempt',
      (d) => {
        d.attempt.startTime = '2026-09-07T00:00:00.000Z';
      },
    ],
    [
      'missing acquisition identity',
      (d) => {
        delete d.proof.reading.trace.blockAcquisition;
        refresh(d);
      },
    ],
    [
      'truncated capture',
      (d) => {
        d.proof.reading.trace.samples.pop();
        refresh(d);
      },
    ],
    [
      'altered PNG',
      (d) => {
        d.proof.media[0].png = 'AAAA';
        refresh(d);
      },
    ],
  ])
    it(`refuses ${name}`, () => {
      const d = data();
      change(d);
      expect(assessWebEvidence(read(d)).status).toBe('incomplete');
    });
  it('never trusts producer PASS over actual 100px reading drift', () => {
    const d = data('history');
    d.proof.reading.trace.samples.at(-1).point.relativeY -= 100;
    refresh(d);
    d.attempt.attachments.push(
      attachment('concurrent-history-portrait-assessment', { verdict: 'PASS' })
    );
    const result = assessWebEvidence(read(d));
    expect(result.status).toBe('fail');
    expect(result.issues.some((x) => x.includes('reading-point-moved'))).toBe(
      true
    );
  });
  it('preserves a qualified reading failure with missing acquisition metadata', () => {
    const d = data('history');
    delete d.proof.reading.trace.blockAcquisition;
    d.proof.reading.trace.samples.at(-1).point.relativeY -= 100;
    refresh(d);
    const result = assessWebEvidence(read(d));
    expect(result.status).toBe('fail');
    expect(result.issues.some((x) => x.includes('acquisition'))).toBe(true);
  });
  it('preserves prior failed attempts via exact legacy history titles', () => {
    const d = data('history');
    d.report.suites[0].specs[0].title = d.contract.legacyTitles[0];
    d.attempt.status = 'failed';
    expect(read(d).scenario).toBe(d.contract.scenario);
    expect(assessWebEvidence(read(d)).status).toBe('fail');
  });
  for (const status of ['passed', 'failed'])
    it(`excludes keyboard ${status} calibration from product counts`, () => {
      const d = data();
      const spec = d.report.suites[0].specs[0];
      spec.file = 'e2e/scroller-keyboard-controls.spec.ts';
      spec.title = 'native textarea and native button calibration';
      spec.tests[0].annotations = [
        { type: 'evidence-kind', description: 'scroller-detector-calibration' },
      ];
      d.attempt.status = status;
      const [record] = readPlaywrightReport(d.report, '/tmp/detectors.json');
      expect(record.excluded).toBe('detector-self-test');
      expect(record.reportedStatus).toBe(status);
      const report = createCoverageReport({
        matrixMarkdown: '| STA-01 | x |\n| FLK-07 | x |\n| FLK-12 | x |',
        historyMarkdown: '| REG-001 | x |',
        registry: concurrentScenarioRegistry,
        evidence: [{ source: '/tmp/detectors.json', value: d.report }],
      });
      expect(report.scenarios.every((r) => r.status === 'not-run')).toBe(true);
      expect(report.excludedEvidence[0].reportedStatus).toBe(status);
      expect(report.counts.failingDetectorAttempts).toBe(
        status === 'failed' ? 1 : 0
      );
    });
});

it('reports complete headless concurrency as sampled behavior without a headed claim', () => {
  const d = data('history', 'landscape');
  d.proof.preparation.headed = false;
  const record = read(refresh(d));
  expect(replayWebConcurrent(record)).toEqual([]);
  expect(assessWebEvidence(record).status).toBe('recorded-sampled-pass');
});

it('retains the accepted near-bottom Latest failure in headless public replay', () => {
  const d = data('history', 'portrait');
  d.proof.preparation.headed = false;
  d.proof.chrome.samples[10].controls[0].visible = true;
  d.proof.chrome.samples[10].controls[0].opacity = 1;
  expect(
    replayWebConcurrent(read(refresh(d))).some(
      (issue) => issue.kind === 'failure'
    )
  ).toBe(true);
});

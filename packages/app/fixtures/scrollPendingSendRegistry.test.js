import { describe, expect, it } from 'vitest';
import { pendingSendScenario } from '../../../scripts/scroll-stability-keyboard-evidence.mjs';
import {
  readPlaywrightReport,
  assessWebEvidence,
  webScenarioRegistry,
} from '../../../scripts/scroll-stability-web-evidence.mjs';

const attachment = (name, value) => ({
  name,
  contentType: 'application/json',
  body: Buffer.from(JSON.stringify(value)).toString('base64'),
});
function data() {
  const raw = { token: 'incomplete-control' };
  const attempt = {
    status: 'passed',
    retry: 0,
    startTime: '2026-09-07T00:00:00.000Z',
    duration: 5000,
    attachments: [
      attachment(pendingSendScenario.attachment, {
        proof: raw,
        assessment: { verdict: 'PASS' },
      }),
      attachment(pendingSendScenario.rawAttachment, raw),
    ],
  };
  const test = {
    projectName: 'chromium',
    expectedStatus: 'passed',
    results: [attempt],
  };
  const report = {
    suites: [
      {
        title: '',
        specs: [
          {
            id: 'pending-send-test',
            title: pendingSendScenario.title,
            file: pendingSendScenario.source,
            tests: [test],
          },
        ],
      },
    ],
  };
  return { attempt, test, report };
}
const read = (d) =>
  readPlaywrightReport(d.report, '/tmp/pending-send-registry-control.json')[0];

describe('pending-send shared product registry and raw replay boundary', () => {
  it('registers exactly one bounded case with its exact partial matrix scope', () => {
    const entries = webScenarioRegistry.filter(
      (r) => r.requirePendingSendProof
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].scenario).toBe(pendingSendScenario.scenario);
    expect(entries[0].matrix).toEqual(['SND-04', 'RAC-08', 'AC-12']);
    expect(entries[0].traceNames).toEqual([]);
    expect(webScenarioRegistry).toHaveLength(42);
  });
  it('extracts both raw attachments and refuses a producer pass on incomplete evidence', () => {
    const record = read(data());
    expect(record.excluded).toBeNull();
    expect(record.pendingSendProofs.map((p) => p.name)).toEqual([
      pendingSendScenario.attachment,
      pendingSendScenario.rawAttachment,
    ]);
    expect(record.pendingSendProofs.every((p) => !p.error)).toBe(true);
    expect(assessWebEvidence(record).status).toBe('incomplete');
    expect(
      assessWebEvidence(record).issues.some((s) =>
        s.startsWith('Pending send:')
      )
    ).toBe(true);
  });
  for (const name of [
    pendingSendScenario.attachment,
    pendingSendScenario.rawAttachment,
  ]) {
    it(`rejects missing ${name}`, () => {
      const d = data();
      d.attempt.attachments = d.attempt.attachments.filter(
        (a) => a.name !== name
      );
      expect(assessWebEvidence(read(d)).status).toBe('incomplete');
    });
    it(`rejects duplicate ${name}`, () => {
      const d = data();
      d.attempt.attachments.push(
        d.attempt.attachments.find((a) => a.name === name)
      );
      expect(assessWebEvidence(read(d)).status).toBe('incomplete');
    });
  }
  it('rejects a weakened copied registry contract', () => {
    const record = read(data());
    record.contract = { ...record.contract, matrix: [] };
    expect(assessWebEvidence(record).issues).toContain(
      'Pending send: missing exact registered contract'
    );
  });
  it('cannot hide a registered product attempt with a calibration annotation', () => {
    const d = data();
    d.test.annotations = [
      { type: 'evidence-kind', description: 'scroller-detector-calibration' },
    ];
    expect(read(d).excluded).toBeNull();
    expect(assessWebEvidence(read(d)).status).toBe('incomplete');
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {
  verifyPresentation,
  clipWindows,
  cutClip,
  renderPresentation,
} from './presentation.mjs';
import { reviewArgs } from './review.mjs';
const finding = {
  title: 'Title moved',
  status: 'failed',
  file: 'Note.tsx',
  trigger: 'Saving',
  observed: 'Moved under header',
  evidenceActions: [1, 2],
};
const report = {
  status: 'failed',
  discoveries: [finding, { ...finding, title: 'Title shifted' }],
  checks: [
    { status: 'blocked', expected: 'Order updates', observed: 'No counters' },
  ],
};
const value = {
  findings: [
    {
      sources: ['finding-1', 'finding-2'],
      title: 'Saving hides the title',
      when: 'Save',
      happened: 'Title moves',
      impact: 'Title is obscured',
    },
  ],
  incomplete: [
    { source: 'check-1', explanation: 'Update ordering was not tested.' },
  ],
};
test('editing may group duplicates but cannot lose or invent findings or coverage', () => {
  assert.equal(verifyPresentation(value, report), value);
  for (const mutate of [
    (v) => v.findings[0].sources.pop(),
    (v) => v.findings[0].sources.push('finding-3'),
    (v) => v.findings[0].sources.push('finding-1'),
    (v) => v.incomplete.pop(),
  ]) {
    const v = structuredClone(value);
    mutate(v);
    assert.throws(() => verifyPresentation(v, report));
  }
  assert.throws(() =>
    verifyPresentation(value, {
      ...report,
      discoveries: [finding, { ...finding, status: 'blocked' }],
    })
  );
  const args = reviewArgs(
    { cwd: '/tmp', schema: 's', output: 'o', instructions: 'i' },
    'editorial'
  );
  assert.ok(!args.some((a) => a.startsWith('mcp_servers.')));
  assert.ok(args.includes('features.shell_tool=false'));
});
test('one observed defect may include different source files and a failed planned check', () => {
  const r = {
    ...report,
    discoveries: [finding, { ...finding, file: 'Header.tsx' }],
    checks: [
      ...report.checks,
      {
        status: 'failed',
        expected: 'Title remains visible',
        observed: finding.observed,
      },
    ],
  };
  const v = structuredClone(value);
  v.findings[0].sources.push('check-2');
  assert.equal(verifyPresentation(v, r), v);
});
test('clip intervals prefer actual reviewed frames, clamp padding, and label approximate action timing', () => {
  const receipts = {
    'video-frames-1': { frames: [{ seconds: 4 }, { seconds: 4.1 }] },
  };
  const precise = clipWindows(
    [{ ...finding, observed: 'See video-frames-1' }],
    receipts,
    { actions: [] },
    10
  );
  assert.equal(precise[0].start, 2);
  assert.equal(precise[0].end, 7.1);
  assert.equal(precise[0].basis, 'reviewed frames');
  const approx = clipWindows(
    [finding],
    {},
    {
      actions: [
        { index: 1, approximateSeconds: 0.2 },
        { index: 2, approximateSeconds: 3 },
      ],
    },
    5
  );
  assert.equal(approx[0].start, 0);
  assert.equal(approx[0].end, 5);
  assert.equal(approx[0].basis, 'approximate action times');
  assert.deepEqual(clipWindows([finding], {}, {}, 10), []);
});
test('finding clip is beside its explanation and full evidence remains available', () => {
  const output = renderPresentation(
    { context: { pr: { head: { sha: 'a'.repeat(40) } } }, report },
    value,
    [[{ start: 2, end: 7, file: 'finding-1-1.mp4', basis: 'reviewed frames' }]],
    'https://example.com/run',
    'Raw findings'
  );
  assert.ok(
    output.indexOf('![Finding 1](./finding-1-1.mp4)') <
      output.indexOf('<summary>Original reviewer evidence')
  );
  assert.match(output, /Raw findings/);
  assert.match(output, /Full test recording/);
  assert.match(output, /Update ordering was not tested/);
});
test(
  'clip cutting preserves a one-frame transient at its expected source offset',
  { skip: spawnSync('ffmpeg', ['-version']).status !== 0 },
  () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'qa-clip-test-'));
    try {
      const video = path.join(dir, 'source.mp4'),
        clip = path.join(dir, 'clip.mp4');
      execFileSync('ffmpeg', [
        '-v',
        'error',
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=black:s=64x64:r=30:d=2',
        '-vf',
        "drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='eq(n,33)'",
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        video,
      ]);
      cutClip(video, clip, { start: 1, end: 1.3 });
      const pixels = execFileSync('ffmpeg', [
        '-v',
        'error',
        '-i',
        clip,
        '-vf',
        'scale=1:1,format=gray',
        '-f',
        'rawvideo',
        'pipe:1',
      ]);
      assert.equal(pixels.length, 9);
      assert.ok(pixels[3] > 230);
      assert.ok([...pixels].every((p, i) => i === 3 || p < 15));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
);

test('every original finding and incomplete check is a required output field', async () => {
  const { presentationPlan } = await import('./presentation.mjs');
  const { schema, decode } = presentationPlan(report);
  assert.deepEqual(schema.properties.assignments.required, [
    'finding-1',
    'finding-2',
  ]);
  assert.deepEqual(schema.properties.incomplete.required, ['check-1']);
  const raw = {
    findings: [
      {
        id: 'group-1',
        title: 'Title hides',
        when: 'Saving',
        happened: 'Title moves',
        impact: 'Title is obscured',
      },
    ],
    assignments: { 'finding-1': 'group-1', 'finding-2': 'group-1' },
    incomplete: { 'check-1': 'Ordering was not tested.' },
  };
  assert.equal(
    verifyPresentation(decode(raw), report).findings[0].sources.length,
    2
  );
  delete raw.assignments['finding-2'];
  assert.throws(() => decode(raw), /required report assignments/);
});

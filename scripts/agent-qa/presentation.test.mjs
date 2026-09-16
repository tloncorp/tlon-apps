import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { explainReport, cutClip, renderPresentation } from './presentation.mjs';
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

test('publishing preserves every finding and incomplete check without another model', () => {
  const rendered = explainReport(report);
  assert.equal(rendered.findings.length, 2);
  assert.equal(rendered.findings[0].happened, finding.observed);
  assert.deepEqual(rendered.incomplete, [
    { source: 'check-1', explanation: 'No counters' },
  ]);
});

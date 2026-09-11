import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {
  videoReader,
  validateFrameRequest,
  verifyVideoReferences,
} from './video-tools.mjs';

test('video frame requests cannot invent frames or hide sampling gaps', () => {
  assert.deepEqual(
    validateFrameRequest(
      { startFrame: 1, count: 3, stride: 2, region: 'top' },
      6
    ),
    [1, 3, 5]
  );
  for (const a of [
    { startFrame: 0, count: 7, stride: 1, region: 'full' },
    { startFrame: 1, count: 3, stride: 3, region: 'top' },
    { startFrame: 0, count: 2, stride: 0, region: 'top' },
  ])
    assert.throws(() => validateFrameRequest(a, 6));
  assert.throws(
    () =>
      verifyVideoReferences({ checks: [{ evidence: ['video-frames-3'] }] }, {}),
    /uninspected/
  );
});
const ffmpegAvailable = spawnSync('ffmpeg', ['-version']).status === 0;
for (const drawLabels of [true, false])
  test(
    `native frame extraction retains a one-frame transient (printed labels: ${drawLabels})`,
    { skip: !ffmpegAvailable },
    () => {
      const dir = mkdtempSync(path.join(os.tmpdir(), 'qa-video-test-'));
      try {
        const file = path.join(dir, 'flash.mp4');
        execFileSync('ffmpeg', [
          '-v',
          'error',
          '-y',
          '-f',
          'lavfi',
          '-i',
          'color=black:s=400x800:r=30:d=0.1',
          '-vf',
          "drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='eq(n,1)'",
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          file,
        ]);
        const reader = videoReader({
          file,
          drawLabels,
          outputDir: path.join(dir, 'video-frames'),
        });
        assert.equal(reader.info.totalFrames, 3);
        const result = reader.call('inspect_video_frames', {
          startFrame: 0,
          count: 3,
          stride: 1,
          region: 'top',
        });
        const receipt = JSON.parse(result[0].text);
        assert.deepEqual(
          receipt.frames.map((f) => f.index),
          [0, 1, 2]
        );
        assert.ok(Math.abs(receipt.frames[1].seconds - 1 / 30) < 0.00001);
        assert.equal(receipt.contiguous, true);
        assert.deepEqual(
          receipt.frames.map((f) => [f.row, f.column]),
          [
            [1, 1],
            [1, 2],
            [1, 3],
          ]
        );
        const resumed = videoReader({
          file,
          drawLabels,
          outputDir: path.join(dir, 'video-frames'),
        });
        const next = JSON.parse(
          resumed.call('inspect_video_frames', {
            startFrame: 1,
            count: 1,
            stride: 1,
            region: 'full',
          })[0].text
        );
        assert.equal(next.evidenceId, 'video-frames-2');
        assert.ok(
          JSON.parse(
            readFileSync(path.join(dir, 'video-frames/receipts.json'))
          )['video-frames-1']
        );
        if (!drawLabels) assert.equal(receipt.timestampsPrinted, false);
        const png = path.join(dir, 'video-frames/video-frames-1.png');
        // Sample below the timestamp labels: only the middle cell must be white.
        const values = [100, 504, 908].map(
          (x) =>
            execFileSync('ffmpeg', [
              '-v',
              'error',
              '-i',
              png,
              '-vf',
              `crop=2:2:${x}:100,format=gray`,
              '-f',
              'rawvideo',
              '-frames:v',
              '1',
              'pipe:1',
            ])[0]
        );
        assert.ok(
          values[0] < 10 && values[1] > 240 && values[2] < 10,
          values.join(',')
        );
        const receipts = JSON.parse(
          readFileSync(path.join(dir, 'video-frames/receipts.json'))
        );
        verifyVideoReferences(
          { checks: [{ evidence: ['video-frames-1'] }] },
          receipts
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  );

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  rmSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { videoReader } from './video-tools.mjs';

// Synthetic frames only: exercise the real saved-report -> clip -> comment path,
// with external publication disabled. No product footage or model is involved.
test('the single recorded flow retains findings, makes one complete clip and retries from its saved review', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'qa-recorded-flow-'));
  const source = path.join(root, 'capture');
  const app = path.join(root, 'apps/tlon-mobile');
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
  try {
    mkdirSync(source);
    mkdirSync(app, { recursive: true });
    symlinkSync(
      fileURLToPath(new URL('../', import.meta.url)),
      path.join(root, 'scripts'),
      'dir'
    );
    git('init', '-q');
    git(
      '-c',
      'user.name=QA',
      '-c',
      'user.email=qa@example.invalid',
      'commit',
      '--allow-empty',
      '-qm',
      'synthetic evidence'
    );
    const sha = git('rev-parse', 'HEAD');
    const video = path.join(root, 'recording.mp4');
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=black:s=64x128:r=10:d=4',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      video,
    ]);
    const frames = videoReader({
      file: video,
      outputDir: path.join(source, 'video-frames'),
      drawLabels: false,
    });
    frames.call('inspect_video_frames', {
      startFrame: 0,
      count: 4,
      stride: 10,
      region: 'full',
    });
    const receipt = JSON.parse(
      readFileSync(path.join(source, 'video-frames/receipts.json'))
    );
    const moments = Object.fromEntries(
      ['before', 'trigger', 'outcome', 'settled'].map((key, i) => [
        key,
        {
          frame: i * 10,
          evidenceId: 'video-frames-1',
          observation: `Synthetic ${key}`,
        },
      ])
    );
    const original = {
      context: {
        mode: 'PR review',
        harnessSha: sha,
        buildSha: sha,
        buildId: 'synthetic',
        evidenceReview: 'completed',
        assessment: {
          scenarios: [
            {
              id: 'path-1',
              steps: ['Synthetic action'],
              expected: 'Synthetic outcome',
            },
          ],
        },
        pr: {
          number: 1,
          head: { sha, repo: { full_name: 'tloncorp/tlon-apps' } },
          base: { repo: { full_name: 'tloncorp/tlon-apps' } },
        },
        video: { status: 'ready', durationSeconds: 4, width: 64, height: 128 },
      },
      report: {
        status: 'failed',
        summary: 'Synthetic finding',
        discoveries: [],
        checks: [
          {
            scenarioId: 'path-1',
            status: 'failed',
            expected: 'Synthetic outcome',
            observed: 'Synthetic problem',
            evidence: ['video-frames-1'],
            clipEvidence: [
              { label: 'Synthetic clip', additionalCase: '', ...moments },
            ],
          },
        ],
      },
      usage: { calls: 0, tokens: 0 },
      evidence: receipt,
    };
    writeFileSync(path.join(source, 'report.json'), JSON.stringify(original));
    writeFileSync(path.join(source, 'codex-events.jsonl'), '');
    const env = {
      ...process.env,
      QA_EVIDENCE_PATH: source,
      QA_VIDEO_PATH: video,
      QA_PUBLISH: 'false',
      QA_WORKFLOW_URL:
        'https://expo.dev/accounts/tlon/projects/groups/workflows/01a0ab1b-248b-7310-b88c-29c10a21d812',
      QA_PR_NUMBER: '1',
      QA_HEAD_SHA: sha,
      OPENROUTER_API_KEY: '',
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      execFileSync(
        process.execPath,
        [fileURLToPath(new URL('./review-recording.mjs', import.meta.url))],
        { cwd: app, env, encoding: 'utf8', stdio: 'pipe', timeout: 20000 }
      );
      const out = path.join(root, 'artifacts/qa-presentation');
      const report = readFileSync(path.join(out, 'report.md'), 'utf8');
      assert.match(report, /Review completed/);
      assert.match(report, /Synthetic problem/);
      assert.match(report, /"findings":1/);
      assert.equal(
        readdirSync(out).filter((name) => name.endsWith('.mp4')).length,
        2
      );
      const selected = JSON.parse(
        readFileSync(path.join(out, 'clip-selection.json'))
      );
      assert.equal(selected.windows[0][0].end, 4);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

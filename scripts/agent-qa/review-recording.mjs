// Read-only replay for evaluating the evidence reviewer without another device run.
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from 'node:fs';
import path from 'node:path';
import { reviewEvidence } from './review.mjs';
import { verifyCodexAuth } from './codex.mjs';
import { verifyReport, renderReport } from './core.mjs';
import { verifyCoverage } from './assess.mjs';
const descriptor = JSON.parse(process.env.QA_REPLAY_EVIDENCE || 'null');
const { id, sha, artifact } = descriptor || {};
if (
  !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id || '') ||
  !/^[a-f0-9]{40}$/.test(sha || '')
)
  throw new Error('Expected pinned replay metadata');
if (
  !artifact ||
  !(artifact.fileSizeBytes > 0 && artifact.fileSizeBytes <= 100 * 1024 * 1024)
)
  throw new Error('Missing or oversized trace artifact');
const url = new URL(artifact.downloadUrl);
if (
  url.protocol !== 'https:' ||
  url.hostname !== 'wf-artifacts.eascdn.net' ||
  url.username ||
  url.password
)
  throw new Error('Expected an EAS workflow artifact');
const root = path.resolve('../..'),
  out = path.join(root, 'artifacts/evidence-replay');
mkdirSync(out, { recursive: true });
const response = await fetch(artifact.downloadUrl, {
  signal: AbortSignal.timeout(120000),
});
if (!response.ok) throw new Error(`Evidence download ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.length !== artifact.fileSizeBytes)
  throw new Error('Evidence size mismatch');
const archive = path.join(out, 'trace.tar.gz');
writeFileSync(archive, bytes);
const extract = path.join(out, 'recorded');
execFileSync(
  'python3',
  [
    '-c',
    'import sys,tarfile; t=tarfile.open(sys.argv[1]); t.extractall(sys.argv[2],filter="data")',
    archive,
    extract,
  ],
  { timeout: 60000 }
);
const source = execFileSync(
  'python3',
  [
    '-c',
    'import sys,pathlib; p=list(pathlib.Path(sys.argv[1]).rglob("report.json")); assert len(p)==1; print(p[0].parent)',
    extract,
  ],
  { encoding: 'utf8' }
).trim();
const original = JSON.parse(
  readFileSync(path.join(source, 'report.json'), 'utf8')
);
if (original.context.harnessSha !== sha)
  throw new Error('Recording source mismatch');
const assessment = {
  ...original.context.assessment,
  scenarios: original.context.assessment.scenarios.filter(
    (s) => s.method !== 'regression'
  ),
};
const operator = {
  ...original.report,
  checks: original.report.checks.filter((c) =>
    assessment.scenarios.some((s) => s.id === c.scenarioId)
  ),
};
let video;
if (descriptor.video) {
  const v = descriptor.video,
    url = new URL(v.downloadUrl);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'wf-artifacts.eascdn.net' ||
    url.username ||
    url.password ||
    !(v.fileSizeBytes > 0 && v.fileSizeBytes <= 100 * 1024 * 1024)
  )
    throw new Error('Invalid recorded video artifact');
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error('Video artifact unavailable');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== v.fileSizeBytes) throw new Error('Video size mismatch');
  const file = path.join(out, 'test-session.mp4');
  writeFileSync(file, bytes);
  const recording = JSON.parse(
    readFileSync(path.join(source, 'recording.json'), 'utf8')
  );
  const startedAt =
    original.context.video.startedAt ||
    Number(recording.video?.match(/-(\d{13})\.mp4$/)?.[1]) ||
    null;
  video = { file, startedAt };
}

await verifyCodexAuth(process.env.OPENROUTER_API_KEY);
const usage = { calls: 0, tokens: 0, cost: null };
const result = await reviewEvidence({
  assessment,
  result: operator,
  artifacts: source,
  usage,
  video,
  videoOnly: Boolean(video),
});
result.status = [...result.checks, ...result.discoveries].some(
  (c) => c.status === 'failed'
)
  ? 'failed'
  : [...result.checks, ...result.discoveries].some(
        (c) => c.status === 'blocked'
      )
    ? 'blocked'
    : 'passed';
const receipts =
  video && existsSync(path.join(source, 'video-frames/receipts.json'))
    ? JSON.parse(
        readFileSync(path.join(source, 'video-frames/receipts.json'), 'utf8')
      )
    : {};
verifyCoverage(
  verifyReport(
    result,
    new Map(Object.entries({ ...original.evidence, ...receipts }))
  ),
  assessment
);
const context = {
  ...original.context,
  mode: 'Evidence replay only',
  assessment,
};
const report = renderReport(context, result, usage);
writeFileSync(
  path.join(out, 'replay.json'),
  JSON.stringify(
    {
      originalRun: id,
      reviewerSource: execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim(),
      result,
      evidence: receipts,
      usage,
    },
    null,
    2
  )
);
writeFileSync(path.join(out, 'report.md'), report);
console.log(report);
// Keep original evidence at its source run, and retain only this review's receipts/events.
rmSync(archive, { force: true });
if (video) rmSync(video.file, { force: true });

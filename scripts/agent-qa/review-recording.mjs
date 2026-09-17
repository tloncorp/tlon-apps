// Finish device evidence on Linux. Re-entering this worker resumes completed stages.
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  statSync,
  cpSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import { reviewEvidence } from './review.mjs';
import { verifyCodexAuth, interruptedResult } from './codex.mjs';
import { verifyReport, renderReport } from './core.mjs';
import { billingSummary } from './billing.mjs';
const env = process.env;
const root = path.resolve('../..'),
  out = path.join(root, 'artifacts/evidence-review');
mkdirSync(out, { recursive: true });
const id = env.QA_WORKFLOW_URL?.split('/').at(-1);
const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
if (!env.QA_EVIDENCE_PATH || !env.QA_VIDEO_PATH || !id)
  throw new Error('Missing workflow evidence');
const extract = path.join(out, 'recorded');
const marker = path.join(out, 'extracted.json');
if (!existsSync(marker)) {
  const archive = env.QA_EVIDENCE_PATH;
  if (statSync(archive).isDirectory())
    cpSync(archive, extract, { recursive: true });
  else
    execFileSync('python3', [
      '-c',
      'import sys,tarfile; tarfile.open(sys.argv[1]).extractall(sys.argv[2],filter="data")',
      archive,
      extract,
    ]);
  writeFileSync(marker, JSON.stringify({ id, sha }));
  rmSync(path.join(out, 'source.tar.gz'), { force: true });
}
const saved = JSON.parse(readFileSync(marker));
if (saved.id !== id || saved.sha !== sha)
  throw new Error('Cannot reuse another recording checkpoint');
const source = execFileSync(
  'python3',
  [
    '-c',
    'import sys,pathlib; p=list(pathlib.Path(sys.argv[1]).rglob("report.json")); assert len(p)==1; print(p[0].parent)',
    extract,
  ],
  { encoding: 'utf8' }
).trim();
const original = JSON.parse(readFileSync(path.join(source, 'report.json')));
if (original.context.harnessSha !== sha)
  throw new Error('Recording source mismatch');
const assessment = original.context.assessment;
const videoFile = env.QA_VIDEO_PATH;
const video = { file: videoFile, startedAt: original.context.video.startedAt };
const usage = original.usage || { calls: 0, tokens: 0, cost: null };
let result = original.report;
if (original.context.evidenceReview !== 'completed') {
  await verifyCodexAuth(env.OPENROUTER_API_KEY);
  const operator = original.report.checks.some((c) => c.scenarioId)
    ? {
        ...original.report,
        checks: original.report.checks.filter((c) =>
          assessment.scenarios.some((s) => s.id === c.scenarioId)
        ),
      }
    : interruptedResult(assessment, original.report.summary);
  // Unreached starting paths remain visible to the reviewer.
  for (const c of interruptedResult(assessment, 'evidence awaiting review')
    .checks)
    if (!operator.checks.some((old) => old.scenarioId === c.scenarioId))
      operator.checks.push(c);
  result = await reviewEvidence({
    assessment,
    result: operator,
    artifacts: source,
    usage,
    video,
  });
  for (const check of original.report.checks.filter((c) => c.infrastructure))
    result.checks.push(check);
}
for (const check of interruptedResult(
  assessment,
  'Not explored in this session'
).checks)
  if (!result.checks.some((c) => c.scenarioId === check.scenarioId))
    result.checks.push({ ...check, observed: 'Not explored in this session.' });
const receiptPath = path.join(source, 'video-frames/receipts.json');
const receipts = existsSync(receiptPath)
  ? JSON.parse(readFileSync(receiptPath))
  : {};
result.status = [...result.checks, ...(result.discoveries || [])].some(
  (c) => c.status === 'failed'
)
  ? 'failed'
  : [...result.checks, ...(result.discoveries || [])].some(
        (c) => c.status === 'blocked'
      )
    ? 'blocked'
    : 'passed';
const evidence = { ...original.evidence, ...receipts };
verifyReport(result, new Map(Object.entries(evidence)));
const context = {
  ...original.context,
  evidenceReview: 'completed',
  billing: billingSummary(source),
};
const counts = { passed: 0, failed: 0, blocked: 0 };
for (const check of result.checks) counts[check.status]++;
result.summary = `${counts.passed} checks passed; ${counts.failed} failed; ${counts.blocked} not fully verified. ${result.discoveries?.length || 0} unexpected findings.`;
const final = { ...original, context, report: result, usage, evidence };
writeFileSync(path.join(source, 'report.json'), JSON.stringify(final));
writeFileSync(
  path.join(out, 'review.json'),
  JSON.stringify({ originalRun: id, result, evidence, usage })
);
writeFileSync(
  path.join(out, 'report.md'),
  renderReport(context, result, usage)
);
console.log(result.summary);
execFileSync(
  process.execPath,
  [path.join(root, 'scripts/agent-qa/present-run.mjs')],
  {
    env: {
      ...env,
      QA_EVIDENCE_PATH: source,
      QA_VIDEO_PATH: videoFile,
      QA_WORKFLOW_URL: `https://expo.dev/accounts/tlon/projects/groups/workflows/${id}`,
    },
    stdio: 'inherit',
    timeout: 12 * 60_000,
  }
);

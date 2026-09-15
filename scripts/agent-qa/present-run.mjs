import { publishComment } from './comment.mjs';
import { billingSummary } from './billing.mjs';
// Run on the publisher worker. Only the editorial agent rewrites the recorded report.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  copyFileSync,
  writeFileSync,
  statSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import {
  explainReport,
  makeClips,
  renderPresentation,
} from './presentation.mjs';
import { renderReport } from './core.mjs';
import { videoReader } from './video-tools.mjs';
import { readActions } from './review-tools.mjs';
import { reviewFindingClips } from './clip-review.mjs';

const env = process.env,
  out = path.resolve('../../artifacts/qa-presentation');
mkdirSync(out, { recursive: true });
const command = (bin, args, options = {}) =>
  execFileSync(bin, args, {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
async function download(a, file) {
  const url = new URL(a?.downloadUrl);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'wf-artifacts.eascdn.net' ||
    url.username ||
    url.password ||
    !(a.fileSizeBytes > 0 && a.fileSizeBytes <= 200 * 1024 * 1024)
  )
    throw new Error('Invalid recorded artifact');
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('Recorded artifact download failed');
  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length !== a.fileSizeBytes)
    throw new Error('Recorded artifact size mismatch');
  writeFileSync(file, bytes);
  return file;
}
let trace = env.QA_EVIDENCE_PATH,
  video = env.QA_VIDEO_PATH,
  sourceUrl = env.QA_WORKFLOW_URL,
  expectedHarness;
const replay = env.QA_PRESENT_EVIDENCE
  ? JSON.parse(env.QA_PRESENT_EVIDENCE)
  : null;
if (replay) {
  if (
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(replay.id) ||
    !/^[a-f0-9]{40}$/.test(replay.sha)
  )
    throw new Error('Missing replay provenance');
  expectedHarness = replay.sha;
  sourceUrl = `https://expo.dev/accounts/tlon/projects/groups/workflows/${replay.id}`;
  trace = await download(replay.artifact, path.join(out, 'source.tar.gz'));
  video = await download(replay.video, path.join(out, 'test-session.mp4'));
}
if (!trace || !video) throw new Error('Missing recorded report or video');
if (!statSync(trace).isDirectory()) {
  const extract = path.join(out, 'recorded');
  command('python3', [
    '-c',
    'import sys,tarfile; tarfile.open(sys.argv[1]).extractall(sys.argv[2],filter="data")',
    trace,
    extract,
  ]);
  trace = extract;
}
function findReports(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? findReports(path.join(dir, e.name))
      : e.isFile() && e.name === 'report.json'
        ? [path.join(dir, e.name)]
        : []
  );
}
const reports = findReports(trace);
if (reports.length !== 1) throw new Error('Expected one recorded QA report');
const source = path.dirname(reports[0]),
  original = JSON.parse(readFileSync(reports[0]));
const c = original.context;
if (expectedHarness && c.harnessSha !== expectedHarness)
  throw new Error('Recording source mismatch');
if (replay?.reviewerRun && c.evidenceReview !== 'completed')
  throw new Error('Recorded review did not complete');
if (
  !/^[1-9][0-9]*$/.test(String(c.pr?.number)) ||
  !/^[a-f0-9]{40}$/.test(c.pr?.head?.sha) ||
  c.pr?.head?.repo?.full_name !== 'tloncorp/tlon-apps' ||
  c.video?.status !== 'ready'
)
  throw new Error('Missing test provenance');
if (
  (env.QA_PR_NUMBER && Number(env.QA_PR_NUMBER) !== c.pr.number) ||
  (env.QA_HEAD_SHA && env.QA_HEAD_SHA !== c.pr.head.sha)
)
  throw new Error('PR source mismatch');
const fullVideo = path.join(out, 'test-session.mp4');
if (path.resolve(video) !== fullVideo) copyFileSync(video, fullVideo);
const probe = JSON.parse(
  command('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=duration,width,height',
    '-of',
    'json',
    fullVideo,
  ])
).streams[0];
if (
  !probe ||
  Math.abs(Number(probe.duration) - c.video.durationSeconds) > 0.15 ||
  probe.width !== c.video.width ||
  probe.height !== c.video.height
)
  throw new Error('Recording does not match report');
const optionalJSON = (p) => (existsSync(p) ? JSON.parse(readFileSync(p)) : {});
const info = existsSync(path.join(source, 'video-frames/video-info.json'))
  ? optionalJSON(path.join(source, 'video-frames/video-info.json'))
  : videoReader({
      file: fullVideo,
      outputDir: path.join(source, 'video-frames'),
      startedAt: c.video.startedAt,
      actions: readActions(path.join(source, 'argent-trace.jsonl')),
      drawLabels: false,
    }).info;
const usage = { calls: 0, tokens: 0, cost: null };
const presentation = await explainReport(original.report, out, usage);
writeFileSync(
  path.join(out, 'presentation.json'),
  JSON.stringify(
    { originalRun: sourceUrl, sourceHead: c.pr.head.sha, presentation, usage },
    null,
    2
  )
);
const reviewedClips = await reviewFindingClips({
  original,
  presentation,
  source,
  video: fullVideo,
  outputDir: out,
  usage,
});
writeFileSync(
  path.join(out, 'clip-selection.json'),
  JSON.stringify(reviewedClips)
);
for (const [i, finding] of presentation.findings.entries())
  finding.clipUnavailableReason =
    reviewedClips.selection[`group-${i + 1}`]?.unavailableReason || '';
original.context.billing = billingSummary(source);
original.context.presentationBilling = billingSummary(out);
const clips = makeClips(
  original,
  presentation,
  reviewedClips.windows,
  fullVideo,
  out
);
const text = renderPresentation(
  original,
  presentation,
  clips,
  sourceUrl,
  renderReport(c, original.report, original.usage)
);
const marker = `<!-- ios-agent-qa-presentation:${sourceUrl.split('/').at(-1)}:${command('git', ['rev-parse', 'HEAD']).trim()} -->`;
writeFileSync(path.join(out, 'report.md'), marker + '\n' + text);
writeFileSync(path.join(out, 'original-report.json'), JSON.stringify(original));
// The original run retains screenshots and traces. Do not upload a second copy.
rmSync(path.join(out, 'recorded'), { recursive: true, force: true });
rmSync(path.join(out, 'source.tar.gz'), { force: true });
console.log(
  `Prepared ${presentation.findings.length} readable findings and ${clips.flat().length} clips.`
);
if (env.QA_PUBLISH === 'false') process.exit(0);
const gh = (args) =>
  command(env.QA_GH_BIN || '/tmp/gh_2.99.0_linux_amd64/bin/gh', args, {
    cwd: out,
    env: { ...env, GH_TOKEN: env.GH_QA_TOKEN },
  });
const repo = 'tloncorp/tlon-apps',
  pr = String(c.pr.number);
const target = JSON.parse(gh(['api', `repos/${repo}/pulls/${pr}`]));
if (
  target.head.repo?.full_name !== repo ||
  target.base.repo?.full_name !== repo
)
  throw new Error('Target PR is outside the expected repository');
const historical = target.head.sha !== c.pr.head.sha;
if (historical) {
  const notice = `> **Earlier test results.** These clips were recorded at commit \`${c.pr.head.sha.slice(0, 10)}\`. The PR is now at \`${target.head.sha.slice(0, 10)}\`. This updates the presentation of the saved run; it does not retest the latest code.\n\n`;
  writeFileSync(path.join(out, 'report.md'), marker + '\n' + notice + text);
}
const rendered = publishComment({
  gh,
  pr,
  directory: out,
  body: readFileSync(path.join(out, 'report.md'), 'utf8'),
  attempt: { url: sourceUrl, head: c.pr.head.sha, key: marker, kind: 'report' },
  attachments: [...clips.flat().map((c) => c.file), 'test-session.mp4'],
});
const comment = rendered,
  players = rendered.players;
writeFileSync(
  path.join(out, 'publication.json'),
  JSON.stringify(
    {
      url: comment.html_url,
      players,
      clipCount: clips.flat().length,
      sourceHead: c.pr.head.sha,
      currentHead: target.head.sha,
      historical,
    },
    null,
    2
  )
);
writeFileSync('/tmp/qa-comment-url', comment.html_url);
console.log(`Published ${players} verified video players: ${comment.html_url}`);

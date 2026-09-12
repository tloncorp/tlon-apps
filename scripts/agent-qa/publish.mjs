import { publishComment } from './comment.mjs';
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = 'tloncorp/tlon-apps';
const project = '617bb643-5bf6-4c40-8af6-c6e9dd7e3bd0';
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export function selectEvidence(run, id) {
  if (
    !uuid.test(id) ||
    run.id !== id ||
    run.workflow?.app?.id !== project ||
    run.workflow?.fileName !== 'pr-agent-qa-ios.yml'
  ) {
    throw new Error('EAS run does not belong to this QA workflow');
  }
  if (!['SUCCESS', 'FAILURE', 'CANCELED'].includes(run.status)) {
    throw new Error('EAS run has not finished');
  }
  if (!/^[a-f0-9]{40}$/.test(run.gitCommitHash))
    throw new Error('Missing EAS source commit');
  const job = run.jobs.find((j) => j.key === 'qa_ios');
  const report = job?.outputs?.report;
  if (typeof report !== 'string' || report.length > 50_000)
    throw new Error('Missing or oversized QA report');
  const video = job.artifacts?.find(
    (a) =>
      a.id === job.outputs.video_artifact && a.name === 'ios-agent-qa-video'
  );
  if (
    video &&
    (video.filename !== 'test-session.mp4' ||
      !(video.fileSizeBytes > 0 && video.fileSizeBytes <= 100 * 1024 * 1024) ||
      new URL(video.downloadUrl).protocol !== 'https:')
  )
    throw new Error('Invalid video artifact');
  return { report, video, sha: run.gitCommitHash };
}

function command(bin, args, options = {}) {
  return execFileSync(bin, args, {
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

async function main() {
  const id = process.env.QA_EAS_RUN_ID;
  const pr = process.env.QA_PR_NUMBER;
  if (!uuid.test(id ?? '') || !/^[1-9][0-9]*$/.test(pr ?? ''))
    throw new Error('Expected an EAS run UUID and PR number');
  const dir = join(process.env.RUNNER_TEMP, 'qa-publish');
  mkdirSync(dir, { recursive: true });
  const marker = `<!-- ios-agent-qa:${id} -->`;
  const videoPath = join(dir, 'test-session.mp4');
  const bodyPath = join(dir, 'report.md');
  if (process.argv[2] === 'prepare') {
    // Query EAS metadata without evaluating the app's config or installing its dependencies.
    const queryDir = join(dir, 'eas-query');
    mkdirSync(queryDir, { recursive: true });
    writeFileSync(
      join(queryDir, 'package.json'),
      JSON.stringify({ name: 'qa-artifact-publisher', private: true })
    );
    writeFileSync(
      join(queryDir, 'app.json'),
      JSON.stringify({
        expo: {
          name: 'Tlon Mobile',
          slug: 'groups',
          owner: 'tlon',
          extra: { eas: { projectId: project } },
        },
      })
    );
    const run = JSON.parse(
      command(
        'npx',
        [
          '--yes',
          'eas-cli@23.2.0',
          'workflow:view',
          id,
          '--json',
          '--non-interactive',
        ],
        {
          cwd: queryDir,
        }
      )
    );
    const { report, video, sha } = selectEvidence(run, id);
    if (video) {
      const response = await fetch(video.downloadUrl, {
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok)
        throw new Error(`Video download failed (${response.status})`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (
        bytes.length !== video.fileSizeBytes ||
        bytes.subarray(4, 8).toString() !== 'ftyp'
      )
        throw new Error('Video size or MP4 signature mismatch');
      writeFileSync(videoPath, bytes);
    }
    writeFileSync(
      bodyPath,
      [
        marker,
        '## iOS agent QA',
        '',
        report.replaceAll('@', '@\u200b'),
        '',
        `EAS result: **${run.status}** · Harness source: \`${sha}\``,
        '',
        `[Cloud run and evidence](https://expo.dev/accounts/tlon/projects/groups/workflows/${id})`,
        '',
        video
          ? ''
          : '**No video was produced.** See the report for the recording or setup failure.',
        '',
        'Published automatically by GitHub Actions. Existing-build runs validate the harness only; the app and backend commits above identify what was tested.',
        '',
      ].join('\n')
    );
    writeFileSync(
      join(dir, 'metadata.json'),
      JSON.stringify({ id, pr, video: Boolean(video) })
    );
    console.log(
      `Prepared ${run.status} QA report; recording ${video ? 'available' : 'unavailable'}.`
    );
    return;
  }
  if (process.argv[2] !== 'publish')
    throw new Error('Expected prepare or publish');
  if (!process.env.GH_TOKEN)
    throw new Error('GH_QA_TOKEN is required for native GitHub attachments');
  const gh = (args) => command(process.env.QA_GH_BIN, args);
  const meta = JSON.parse(readFileSync(join(dir, 'metadata.json'), 'utf8'));
  if (meta.id !== id || meta.pr !== pr)
    throw new Error('Prepared report provenance mismatch');
  const comment = publishComment({
    gh,
    pr,
    directory: dir,
    body: readFileSync(bodyPath, 'utf8'),
    attempt: {
      url: `https://expo.dev/accounts/tlon/projects/groups/workflows/${id}`,
      key: marker,
      head: '',
      kind: 'report',
    },
    attachments: meta.video ? [videoPath] : [],
  });
  console.log(`Published automatically: ${comment.html_url}`);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `[QA report${meta.video ? ' and verified inline video' : ' (no recording)'}](${comment.html_url})\n`
    );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    // Subprocess output or network errors may contain signed artifact URLs.
    console.error(
      error.status !== undefined
        ? `Publisher command failed (exit ${error.status}); verify EXPO_TOKEN and repository-write GH_QA_TOKEN.`
        : error.message
    );
    if (error.stderr) {
      let detail = String(error.stderr);
      for (const secret of [
        process.env.EXPO_TOKEN,
        process.env.GH_TOKEN,
      ].filter(Boolean))
        detail = detail.replaceAll(secret, '[redacted]');
      console.error(detail.replace(/https?:\/\/\S+/g, '[URL]').slice(-3000));
    }
    process.exitCode = 1;
  });
}

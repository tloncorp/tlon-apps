import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { out, repo, json, save, command } from './common.mjs';
const clean = (value) => String(value || '').replaceAll('@', '@\u200b');
export function clipWindow(finding, duration) {
  const { start, end } = finding;
  if (start === null && end === null) return null;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end <= start ||
    end > duration ||
    end - start > 120
  )
    throw new Error('Finding clip is outside the recording');
  return [start, end];
}
export function render(result, clips) {
  const { pr, runUrl, status, report } = result;
  const state = {
    current: {
      head: pr.head.sha,
      url: runUrl,
      kind: status === 'completed' ? 'report' : 'blocked',
    },
  };
  const outcome = {
    execution: status,
    findings: report?.findings.length || 0,
    coverageGaps: report?.unexplored.length || 0,
  };
  return [
    `<!-- ios-agent-qa:pr-${pr.number} -->`,
    `<!-- ios-agent-qa-state:${Buffer.from(JSON.stringify(state)).toString('base64')} -->`,
    `<!-- ios-agent-qa-outcome:${JSON.stringify(outcome)} -->`,
    '## iOS agent QA',
    '',
    `**${status === 'completed' ? 'Review completed' : status === 'skipped' ? 'Simulator skipped' : 'Review incomplete'}** · [Run](${runUrl}) · commit \`${pr.head.sha.slice(0, 10)}\``,
    '',
    clean(result.summary),
    '',
    'Observations concern the implemented iOS build; they do not establish when a bug was introduced.',
    '',
    ...(report?.findings || []).flatMap((f, i) => [
      `### ${i + 1}. ${clean(f.title)}`,
      clean(f.when),
      '',
      clean(f.observed),
      '',
      `Expected: ${clean(f.expected)}`,
      '',
      clips[i]
        ? `{{VIDEO_${clips[i]}}}`
        : 'No complete finding clip was identified.',
      '',
    ]),
    ...(report?.explored.length
      ? ['### Explored', ...report.explored.map((s) => `- ${clean(s)}`), '']
      : []),
    ...(report?.unexplored.length
      ? [
          '### Not explored',
          ...report.unexplored.map((s) => `- ${clean(s)}`),
          '',
        ]
      : []),
    ...(result.duration
      ? [
          '<details><summary>Full recording</summary>',
          '',
          '{{VIDEO_session.mp4}}',
          '',
          '</details>',
        ]
      : []),
    '',
  ].join('\n');
}
export function publish(result, files, body, gh, directory = out) {
  const pr = String(result.pr.number),
    marker = `<!-- ios-agent-qa:pr-${pr} -->`;
  const target = () => JSON.parse(gh(['api', `repos/${repo}/pulls/${pr}`]));
  if (target().head.sha !== result.pr.head.sha)
    throw new Error('PR changed; rerun QA for the current head');
  const viewer = JSON.parse(gh(['api', 'user']));
  const comments = () =>
    JSON.parse(
      gh([
        'api',
        '--paginate',
        '--slurp',
        `repos/${repo}/issues/${pr}/comments?per_page=100`,
      ])
    ).flat();
  const owned = comments()
    .filter((c) => c.user.id === viewer.id)
    .sort((a, b) => a.id - b.id);
  const existing = owned.find((c) => c.body.includes(marker));
  if (existing && existing.id !== owned.at(-1).id)
    throw new Error(
      'QA account has a newer unrelated comment; refusing to edit it'
    );
  const bodyFile = path.join(directory, 'comment.md');
  save(bodyFile, body);
  // Janic's gh --attach path owns uploads. Only this serialized workflow publishes QA.
  gh([
    'pr',
    'comment',
    pr,
    '--repo',
    repo,
    '--body-file',
    bodyFile,
    ...(existing ? ['--edit-last'] : []),
    ...files.flatMap((file) => ['--attach', path.join(directory, file)]),
  ]);
  const comment = comments()
    .filter((c) => c.user.id === viewer.id && c.body.includes(marker))
    .at(-1);
  if (!comment) throw new Error('Published QA comment was not found');
  if (files.length) {
    const urls = [
      ...new Set(
        comment.body.match(
          /https:\/\/github\.com\/user-attachments\/assets\/[a-f0-9-]+/g
        ) || []
      ),
    ];
    if (urls.length !== files.length)
      throw new Error('GitHub did not return every attachment');
    files.forEach((file, i) => {
      body = body.replace(`{{VIDEO_${file}}}`, urls[i]);
    });
    if (target().head.sha !== result.pr.head.sha)
      body =
        '> This run tested an earlier commit; the PR changed during publication.\n\n' +
        body;
    save(bodyFile, body);
    gh([
      'api',
      '--method',
      'PATCH',
      `repos/${repo}/issues/comments/${comment.id}`,
      '-F',
      `body=@${bodyFile}`,
    ]);
  }
  return comment.html_url;
}
async function main() {
  const result = existsSync(path.join(out, 'result.json'))
    ? json(path.join(out, 'result.json'))
    : {
        status: 'incomplete',
        summary: 'Runner setup failed; see workflow logs.',
        pr: JSON.parse(process.env.QA_PR_JSON),
        runUrl: process.env.QA_WORKFLOW_URL,
      };
  const files = [],
    clips = [];
  for (const [i, finding] of (result.report?.findings || []).entries()) {
    const window = clipWindow(finding, result.duration);
    if (!window) continue;
    const file = `finding-${i + 1}.mp4`;
    command('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      path.join(out, 'session.mp4'),
      '-ss',
      String(window[0]),
      '-t',
      String(window[1] - window[0]),
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-an',
      '-movflags',
      '+faststart',
      path.join(out, file),
    ]);
    files.push(file);
    clips[i] = file;
  }
  if (result.duration) files.push('session.mp4');
  const body = render(result, clips);
  if (body.length > 50000)
    throw new Error('Review is too long to publish; see artifacts');
  save(path.join(out, 'report.md'), body);
  if (process.env.QA_PUBLISH !== 'false') {
    const gh = (args) =>
      command('/usr/local/bin/gh', args, {
        cwd: out,
        env: { ...process.env, GH_TOKEN: process.env.GH_QA_TOKEN },
      });
    const url = publish(result, files, body, gh);
    console.log(`QA report: ${url}`);
  }
  if (!['completed', 'skipped'].includes(result.status)) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();

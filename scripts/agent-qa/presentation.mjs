import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { verifyClipReview } from './clip-review.mjs';

const text = { type: 'string' };
const object = (properties) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
export function findingSources(report) {
  return [
    ...(report.discoveries || []).map((d, i) => ({
      ...d,
      id: `finding-${i + 1}`,
    })),
    ...(report.checks || []).flatMap((c, i) =>
      c.status === 'failed'
        ? [
            {
              ...c,
              id: `check-${i + 1}`,
              title: c.title || c.expected,
              invariant: c.expected,
            },
          ]
        : []
    ),
  ];
}
export function explainReport(report) {
  return {
    findings: findingSources(report).map((f) => ({
      sources: [f.id],
      title: f.title || f.expected,
      when: f.trigger || f.when || 'During the planned check',
      happened: f.observed,
      impact: f.invariant || f.expected,
    })),
    incomplete: (report.checks || []).flatMap((c, i) =>
      c.status === 'blocked'
        ? [{ source: `check-${i + 1}`, explanation: c.observed }]
        : []
    ),
  };
}
export function selectFindingClips(
  report,
  presentation,
  receipts,
  info,
  duration
) {
  const sources = new Map(findingSources(report).map((f) => [f.id, f]));
  const selection = Object.fromEntries(
    presentation.findings.map((f, i) => [
      `group-${i + 1}`,
      {
        clips: sources.get(f.sources[0]).clipEvidence || [],
        unavailableReason:
          'The evidence reviewer did not verify a complete trigger-to-outcome clip.',
      },
    ])
  );
  return {
    selection,
    windows: verifyClipReview(
      selection,
      presentation,
      receipts,
      info,
      duration
    ),
  };
}
export function cutClip(video, output, window) {
  if (
    ![window.start, window.end].every(Number.isFinite) ||
    window.start < 0 ||
    window.end <= window.start ||
    window.end - window.start > 120
  )
    throw new Error('Invalid clip interval');
  execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-y',
      '-i',
      video,
      '-ss',
      String(window.start),
      '-t',
      String(window.end - window.start),
      '-map',
      '0:v:0',
      '-an',
      '-c:v',
      'libx264',
      '-crf',
      '18',
      '-preset',
      'fast',
      '-fps_mode',
      'passthrough',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      output,
    ],
    { timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const probe = JSON.parse(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=duration,width,height',
        '-of',
        'json',
        output,
      ],
      { encoding: 'utf8' }
    )
  ).streams[0];
  if (
    !probe ||
    Math.abs(Number(probe.duration) - (window.end - window.start)) > 0.15
  )
    throw new Error('Clip duration does not match source interval');
  return {
    ...window,
    file: path.basename(output),
    duration: Number(probe.duration),
    width: probe.width,
    height: probe.height,
  };
}
const clean = (s) =>
  String(s || '')
    .replace(/@/g, '@\u200b')
    .replace(/[<>]/g, '')
    .slice(0, 3000);
export const timestamp = (seconds) =>
  `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(3).padStart(6, '0')}`;
export function renderPresentation(
  original,
  presentation,
  clips,
  sourceUrl,
  fallbackReport
) {
  const { context, report } = original;
  const counts = { passed: 0, failed: 0, blocked: 0 };
  for (const c of report.checks || []) counts[c.status]++;
  const sources = new Map(findingSources(report).map((s) => [s.id, s]));
  return [
    '## iOS agent QA',
    '',
    `**${report.status === 'failed' ? 'Issues found' : report.status === 'blocked' ? 'Testing incomplete' : 'Checks passed'}** · ${presentation.findings.length} findings · ${counts.passed} checks passed · ${counts.blocked} checks incomplete`,
    '',
    'Findings below come from the automated evidence reviewer. This run tested the PR version; it did not compare against a recording of the base version.',
    '',
    ...presentation.findings.flatMap((f, i) => [
      `### ${i + 1}. ${clean(f.title)}${sources.get(f.sources[0]).status === 'blocked' ? ' — needs verification' : ''}`,
      '',
      `**When:** ${clean(f.when)}`,
      '',
      `**What happened:** ${clean(f.happened)}`,
      '',
      `**Expected:** ${clean(f.impact)}`,
      '',
      ...(clips[i]?.length
        ? clips[i].flatMap((c) => [
            `**Clip:** ${clean(c.label || f.title)}${c.additionalCase ? `. ${clean(c.additionalCase)}` : ''} (${timestamp(c.start)}–${timestamp(c.end)} in the full recording).`,
            '',
            `![Finding ${i + 1}](./${c.file})`,
            '',
          ])
        : [
            `No complete short clip was verified. ${clean(f.clipUnavailableReason || 'See the full recording and original evidence below.')}`,
            '',
          ]),
      '<details>',
      '<summary>Original reviewer evidence</summary>',
      '',
      ...f.sources.flatMap((id) => {
        const s = sources.get(id);
        return [
          `**${clean(s.title)}** (${s.status})`,
          '',
          clean(s.observed),
          '',
          `Source: \`${clean(s.file)}\` · Recorded actions: ${(s.evidenceActions || []).join(', ') || 'see full report'}`,
          '',
        ];
      }),
      '</details>',
      '',
    ]),
    ...(presentation.incomplete.length
      ? [
          '### Still unverified',
          '',
          ...presentation.incomplete.map((c) => `- ${clean(c.explanation)}`),
          '',
        ]
      : []),
    '<details>',
    '<summary>All checks and run details</summary>',
    '',
    fallbackReport,
    '',
    '</details>',
    '',
    '<details>',
    '<summary>Full test recording</summary>',
    '',
    '![Full test recording](./test-session.mp4)',
    '',
    '</details>',
    '',
    `[Original test run and evidence](${sourceUrl}) · Tested PR commit \`${context.pr.head.sha}\``,
    '',
    'Published automatically. Short clips are excerpts at normal speed; the full recording and original findings are retained.',
    '',
  ].join('\n');
}
export function makeClips(original, presentation, windows, video, out) {
  mkdirSync(out, { recursive: true });
  if (windows.length !== presentation.findings.length)
    throw new Error('Missing reviewed clip selections');
  const clips = windows.map((group, i) =>
    group.map((window, j) =>
      cutClip(video, path.join(out, `finding-${i + 1}-${j + 1}.mp4`), window)
    )
  );
  writeFileSync(
    path.join(out, 'clip-receipts.json'),
    JSON.stringify({ source: original.context.video, clips }, null, 2)
  );
  return clips;
}

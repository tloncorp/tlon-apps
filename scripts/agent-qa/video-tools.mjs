// Decode recorded frames on the runner. The model receives images, never a video URL.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export const videoTools = [
  {
    name: 'video_info',
    description:
      'Read recording duration, native frame timestamps, and approximate action alignment. Frame indices are zero-based. Use actual frames to establish transitions; wall-clock alignment is only a search hint.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'inspect_video_frames',
    description:
      'Inspect a timestamped contact sheet of recorded frames. stride=1 includes every encoded frame; larger strides are only an overview and cannot establish absence of a brief state. region=top enlarges header/subtitle text; full shows the whole viewport. Read cells left-to-right then top-to-bottom. Returns a citable evidence ID and exact timestamps. Never infer frames between samples.',
    inputSchema: {
      type: 'object',
      properties: {
        startFrame: { type: 'integer' },
        count: { type: 'integer' },
        stride: { type: 'integer' },
        region: { type: 'string', enum: ['top', 'full'] },
      },
      required: ['startFrame', 'count', 'stride', 'region'],
      additionalProperties: false,
    },
  },
];
export function validateFrameRequest(a, total) {
  if (
    !Number.isInteger(a.startFrame) ||
    a.startFrame < 0 ||
    !Number.isInteger(a.count) ||
    a.count < 1 ||
    a.count > 24 ||
    !Number.isInteger(a.stride) ||
    a.stride < 1 ||
    a.stride > 300 ||
    !['top', 'full'].includes(a.region) ||
    a.startFrame + (a.count - 1) * a.stride >= total
  )
    throw new Error(
      'Choose 1-24 existing frames, stride 1-300, region top or full'
    );
  if (a.region === 'full' && a.count > 6)
    throw new Error(
      'Full viewport sheets allow at most six frames for legibility'
    );
  return Array.from({ length: a.count }, (_, i) => a.startFrame + i * a.stride);
}
export function videoReader({
  file,
  outputDir,
  startedAt,
  actions = [],
  drawLabels = true,
}) {
  mkdirSync(outputDir, { recursive: true });
  const timestampsPrinted =
    drawLabels &&
    /\bdrawtext\b/.test(
      execFileSync('ffmpeg', ['-hide_banner', '-filters'], {
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    );
  const probe = JSON.parse(
    execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_frames',
        '-show_streams',
        '-show_entries',
        'frame=best_effort_timestamp_time:stream=width,height,avg_frame_rate,duration',
        '-of',
        'json',
        file,
      ],
      { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 60000 }
    )
  );
  const timestamps = probe.frames.map((f) =>
    Number(f.best_effort_timestamp_time)
  );
  if (!timestamps.length || timestamps.some((t) => !Number.isFinite(t)))
    throw new Error('Recording has no timestamped frames');
  const info = {
    ...probe.streams[0],
    totalFrames: timestamps.length,
    timestampsPrinted,
    timestampGuide:
      'Exact timestamps are always in each receipt, matched by one-based row and column. Images may omit printed labels when drawtext is unavailable.',
    lastFrameSeconds: timestamps.at(-1),
    origin: 'encoded recording frames; no interpolation',
    alignment: startedAt
      ? 'approximate wall clock; verify transition in frames'
      : 'unavailable',
    actions: actions.map((a) => ({
      index: a.index,
      name: a.name,
      arguments: a.arguments,
      approximateSeconds: startedAt
        ? (Date.parse(a.at) - startedAt) / 1000
        : null,
    })),
  };
  writeFileSync(
    path.join(outputDir, 'video-info.json'),
    JSON.stringify({ ...info, timestamps })
  );
  const receipts = existsSync(path.join(outputDir, 'receipts.json'))
    ? JSON.parse(readFileSync(path.join(outputDir, 'receipts.json')))
    : {};
  writeFileSync(
    path.join(outputDir, 'receipts.json'),
    JSON.stringify(receipts)
  );
  return {
    info,
    call(name, a) {
      if (name === 'video_info')
        return [{ type: 'text', text: JSON.stringify(info) }];
      if (name !== 'inspect_video_frames')
        throw new Error('Unknown video tool');
      const indices = validateFrameRequest(a, timestamps.length);
      const existing = Object.entries(receipts).find(
        ([, receipt]) =>
          receipt.region === a.region &&
          receipt.frames?.map((f) => f.index).join(',') === indices.join(',')
      );
      if (existing) {
        const [evidenceId, receipt] = existing;
        return [
          {
            type: 'text',
            text: JSON.stringify({ evidenceId, ...receipt, reused: true }),
          },
        ];
      }
      const id = `video-frames-${Object.keys(receipts).length + 1}`;
      const filename = path.join(outputDir, `${id}.png`);
      const columns =
        a.region === 'full' ? Math.min(3, a.count) : Math.min(4, a.count);
      const rows = Math.ceil(a.count / columns);
      const filter = [
        `select='between(n,${indices[0]},${indices.at(-1)})*not(mod(n-${indices[0]},${a.stride}))'`,
        ...(a.region === 'top' ? ['crop=iw:floor(ih*0.3/2)*2:0:0'] : []),
        'scale=400:-2',
        ...(timestampsPrinted
          ? [
              "drawtext=text='%{pts\\:hms}':fontsize=18:fontcolor=white:box=1:boxcolor=black:x=0:y=0",
            ]
          : []),
        `tile=${columns}x${rows}:nb_frames=${a.count}:padding=4:color=black`,
      ].join(',');
      execFileSync(
        'ffmpeg',
        [
          '-v',
          'error',
          '-y',
          '-i',
          file,
          '-vf',
          filter,
          '-frames:v',
          '1',
          filename,
        ],
        {
          timeout: 60000,
          maxBuffer: 1024 * 1024,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
      const receipt = {
        file: `video-frames/${id}.png`,
        screenshot: true,
        region: a.region,
        stride: a.stride,
        timestampsPrinted,
        frames: indices.map((i, cell) => ({
          index: i,
          seconds: timestamps[i],
          row: Math.floor(cell / columns) + 1,
          column: (cell % columns) + 1,
        })),
        contiguous: a.stride === 1,
      };
      receipts[id] = receipt;
      writeFileSync(
        path.join(outputDir, 'receipts.json'),
        JSON.stringify(receipts)
      );
      return [
        { type: 'text', text: JSON.stringify({ evidenceId: id, ...receipt }) },
        {
          type: 'image',
          mimeType: 'image/png',
          data: readFileSync(filename).toString('base64'),
        },
      ];
    },
  };
}
export function verifyVideoReferences(result, receipts) {
  const references = [];
  for (const check of result.checks) {
    references.push(...(check.evidence || []));
    for (const clip of check.clipEvidence || [])
      for (const moment of ['before', 'trigger', 'outcome', 'settled'])
        references.push(clip[moment]?.evidenceId);
  }
  for (const discovery of result.discoveries || []) {
    for (const clip of discovery.clipEvidence || [])
      for (const moment of ['before', 'trigger', 'outcome', 'settled'])
        references.push(clip[moment]?.evidenceId);
  }
  for (const id of references) {
    if (id === 'codex-trace') continue;
    if (!/^video-frames-\d+$/.test(id) || !receipts[id]?.frames?.length)
      throw new Error('Video finding cites uninspected frames');
  }
  return result;
}

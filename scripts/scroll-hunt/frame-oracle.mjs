#!/usr/bin/env node
// Reads a screen recording of a conversation and reports what a person would
// call a glitch: a blank screen, an empty gap where rows should be, a
// single-frame flash, content jumping while nothing is scrolling it, and
// jitter. It also decodes the diagnostics time
// code strip (see ScrollDiagnosticsTimecode.tsx, drawn when `ENABLED_LOGGERS`
// includes `scroller-timecode`) so each finding carries the time of the
// timeline entries that produced it.
//
//   node scripts/scroll-hunt/frame-oracle.mjs recording.mp4 [--json out.json]
//       [--timeline events.json] [--points-width 402] [--frames dir]
//       [--series frames.csv] [--fps 30] [--points-per-pixel 3]
//
// Every frame of the recording is read, at one analysis pixel per point, so
// that a glitch lasting a single frame or a hop of a couple of points shows.
// `--fps` and `--points-per-pixel` trade that away for speed on long takes.
//
// Needs ffmpeg and ffprobe on PATH. `--frames dir` also writes a small PNG of
// each flagged moment and its neighbours. `--timeline` takes the diagnostics
// events (`__scrollDiag.events()` as JSON); with it, each finding is labelled
// with what was going on at that moment, and movement the user or the app
// asked for is told apart from movement nothing asked for.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const video = args.find((arg) => !arg.startsWith('--'));
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
if (!video) {
  console.error('usage: frame-oracle.mjs <video> [--json out] [--frames dir]');
  process.exit(1);
}

const POINTS_WIDTH = Number(option('points-width', 402));
// One analysis pixel covers this many points.
const POINTS_PER_PIXEL = Number(option('points-per-pixel', 1));
/** A distance in points, in analysis pixels. */
const pixels = (points) => points / POINTS_PER_PIXEL;
const TIMECODE_BITS = 14;
const TIMECODE_UNIT_MS = 10;
const TIMECODE_CELL_POINTS = 6;

const probe = JSON.parse(
  execFileSync('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height,avg_frame_rate',
    '-of',
    'json',
    video,
  ]).toString()
).streams[0];
const [rateOver, rateUnder] = probe.avg_frame_rate.split('/').map(Number);
const recordedFps = rateUnder ? rateOver / rateUnder : 30;
// A simulator recording is 60 frames a second; nothing is gained by reading
// one more often than it was written.
const FPS = Number(option('fps', Math.min(60, Math.round(recordedFps))));
const scale = probe.width / POINTS_WIDTH;
const width = Math.round(POINTS_WIDTH / POINTS_PER_PIXEL);
const height = 2 * Math.round((probe.height * width) / probe.width / 2);

/** Runs ffmpeg and calls `onFrame` with each raw frame of `frameBytes`. */
function readFrames(filter, pixelFormat, frameBytes, onFrame) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      'ffmpeg',
      [
        '-v',
        'error',
        '-i',
        video,
        '-vf',
        `fps=${FPS},${filter}`,
        '-pix_fmt',
        pixelFormat,
        '-f',
        'rawvideo',
        '-',
      ],
      { stdio: ['ignore', 'pipe', 'inherit'] }
    );
    let pending = Buffer.alloc(0);
    ffmpeg.stdout.on('data', (chunk) => {
      pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      while (pending.length >= frameBytes) {
        onFrame(pending.subarray(0, frameBytes));
        pending = pending.subarray(frameBytes);
      }
    });
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))
    );
  });
}

// --- Time code ---------------------------------------------------------------

const cellPixels = TIMECODE_CELL_POINTS * scale;
const stripWidth = Math.round(cellPixels);
const timecodes = [];

function decodeTimecode(frame) {
  // Average the middle of the strip on each row, away from its edges.
  const from = Math.floor(stripWidth / 3);
  const to = Math.ceil((2 * stripWidth) / 3);
  const rowColor = (y) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let x = from; x < to; x++) {
      const i = (y * stripWidth + x) * 3;
      r += frame[i];
      g += frame[i + 1];
      b += frame[i + 2];
    }
    const n = to - from;
    return [r / n, g / n, b / n];
  };
  const isRed = ([r, g, b]) => r > 170 && g < 90 && b < 90;
  const isBlue = ([r, g, b]) => b > 170 && r < 90 && g < 90;
  const cellsTall = Math.round(cellPixels);

  for (let y = 0; y + cellPixels * (TIMECODE_BITS + 2) < probe.height; y++) {
    if (!isRed(rowColor(y)) || !isRed(rowColor(y + cellsTall - 2))) {
      continue;
    }
    const center = (cell) => Math.round(y + cellPixels * (cell + 0.5));
    if (!isBlue(rowColor(center(TIMECODE_BITS + 1)))) {
      continue;
    }
    let value = 0;
    for (let bit = 0; bit < TIMECODE_BITS; bit++) {
      const [r, g, b] = rowColor(center(bit + 1));
      value = (value << 1) | ((r + g + b) / 3 > 128 ? 1 : 0);
    }
    return value * TIMECODE_UNIT_MS;
  }
  return null;
}

await readFrames(
  `crop=${stripWidth}:ih:0:0`,
  'rgb24',
  stripWidth * probe.height * 3,
  (frame) => timecodes.push(decodeTimecode(frame))
);

// The code wraps; unwrap it into a clock that only moves forward.
const wrap = (1 << TIMECODE_BITS) * TIMECODE_UNIT_MS;
let wraps = 0;
let lastCode = null;
const recorderTimes = timecodes.map((code) => {
  if (code === null) {
    return null;
  }
  if (lastCode !== null && code < lastCode - wrap / 2) {
    wraps++;
  }
  lastCode = code;
  return code + wraps * wrap;
});

// --- Frame metrics -----------------------------------------------------------

// The part of the screen the conversation's rows occupy: below the header,
// above the composer, clear of the time code strip and the scroll indicator.
const region = {
  left: Math.round(width * 0.08),
  right: Math.round(width * 0.93),
  top: Math.round(height * 0.14),
  bottom: Math.round(height * 0.85),
};
const regionHeight = region.bottom - region.top;
const regionArea = regionHeight * (region.right - region.left);
const MAX_SHIFT = Math.min(
  Math.round(pixels(210)),
  Math.floor(regionHeight / 2)
);

const frames = [];
let previous = null;
let beforePrevious = null;

function meanDifference(a, b) {
  let sum = 0;
  for (let y = region.top; y < region.bottom; y++) {
    for (let x = region.left; x < region.right; x++) {
      const i = y * width + x;
      sum += Math.abs(a[i] - b[i]);
    }
  }
  return sum / regionArea;
}

function rowProfile(frame) {
  const profile = new Float32Array(regionHeight);
  for (let y = 0; y < regionHeight; y++) {
    let sum = 0;
    for (let x = region.left; x < region.right; x++) {
      sum += frame[(y + region.top) * width + x];
    }
    profile[y] = sum / (region.right - region.left);
  }
  return profile;
}

/** How far the content moved down between two frames, in analysis pixels. */
function verticalShift(from, to) {
  const cost = (shift) => {
    let sum = 0;
    let count = 0;
    for (
      let y = Math.max(0, shift);
      y < regionHeight + Math.min(0, shift);
      y++
    ) {
      sum += Math.abs(to[y] - from[y - shift]);
      count++;
    }
    return sum / count;
  };
  const still = cost(0);
  let best = 0;
  let bestCost = still;
  for (let shift = -MAX_SHIFT; shift <= MAX_SHIFT; shift++) {
    const value = cost(shift);
    if (value < bestCost) {
      bestCost = value;
      best = shift;
    }
  }
  // Only believe a shift that explains most of the change.
  const reliable = still > 0.6 && bestCost < still * 0.45;
  return { shift: reliable ? best : 0, residual: reliable ? bestCost : still };
}

function backgroundOf(frame) {
  const histogram = new Uint32Array(256);
  for (let y = region.top; y < region.bottom; y++) {
    for (let x = region.left; x < region.right; x++) {
      histogram[frame[y * width + x]]++;
    }
  }
  let mode = 0;
  for (let value = 1; value < 256; value++) {
    if (histogram[value] > histogram[mode]) {
      mode = value;
    }
  }
  return { histogram, mode };
}

function blankFraction({ histogram, mode }) {
  let near = 0;
  for (
    let value = Math.max(0, mode - 3);
    value <= Math.min(255, mode + 3);
    value++
  ) {
    near += histogram[value];
  }
  return near / regionArea;
}

/**
 * The tallest band of the rows' area with nothing drawn in it, in analysis
 * pixels, and where it starts. Messages sit close together, so a tall band is
 * rows that have not been drawn yet (or the empty top of a short chat).
 */
function emptyBand(frame, mode) {
  const rowWidth = region.right - region.left;
  let best = { size: 0, start: 0 };
  let run = 0;
  for (let y = region.top; y <= region.bottom; y++) {
    let ink = 0;
    if (y < region.bottom) {
      for (let x = region.left; x < region.right; x++) {
        if (Math.abs(frame[y * width + x] - mode) > 6) {
          ink++;
        }
      }
    }
    if (y < region.bottom && ink <= rowWidth * 0.01) {
      run++;
    } else {
      if (run > best.size) {
        best = { size: run, start: y - run - region.top };
      }
      run = 0;
    }
  }
  return best;
}

await readFrames(
  `scale=${width}:${height}:flags=area`,
  'gray',
  width * height,
  (raw) => {
    const frame = Buffer.from(raw);
    const profile = rowProfile(frame);
    const background = backgroundOf(frame);
    const entry = {
      blank: blankFraction(background),
      band: emptyBand(frame, background.mode),
      change: previous ? meanDifference(frame, previous.frame) : 0,
      // Change against the frame before last: small when this frame's
      // predecessor was a one-off.
      changeSkippingOne: beforePrevious
        ? meanDifference(frame, beforePrevious.frame)
        : 0,
      profile,
      ...(previous
        ? verticalShift(previous.profile, profile)
        : { shift: 0, residual: 0 }),
    };
    frames.push(entry);
    beforePrevious = previous;
    previous = { frame, profile };
  }
);

// --- Timeline context --------------------------------------------------------

const timelinePath = option('timeline');
const timeline = timelinePath
  ? JSON.parse(readFileSync(timelinePath, 'utf8'))
  : null;

// The strip only carries the low bits of the diagnostics clock, so pick the
// lap of that clock which puts the most frames inside the timeline. A screen
// without the strip can decode to a stray value, which this also outvotes.
if (timeline?.length) {
  const first = timeline[0].t - 5000;
  const last = timeline[timeline.length - 1].t + 5000;
  const decoded = recorderTimes.filter((time) => time !== null);
  let bestLaps = 0;
  let bestCount = -1;
  for (
    let laps = Math.floor(first / wrap) - 1;
    laps <= Math.ceil(last / wrap);
    laps++
  ) {
    const count = decoded.filter(
      (time) => time + laps * wrap >= first && time + laps * wrap <= last
    ).length;
    if (count > bestCount) {
      bestCount = count;
      bestLaps = laps;
    }
  }
  for (let i = 0; i < recorderTimes.length; i++) {
    if (recorderTimes[i] === null) {
      continue;
    }
    const time = recorderTimes[i] + bestLaps * wrap;
    // Outside the timeline: not a frame of the conversation being measured.
    recorderTimes[i] = time >= first && time <= last ? time : null;
  }
}

// Stretches of the diagnostics clock during which content is meant to move.
const intervals = [];
if (timeline) {
  let dragStart = null;
  let momentumStart = null;
  // Positioning a list is only out of sight until that list is shown.
  const shownLists = new Set();
  const hiddenPositioning = new Map();
  // When each list last took rows while following its end.
  const followedRowsAt = new Map();
  for (const event of timeline) {
    const { t, type, message, list } = event;
    if (type === 'gesture') {
      // A fling has no end event when a new touch catches it, so a fling also
      // ends wherever the next drag or fling begins.
      const endFling = () => {
        if (momentumStart !== null) {
          intervals.push({
            from: momentumStart - 50,
            to: t + 150,
            why: 'fling',
          });
          momentumStart = null;
        }
      };
      if (message === 'drag began') {
        endFling();
        dragStart = t;
      } else if (message === 'drag released' && dragStart !== null) {
        intervals.push({ from: dragStart - 50, to: t + 150, why: 'drag' });
        dragStart = null;
      } else if (message === 'momentum began') {
        endFling();
        momentumStart = t;
      } else if (message === 'momentum ended') {
        endFling();
      }
    } else if (type === 'scroll' && message.startsWith('imperative')) {
      intervals.push({
        from: t - 30,
        to: t + 900,
        why: 'scroll the app asked for',
      });
    } else if (type === 'data' && message.includes('following the end')) {
      followedRowsAt.set(list, t);
    } else if (type === 'auto-scroll') {
      // The list following new messages at the end, or holding its place. The
      // follow starts natively when the rows land; JS can note it a few
      // hundred ms later when it was busy rendering them, and the time code
      // stands still meanwhile, so the frames carry the earlier stamp.
      const rowsAt = followedRowsAt.get(list);
      const from = rowsAt !== undefined && t - rowsAt < 700 ? rowsAt : t;
      intervals.push({
        from: from - 30,
        to: t + 400,
        why: 'following new rows',
      });
    } else if (type === 'keyboard') {
      intervals.push({ from: t - 50, to: t + 700, why: 'keyboard' });
    } else if (type === 'position') {
      if (!shownLists.has(list)) {
        const interval = { from: t - 30, to: t + 250, why: 'opening position' };
        intervals.push(interval);
        hiddenPositioning.set(list, [
          ...(hiddenPositioning.get(list) ?? []),
          interval,
        ]);
      }
    } else if (type === 'lifecycle' || type === 'app') {
      // A screen sliding in or out, or the app returning.
      intervals.push({ from: t - 600, to: t + 600, why: 'screen transition' });
    } else if (type === 'visibility') {
      // The first frame with the list on it can follow JS's note by a few
      // frames, while the native side commits the change.
      intervals.push({ from: t - 50, to: t + 150, why: 'list shown' });
      if (message.startsWith('list first shown')) {
        shownLists.add(list);
        for (const interval of hiddenPositioning.get(list) ?? []) {
          interval.to = Math.min(interval.to, t + 60);
        }
      }
    }
  }
  // A gesture still under way when the timeline was captured.
  const last = timeline.length ? timeline[timeline.length - 1].t : 0;
  if (dragStart !== null) {
    intervals.push({ from: dragStart - 50, to: last, why: 'drag' });
  }
  if (momentumStart !== null) {
    intervals.push({ from: momentumStart - 50, to: last, why: 'fling' });
  }
}

/** Why content may be moving at this point on the diagnostics clock. */
function expectedMotion(timelineMs) {
  if (!timeline || timelineMs === null) {
    return null;
  }
  const reasons = new Set();
  for (const interval of intervals) {
    if (timelineMs >= interval.from && timelineMs <= interval.to) {
      reasons.add(interval.why);
    }
  }
  return [...reasons];
}

const CONTEXT_TYPES = new Set([
  'adjust',
  'adjust-missed',
  'auto-scroll',
  'blank',
  'data',
  'inset',
  'landing',
  'lifecycle',
  'position',
  'reflow',
  'resize',
  'row',
  'shift',
  'stall',
  'state',
  'visibility',
]);

/** Timeline entries in the moments before a finding. */
function contextFor(timelineMs) {
  if (!timeline || timelineMs === null) {
    return [];
  }
  return timeline
    .filter(
      (event) =>
        CONTEXT_TYPES.has(event.type) &&
        event.t >= timelineMs - 250 &&
        event.t <= timelineMs + 60
    )
    .slice(-8)
    .map(
      (event) =>
        `${Math.round(event.t - timelineMs)}ms ${event.type}: ${event.message.slice(0, 150)}`
    );
}

// --- Findings ----------------------------------------------------------------

const findings = [];
const seconds = (index) => Math.round((index / FPS) * 1000) / 1000;
const points = (count) => count * POINTS_PER_PIXEL;

function report(index, kind, detail, extra = {}) {
  const timelineMs = recorderTimes[index] ?? null;
  const during = expectedMotion(timelineMs);
  findings.push({
    frame: index,
    videoSeconds: seconds(index),
    timelineMs,
    kind,
    detail,
    // With a timeline: what was meant to be moving the content, if anything.
    during,
    unexplained: during !== null && during.length === 0,
    context: contextFor(timelineMs),
    ...extra,
  });
}

const changes = frames.map((frame) => frame.change).sort((a, b) => a - b);
const typicalChange = changes[Math.floor(changes.length / 2)] || 0;
const shifts = frames.map((frame) => frame.shift);
const isMoving = (index) => {
  const reasons = expectedMotion(recorderTimes[index] ?? null);
  return reasons === null ? null : reasons.length > 0;
};

// Blank: the rows' area is all one colour, having shown content before.
const BLANK = 0.995;
const HAS_CONTENT = 0.985;
for (let index = 1; index < frames.length; index++) {
  if (frames[index].blank < BLANK || frames[index - 1].blank >= BLANK) {
    continue;
  }
  let end = index;
  while (end + 1 < frames.length && frames[end + 1].blank >= BLANK) {
    end++;
  }
  const hadContent = frames
    .slice(Math.max(0, index - FPS), index)
    .some((frame) => frame.blank < HAS_CONTENT);
  const getsContent = end + 1 < frames.length;
  report(
    index,
    'blank',
    `rows area is empty for ${Math.round(((end - index + 1) / FPS) * 1000)}ms${hadContent ? ' after showing content' : ''}${getsContent ? '' : ' until the recording ends'}`,
    { frames: end - index + 1, hadContent }
  );
  index = end;
}

// Gap: part of the rows' area is empty for a while, with content around it.
const GAP_PIXELS = Math.round(180 / POINTS_PER_PIXEL);
const GAP_FRAMES = 4;
const hasGap = (frame) => frame.blank < BLANK && frame.band.size >= GAP_PIXELS;
for (let index = 1; index < frames.length; index++) {
  if (!hasGap(frames[index]) || hasGap(frames[index - 1])) {
    continue;
  }
  let end = index;
  while (end + 1 < frames.length && hasGap(frames[end + 1])) {
    end++;
  }
  const length = end - index + 1;
  if (length >= GAP_FRAMES) {
    const widest = frames
      .slice(index, end + 1)
      .reduce((a, b) => (b.band.size > a.band.size ? b : a));
    const middle = widest.band.start + widest.band.size / 2;
    const where =
      middle < regionHeight / 3
        ? 'top'
        : middle > (regionHeight * 2) / 3
          ? 'bottom'
          : 'middle';
    report(
      index,
      'gap',
      `${points(widest.band.size)}pt of the rows area (${where}) is empty for ${Math.round((length / FPS) * 1000)}ms${end + 1 < frames.length ? '' : ' until the recording ends'}`,
      { frames: length, points: points(widest.band.size), where }
    );
  }
  index = end;
}

// Flash: one frame unlike both neighbours, which are like each other.
for (let index = 1; index + 1 < frames.length; index++) {
  const into = frames[index].change;
  const outOf = frames[index + 1].change;
  const across = frames[index + 1].changeSkippingOne;
  const threshold = Math.max(3, typicalChange * 6);
  if (
    into > threshold &&
    outOf > threshold &&
    across < Math.min(into, outOf) * 0.35
  ) {
    report(
      index,
      'flash',
      `one frame differs from both neighbours (${into.toFixed(1)} in, ${outOf.toFixed(1)} out, ${across.toFixed(1)} across)`
    );
  }
}

for (let index = 2; index + 2 < frames.length; index++) {
  const moving = isMoving(index);
  if (moving === false) {
    // Nothing is meant to be moving, so any slide of the content is a jump.
    if (Math.abs(shifts[index]) >= 2) {
      report(
        index,
        'jump',
        `content moved ${points(shifts[index])}pt with nothing scrolling it`,
        { points: points(shifts[index]) }
      );
    }
    continue;
  }
  // Without a timeline, or mid-fling: movement that the frames around it do
  // not share. A finger may move however it likes, so drags are left alone.
  if (moving && expectedMotion(recorderTimes[index]).includes('drag')) {
    continue;
  }
  const neighbours = [
    shifts[index - 2],
    shifts[index - 1],
    shifts[index + 1],
    shifts[index + 2],
  ].sort((a, b) => a - b);
  const spread = neighbours[3] - neighbours[0];
  const middle = (neighbours[1] + neighbours[2]) / 2;
  const excess = shifts[index] - middle;
  if (
    Math.abs(excess) >= pixels(24) &&
    spread <= pixels(12) &&
    Math.abs(middle) >= pixels(3)
  ) {
    report(
      index,
      'jump',
      `content moved ${points(shifts[index])}pt in one frame while the frames around it moved about ${points(middle)}pt`,
      { points: points(excess) }
    );
  }
}

// Jitter: the content reverses direction several times in a third of a second.
const JITTER_FRAMES = Math.max(6, Math.round(FPS / 3));
for (let index = 0; index + JITTER_FRAMES <= frames.length; index++) {
  const moving = shifts
    .slice(index, index + JITTER_FRAMES)
    .filter((shift) => Math.abs(shift) >= 2);
  let reversals = 0;
  for (let i = 1; i < moving.length; i++) {
    if (Math.sign(moving[i]) !== Math.sign(moving[i - 1])) {
      reversals++;
    }
  }
  if (reversals >= 3) {
    report(
      index,
      'jitter',
      `content reversed direction ${reversals} times in ${Math.round((JITTER_FRAMES / FPS) * 1000)}ms (${moving.map(points).join(', ')}pt)`
    );
    index += JITTER_FRAMES - 1;
  }
}

// Repaint: a large change that is not the content sliding, such as rows
// appearing, vanishing or being replaced in place. Only worth a line when
// nothing was scrolling; mid-scroll it is just fast movement.
for (let index = 1; index < frames.length; index++) {
  const frame = frames[index];
  const moving = isMoving(index);
  const nearbyMotion = shifts
    .slice(Math.max(0, index - 4), index + 5)
    .some((shift) => Math.abs(shift) >= pixels(9));
  if (
    frame.shift === 0 &&
    frame.change > Math.max(6, typicalChange * 10) &&
    (moving === null ? !nearbyMotion : !moving) &&
    !findings.some(
      (finding) => finding.frame === index && finding.kind !== 'repaint'
    )
  ) {
    report(
      index,
      'repaint',
      `rows area changed in place (${frame.change.toFixed(1)})`,
      { change: frame.change }
    );
  }
}

findings.sort((a, b) => a.frame - b.frame);

const counts = {};
for (const finding of findings) {
  counts[finding.kind] = (counts[finding.kind] ?? 0) + 1;
}
const summary = {
  video,
  frames: frames.length,
  seconds: seconds(frames.length),
  framesWithTimecode: recorderTimes.filter((time) => time !== null).length,
  counts,
  findings,
};

const seriesPath = option('series');
if (seriesPath) {
  writeFileSync(
    seriesPath,
    [
      'frame,seconds,timelineMs,shiftPt,change,blank,bandPt,bandStartPt',
      ...frames.map((frame, index) =>
        [
          index,
          seconds(index),
          recorderTimes[index] ?? '',
          points(frame.shift),
          frame.change.toFixed(2),
          frame.blank.toFixed(3),
          points(frame.band.size),
          points(frame.band.start),
        ].join(',')
      ),
    ].join('\n')
  );
}

const jsonPath = option('json');
if (jsonPath) {
  writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
}

const framesDir = option('frames');
if (framesDir) {
  mkdirSync(framesDir, { recursive: true });
  for (const finding of findings
    .filter((f) => f.kind !== 'repaint')
    .slice(0, 40)) {
    for (const offset of [-1, 0, 1]) {
      const index = finding.frame + offset;
      if (index < 0 || index >= frames.length) {
        continue;
      }
      execFileSync('ffmpeg', [
        '-v',
        'error',
        '-y',
        '-ss',
        String(index / FPS),
        '-i',
        video,
        '-frames:v',
        '1',
        '-vf',
        'scale=300:-2',
        path.join(
          framesDir,
          `${String(finding.frame).padStart(5, '0')}-${finding.kind}${offset === 0 ? '' : offset < 0 ? '-before' : '-after'}.png`
        ),
      ]);
    }
  }
}

console.log(
  `${frames.length} frames (${summary.seconds}s), ${summary.framesWithTimecode} with a time code`
);
console.log(
  Object.entries(counts)
    .map(([kind, count]) => `${kind} ${count}`)
    .join(', ') || 'nothing flagged'
);
for (const finding of findings) {
  const at =
    finding.timelineMs === null ? '' : ` timeline ${finding.timelineMs}ms`;
  const during =
    finding.during === null
      ? ''
      : finding.unexplained
        ? ' [NOTHING ASKED FOR THIS]'
        : ` [during ${finding.during.join(', ')}]`;
  console.log(
    `${finding.videoSeconds.toFixed(2)}s${at} ${finding.kind}: ${finding.detail}${during}`
  );
  for (const line of finding.unexplained ? finding.context : []) {
    console.log(`      ${line}`);
  }
}

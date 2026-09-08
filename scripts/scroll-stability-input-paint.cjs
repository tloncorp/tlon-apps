const { createRequire } = require('node:module');
const { dirname, join } = require('node:path');
const { isDeepStrictEqual: same } = require('node:util');

const webRequire = createRequire(
  join(__dirname, '../apps/tlon-web/package.json')
);
const png = () =>
  webRequire(
    join(
      dirname(webRequire.resolve('playwright-core/package.json')),
      'lib/utilsBundle.js'
    )
  ).PNG;
const finite = Number.isFinite;
const state = ({ time, ...value }) => value;
const MAX_FRAMES = 400;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 2_000_000;

function deadline(promise, timeoutMs, operation) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Paint ${operation} timed out`)),
        timeoutMs
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

function viewportValid(snapshot) {
  const v = snapshot?.viewport,
    clip = snapshot?.clip;
  return (
    v &&
    clip &&
    ['pageX', 'pageY', 'offsetX', 'offsetY', 'scale', 'width', 'height'].every(
      (k) => finite(v[k])
    ) &&
    v.pageX >= 0 &&
    v.pageY >= 0 &&
    v.offsetX === 0 &&
    v.offsetY === 0 &&
    v.scale === 1 &&
    v.width > 0 &&
    v.height > 0 &&
    ['x', 'y', 'width', 'height'].every((k) => finite(clip[k])) &&
    clip.x >= 0 &&
    clip.y >= 0 &&
    clip.width > 0 &&
    clip.height > 0 &&
    clip.x + clip.width <= v.width &&
    clip.y + clip.height <= v.height
  );
}

/** Parallel optional paint. Public API ownership is not presentation timing. */
function startInputPaint(page, observe, { timeoutMs = 250, ownsPage } = {}) {
  const frames = [];
  let active = true,
    stopPromise;
  const pending = (async () => {
    try {
      if (
        !ownsPage ||
        !(await deadline(ownsPage(), timeoutMs, 'main-frame ownership'))
      )
        throw new Error(
          'Retained textarea does not belong to the capture main frame'
        );
      let previousTime;
      while (active) {
        let before, after, pngBase64, request;
        try {
          before = await deadline(observe(), timeoutMs, 'before observation');
          if (!active) break;
          if (!before.valid || !viewportValid(before))
            throw new Error(
              'Retained textarea or unzoomed viewport is unavailable'
            );
          if (
            previousTime !== undefined &&
            (before.time <= previousTime || before.time - previousTime > 100)
          )
            throw new Error('Paint observation gap exceeds 100 ms');
          previousTime = before.time;
          request = { startedAt: performance.now() };
          const bytes = await deadline(
            page.screenshot({
              type: 'png',
              caret: 'initial',
              animations: 'allow',
              fullPage: false,
              scale: 'css',
              timeout: timeoutMs,
            }),
            timeoutMs,
            'public screenshot'
          );
          request.returnedAt = performance.now();
          pngBase64 = bytes.toString('base64');
          if (!active) throw new Error('Paint owner retired during capture');
          after = await deadline(observe(), timeoutMs, 'after observation');
          if (!active)
            throw new Error('Paint owner retired during observation');
          if (
            after.time - before.time > 100 ||
            request.returnedAt - request.startedAt > 100
          )
            throw new Error('Paint capture bracket exceeds 100 ms');
          frames.push({ before, after, request, pngBase64 });
          if (frames.length >= MAX_FRAMES) {
            frames.push({ error: 'Paint frame budget exhausted' });
            break;
          }
        } catch (error) {
          frames.push({
            before,
            ...(after ? { after } : {}),
            ...(request ? { request } : {}),
            ...(pngBase64 ? { pngBase64 } : {}),
            error: String(error),
          });
          break;
        }
      }
    } catch (error) {
      frames.push({ error: String(error) });
    } finally {
      active = false;
    }
  })();
  return {
    stop() {
      active = false;
      // Public screenshot has no cancellation API. Bound waiting and reject late
      // evidence without claiming in-flight browser raster/cleanup has stopped.
      return (stopPromise ??= pending.then(() => ({
        version: 4,
        transport: 'playwright-page-screenshot',
        captureRegion: 'viewport',
        pixelScale: 'css',
        requestClock: 'node-performance',
        frames: frames.map((frame) => ({ ...frame })),
      })));
    },
  };
}

/** Start the ordinary freeze before awaiting or retiring any optional paint work. */
async function finalizeInputPaint(freeze, paint) {
  let painted;
  const stopPaint = () => {
    if (!paint) return undefined;
    const failed = (error) => ({
      version: 4,
      captureRegion: 'viewport',
      pixelScale: 'css',
      transport: 'playwright-page-screenshot',
      requestClock: 'node-performance',
      frames: [{ error: `Paint finalization failed: ${String(error)}` }],
    });
    try {
      return Promise.resolve(paint.stop()).catch(failed);
    } catch (error) {
      return Promise.resolve(failed(error));
    }
  };
  try {
    const ordinary = freeze();
    painted = stopPaint();
    const raw = await ordinary;
    const paintedCaret = await painted;
    return { ...raw, ...(paintedCaret ? { paintedCaret } : {}) };
  } finally {
    await (painted ?? stopPaint());
  }
}

function snapshotValid(s, owner) {
  return (
    s &&
    s.valid === true &&
    finite(s.time) &&
    typeof s.scopeKey === 'string' &&
    typeof s.inputId === 'string' &&
    s.owner === owner.token &&
    s.timeOrigin === owner.timeOrigin &&
    s.scopeKey === owner.scopeKey &&
    s.inputId === owner.inputId &&
    typeof s.draft === 'string' &&
    typeof s.style === 'string' &&
    typeof s.focused === 'boolean' &&
    typeof s.composing === 'boolean' &&
    Number.isSafeInteger(s.epoch) &&
    s.epoch >= 0 &&
    Number.isSafeInteger(s.selection?.start) &&
    Number.isSafeInteger(s.selection?.end) &&
    s.selection.start >= 0 &&
    s.selection.end >= s.selection.start &&
    s.selection.end <= s.draft.length &&
    finite(s.scrollTop) &&
    finite(s.scrollLeft) &&
    finite(s.deviceScaleFactor) &&
    s.deviceScaleFactor > 0 &&
    s.clip &&
    ['x', 'y', 'width', 'height'].every((k) => finite(s.clip[k])) &&
    s.clip.x >= 0 &&
    s.clip.y >= 0 &&
    s.clip.width > 0 &&
    s.clip.height > 0
  );
}

function decode(frame, version) {
  const base64 = frame.pngBase64;
  if (
    typeof base64 !== 'string' ||
    !base64.length ||
    base64.length > Math.ceil(MAX_BYTES / 3) * 4 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)
  )
    throw new Error('Invalid PNG bytes');
  const bytes = Buffer.from(base64, 'base64');
  // Check allocation bounds in IHDR before asking the decoder to allocate.
  if (
    bytes.length < 33 ||
    bytes.length > MAX_BYTES ||
    !bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    bytes.readUInt32BE(8) !== 13 ||
    bytes.toString('ascii', 12, 16) !== 'IHDR'
  )
    throw new Error('Invalid PNG header');
  const width = bytes.readUInt32BE(16),
    height = bytes.readUInt32BE(20);
  if (!width || !height || width * height > MAX_PIXELS)
    throw new Error('PNG allocation limit');
  const { clip } = frame.before;
  const scale = version === 4 ? 1 : frame.before.deviceScaleFactor;
  if (version >= 3) {
    const viewport = frame.before.viewport;
    if (
      width !== Math.round(viewport.width * scale) ||
      height !== Math.round(viewport.height * scale)
    )
      throw new Error('PNG differs from actual viewport');
  } else if (
    Math.abs(width - clip.width * scale) > 1 ||
    Math.abs(height - clip.height * scale) > 1
  )
    throw new Error('PNG differs from actual clip');
  const image = png().sync.read(bytes, { checkCRC: true });
  if (image.width !== width || image.height !== height)
    throw new Error('PNG dimensions changed');
  if (version < 3) return image;
  // Only complete physical pixels inside the retained input's observed ROI.
  // Preserve original bytes; this extraction runs solely in the independent reader.
  const left = Math.ceil(clip.x * scale),
    top = Math.ceil(clip.y * scale);
  const right = Math.floor((clip.x + clip.width) * scale);
  const bottom = Math.floor((clip.y + clip.height) * scale);
  if (
    left < 0 ||
    top < 0 ||
    right > width ||
    bottom > height ||
    right <= left ||
    bottom <= top
  )
    throw new Error('PNG ROI unavailable');
  const croppedWidth = right - left,
    croppedHeight = bottom - top;
  const data = Buffer.alloc(croppedWidth * croppedHeight * 4);
  for (let y = 0; y < croppedHeight; y++)
    image.data.copy(
      data,
      y * croppedWidth * 4,
      ((top + y) * width + left) * 4,
      ((top + y) * width + right) * 4
    );
  return {
    width: croppedWidth,
    height: croppedHeight,
    data,
    origin: { x: left / scale, y: top / scale },
  };
}

/** Replays PNG candidates only. Never certifies continuous caret/presentation. */
function assessInputPaint(raw, contract, inputRaw) {
  const issues = [];
  const candidates = [];
  const add = (code, phase) => {
    if (!issues.some((i) => i.code === code && i.phase === phase))
      issues.push({ code, kind: 'incomplete', ...(phase ? { phase } : {}) });
  };
  const result = () => ({
    verdict: 'INCOMPLETE',
    evidenceLevel: 'painted-caret-candidates',
    continuousCaret: 'INCOMPLETE',
    presentedFrames: 'INCOMPLETE',
    candidates,
    issues,
  });
  add('input-caret-paint-attribution-unqualified');
  const owner = inputRaw?.paintOwner;
  const epochs = inputRaw?.paintEpochs;
  if (
    ![1, 2, 3, 4].includes(raw?.version) ||
    (raw.version >= 2 &&
      (raw.transport !==
        (raw.version === 4
          ? 'playwright-page-screenshot'
          : 'cdp-page-capture-screenshot') ||
        raw.requestClock !== 'node-performance')) ||
    (raw.version >= 3 &&
      (raw.captureRegion !== 'viewport' ||
        (raw.version === 4 && raw.pixelScale !== 'css') ||
        !inputRaw?.paintSurface ||
        !finite(inputRaw.paintSurface.deviceScaleFactor) ||
        inputRaw.paintSurface.deviceScaleFactor <= 0 ||
        !viewportValid({
          viewport: inputRaw.paintSurface.viewport,
          clip: { x: 0, y: 0, width: 1, height: 1 },
        }))) ||
    !Array.isArray(raw.frames) ||
    !raw.frames.length ||
    raw.frames.length > MAX_FRAMES + 1 ||
    !owner ||
    typeof owner.token !== 'string' ||
    !owner.token ||
    !finite(owner.timeOrigin) ||
    owner.scopeKey !== inputRaw.originalScope ||
    owner.inputId !== inputRaw.inputId ||
    !Array.isArray(epochs) ||
    !epochs.length ||
    epochs.some(
      (e, i) =>
        !finite(e.time) || e.epoch !== i || (i && e.time < epochs[i - 1].time)
    ) ||
    !Array.isArray(contract?.phases) ||
    !contract.phases.length ||
    !finite(contract.start) ||
    !finite(contract.end) ||
    contract.end <= contract.start ||
    contract.phases.some(
      (p) =>
        !finite(p.start) || !finite(p.end) || p.end < p.start || !p.expected
    )
  ) {
    add('input-caret-paint-missing-or-invalid-binding');
    return result();
  }
  // A later stable, altered surface cannot rehabilitate a perturbed attempt.
  if (
    raw.version >= 3 &&
    raw.frames.some((frame) =>
      [frame?.before, frame?.after].some(
        (snapshot) =>
          snapshot &&
          !same(
            {
              viewport: snapshot.viewport,
              deviceScaleFactor: snapshot.deviceScaleFactor,
            },
            inputRaw.paintSurface
          )
      )
    )
  ) {
    add('input-caret-paint-intended-surface-changed');
    return result();
  }
  const epochAt = (time) => epochs.findLast((e) => e.time <= time)?.epoch;
  const usable = [];
  let previousTime, previousRequestReturned;
  for (const [index, frame] of raw.frames.entries()) {
    const { before, after } = frame ?? {};
    if (frame?.error) add('input-caret-paint-capture-error');
    if (
      raw.version >= 2 &&
      (!viewportValid(before) ||
        !viewportValid(after) ||
        !finite(frame.request?.startedAt) ||
        !finite(frame.request?.returnedAt) ||
        frame.request.startedAt < 0 ||
        frame.request.returnedAt < frame.request.startedAt ||
        (previousRequestReturned !== undefined &&
          frame.request.startedAt < previousRequestReturned))
    ) {
      add('input-caret-paint-request-provenance-invalid');
      continue;
    }
    if (raw.version >= 2) previousRequestReturned = frame.request.returnedAt;
    if (
      !snapshotValid(before, owner) ||
      !snapshotValid(after, owner) ||
      after.time < before.time ||
      before.epoch !== epochAt(before.time) ||
      after.epoch !== epochAt(after.time) ||
      !same(state(before), state(after))
    ) {
      add('input-caret-paint-owner-or-state-changed');
      continue;
    }
    const gap =
      (raw.version >= 2 &&
        frame.request.returnedAt - frame.request.startedAt > 100) ||
      after.time - before.time > 100 ||
      (previousTime !== undefined &&
        (before.time <= previousTime || before.time - previousTime > 100));
    if (gap) add('input-caret-paint-capture-gap');
    previousTime = before.time;
    if (frame.error || gap) continue;
    try {
      usable.push({ ...frame, index, image: decode(frame, raw.version) });
    } catch {
      add('input-caret-paint-png-invalid');
    }
  }
  if (
    !usable.length ||
    usable[0].before.time - contract.start > 100 ||
    contract.end - usable.at(-1).after.time > 100
  )
    add('input-caret-paint-tail-uncovered');
  for (const phase of contract.phases) {
    const expected = phase.expected;
    const frames = usable.filter(
      (f) => f.before.time >= phase.start && f.after.time <= phase.end
    );
    if (!frames.length) {
      add('input-caret-paint-phase-unobserved', phase.id);
      continue;
    }
    if (
      frames[0].before.time - phase.start > 100 ||
      phase.end - frames.at(-1).after.time > 100
    )
      add('input-caret-paint-phase-uncovered', phase.id);
    const matches = (s) =>
      s.scopeKey === expected.scopeKey &&
      s.inputId === expected.inputId &&
      s.draft === expected.draft &&
      same(s.selection, expected.selection) &&
      s.focused === true &&
      s.composing === false;
    if (frames.some((f) => !matches(f.before))) {
      add('input-caret-paint-phase-state-mismatch', phase.id);
      continue;
    }
    if (expected.selection.start !== expected.selection.end) {
      add('input-caret-paint-selection-not-collapsed', phase.id);
      continue;
    }
    const episodes = [];
    for (const frame of frames) {
      const last = episodes.at(-1);
      if (
        !last ||
        frame.index !== last.at(-1).index + 1 ||
        !same(state(last.at(-1).before), state(frame.before)) ||
        frame.before.time - last.at(-1).before.time > 100
      )
        episodes.push([frame]);
      else last.push(frame);
    }
    let witnessed = false;
    for (const episode of episodes) {
      const states = [];
      const indexes = episode.map((f) => {
        let i = states.findIndex(
          (s) =>
            s.width === f.image.width &&
            s.height === f.image.height &&
            s.data.equals(f.image.data)
        );
        if (i < 0) {
          i = states.length;
          states.push(f.image);
        }
        return i;
      });
      const transitions = indexes.filter(
        (v, i) => i > 0 && v !== indexes[i - 1]
      ).length;
      if (states.length !== 2 || transitions < 2) continue;
      const [a, b] = states;
      if (a.width !== b.width || a.height !== b.height) continue;
      let count = 0,
        left = a.width,
        right = -1,
        top = a.height,
        bottom = -1;
      for (let y = 0; y < a.height; y++)
        for (let x = 0; x < a.width; x++) {
          const i = (y * a.width + x) * 4;
          if (!a.data.subarray(i, i + 4).equals(b.data.subarray(i, i + 4))) {
            count++;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
      const { clip } = episode[0].before;
      const scale = raw.version === 4 ? 1 : episode[0].before.deviceScaleFactor;
      if (
        !count ||
        right - left + 1 > Math.ceil(2 * scale) ||
        bottom <= top ||
        count !== (right - left + 1) * (bottom - top + 1)
      )
        continue;
      candidates.push({
        phase: phase.id,
        start: episode[0].before.time,
        end: episode.at(-1).after.time,
        frameIndexes: episode.map((f) => f.index),
        transitions,
        pixelCount: count,
        rect: {
          x: (a.origin?.x ?? clip.x) + left / scale,
          y: (a.origin?.y ?? clip.y) + top / scale,
          width: (right - left + 1) / scale,
          height: (bottom - top + 1) / scale,
        },
      });
      witnessed = true;
    }
    if (!witnessed)
      add('input-caret-paint-blink-unavailable-or-ambiguous', phase.id);
  }
  return result();
}

module.exports = { startInputPaint, finalizeInputPaint, assessInputPaint };

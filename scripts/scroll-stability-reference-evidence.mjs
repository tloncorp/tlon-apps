import { isDeepStrictEqual as same } from 'node:util';
import { assessScrollReadingTrace } from '../packages/app/fixtures/scrollReadingTrace.ts';
import { assessScrollReferenceTrace } from '../packages/app/fixtures/scrollReferenceTrace.ts';

const pending = 'Loading remote content...';
const unavailable = 'Content not available';
const editedSuffix =
  ' The source was edited while its reference remained visible. This longer revision wraps across several lines and must never revert to the original quotation after becoming ready.';
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (...v) => v.every(Number.isFinite);
const near = (a, b) => finite(a, b) && Math.abs(a - b) <= 1;
const id = (v) =>
  typeof v === 'string' && /^\d+(?:\.\d+)*$/.test(v)
    ? v.replaceAll('.', '')
    : undefined;

export const referenceScenarioRegistry = ['latest', 'history'].map(
  (position) => ({
    scenario: `web-reference-reading-${position}`,
    title: `uncached reference resolves and updates without moving the reading character (${position})`,
    matrix: ['CNT-11', 'STA-02', 'STA-03', 'FLK-07', 'FLK-12'],
    history: [],
    traceNames: ['load', 'edit'].map(
      (phase) => `reference-${position}-${phase}-geometry`
    ),
    source: 'apps/tlon-web/e2e/scroller-reference-stability.spec.ts',
    suite: null,
    scope: `One actual uncached local-ship reference and same-source edit at ${position}, with exact source/author and unchanged interior character; normal desktop application flags and Vite assets. Partial reference loading/revision coverage only; no native, painted-frame, error/retry or other content proof.`,
    evidenceLevel: 'sampled-dom-reference-and-reading-point',
    requireAnchors: true,
    requireReferenceProof: true,
    referencePosition: position,
  })
);

export function referenceAttachmentNames(position) {
  return [
    ...['load', 'edit'].flatMap((phase) => [
      `reference-${position}-${phase}-proof`,
      `reference-${position}-${phase}-reading-raw`,
    ]),
    `reference-${position}-committed-edit`,
  ];
}

/** Replay separate evidence dimensions; no declared PASS is trusted. */
export function replayWebReference(record) {
  const issues = [];
  const reject = (message, kind = 'incomplete') =>
    issues.push({ message: `Reference: ${message}`, kind });
  const registered = referenceScenarioRegistry.find(
    (item) => item.scenario === record?.scenario
  );
  if (!registered || !same(record.contract, registered)) {
    reject('Missing exact registered scenario contract');
    return issues;
  }
  const position = registered.referencePosition;
  const get = (items, name) => {
    const matches = (Array.isArray(items) ? items : []).filter(
      (item) => item?.name === name
    );
    return matches.length === 1 && !matches[0].error
      ? matches[0].value
      : undefined;
  };
  const proofs = {};
  for (const phase of ['load', 'edit']) {
    const label = `reference-${position}-${phase}`;
    const proof = get(record.referenceProofs, `${label}-proof`);
    const raw = get(record.referenceProofs, `${label}-reading-raw`);
    const geometry = get(record.browserTraces, `${label}-geometry`);
    proofs[phase] = proof;
    try {
      replayPhase({
        record,
        proof,
        raw,
        geometry,
        label,
        phase,
        position,
        reject,
      });
    } catch {
      reject(`${phase}: malformed raw evidence`);
    }
  }
  const { load, edit } = proofs;
  if (object(load) && object(edit)) {
    if (
      ![
        'source',
        'sourceId',
        'sourceChannel',
        'containingEssay',
        'preparation',
        'requests',
        'clockDomains',
      ].every((key) => same(load[key], edit[key])) ||
      !same(
        load.contract?.reading?.revision,
        edit.contract?.reading?.revision
      ) ||
      load.contract?.reading?.rowId !== edit.contract?.reading?.rowId ||
      load.contract?.reading?.scope !== edit.contract?.reading?.scope ||
      load.contract?.reading?.blockSelector !==
        edit.contract?.reading?.blockSelector ||
      !finite(
        load.contract?.reading?.coverage?.endTime,
        edit.contract?.reading?.coverage?.startTime
      ) ||
      edit.contract.reading.coverage.startTime <=
        load.contract.reading.coverage.endTime ||
      !same(load.containingBefore, edit.containingBefore)
    )
      reject(
        'Load and edit do not belong to one retained reference and ordered capture'
      );
  }
  const committed = get(
    record.referenceProofs,
    `reference-${position}-committed-edit`
  );
  if (
    !object(committed) ||
    !object(edit) ||
    !id(edit.sourceId) ||
    id(committed.seal?.id) !== id(edit.sourceId) ||
    !plainEssay(committed.essay, edit.contract?.afterText) ||
    !finite(Number(committed.revision), Number(edit.source?.revision)) ||
    Number(committed.revision) !== Number(edit.source?.revision) + 1
  )
    reject('Missing exact backend source revision commit');
  if (object(edit)) {
    const beginning = Date.parse(record.attemptStartTime);
    const write = edit.editWrite;
    const essay = write?.actions?.[0]?.json?.channel?.action?.post?.edit?.essay;
    if (
      !same(committed?.essay, essay) ||
      committed?.read?.url !==
        `http://localhost:3000/~/scry/channels/v5/${edit.sourceChannel}/posts/newest/100/post.json` ||
      !finite(
        committed?.read?.requestedAt,
        committed?.read?.completedAt,
        beginning
      ) ||
      committed.read.requestedAt < write?.completedAt ||
      committed.read.requestedAt < beginning ||
      committed.read.completedAt < committed.read.requestedAt ||
      !finite(committed?.read?.requestedTime, committed?.read?.completedTime) ||
      committed.read.requestedTime <
        edit.contract?.reading?.coverage?.endTime ||
      committed.read.completedTime < committed.read.requestedTime
    )
      reject(
        'Backend edited essay/read is not bound to the exact write and terminal capture'
      );
    validateClockPairs(record, edit, committed, reject);
  }
  return issues;
}

function plainEssay(essay, text) {
  return (
    object(essay) &&
    essay.author === '~zod' &&
    essay.kind === '/chat' &&
    finite(essay.sent) &&
    essay.meta === null &&
    essay.blob === null &&
    same(essay.content, [{ inline: [text] }])
  );
}

function replayPhase({
  record,
  proof,
  raw,
  geometry,
  label,
  phase,
  position,
  reject,
}) {
  const add = (message, kind = 'incomplete') =>
    reject(`${phase}: ${message}`, kind);
  if (!object(proof) || !object(proof.trace) || !object(proof.contract)) {
    add('Missing phase proof');
    return;
  }
  const {
    trace,
    contract,
    source,
    sourceChannel,
    sourceId,
    containingEssay,
    preparation,
    requests,
  } = proof;
  const reading = contract.reading;
  const text = reading?.revision?.text;
  const first = phase === 'load' ? contract.afterText : contract.beforeText;
  const second = first + editedSuffix;
  const startAt = Date.parse(record.attemptStartTime);
  // Playwright's elapsed duration is monotonic, not a wall-clock endpoint.
  // Bound the fresh browser's performance clock by that elapsed duration and
  // crosslink wall/performance pairs instead of inventing a wall-clock end.
  const withinAttempt = (time) => finite(time, startAt) && time >= startAt;
  let destination;
  try {
    destination = decodeURIComponent(
      reading.scope.split('/channel/')[1] ?? ''
    ).replace(/\/$/, '');
  } catch {
    /* rejected below */
  }
  const fixed =
    /^Reference [0-9a-f]{8}: the original quoted words\.$/.test(first ?? '') &&
    /^Reference reader [0-9a-f]{8} keeps this exact reading character visible\.$/.test(
      text ?? ''
    ) &&
    /^chat\/~zod\/[^/]+$/.test(sourceChannel ?? '') &&
    /^chat\/~zod\/[^/]+$/.test(destination ?? '') &&
    destination !== sourceChannel &&
    id(sourceId) &&
    id(source?.seal?.id) === id(sourceId) &&
    id(reading?.rowId) &&
    id(reading.rowId) !== id(sourceId) &&
    plainEssay(source?.essay, first) &&
    withinAttempt(source.essay.sent) &&
    Number.isInteger(source?.snapshot?.newerCount) &&
    source.snapshot.newerCount >= 60 &&
    Number.isInteger(source.snapshot.postCount) &&
    source.snapshot.postCount > source.snapshot.newerCount &&
    object(containingEssay) &&
    containingEssay.author === '~zod' &&
    containingEssay.kind === '/chat' &&
    withinAttempt(containingEssay.sent) &&
    source.essay.sent <= containingEssay.sent &&
    containingEssay.meta === null &&
    containingEssay.blob === null &&
    same(containingEssay.content, [
      {
        block: {
          cite: { chan: { nest: sourceChannel, where: `/msg/${sourceId}` } },
        },
      },
      { inline: [text] },
    ]) &&
    preparation?.scope === reading.scope &&
    preparation.origin === 'http://localhost:3000' &&
    preparation.ship === 'zod' &&
    preparation.e2eMode === false &&
    finite(preparation.warmupMs) &&
    preparation.warmupMs >= 2000 &&
    preparation.channel === 'chromium' &&
    preparation.headed === true &&
    preparation.assets === 'Vite development assets' &&
    typeof preparation.browser === 'string' &&
    preparation.browser.length > 0 &&
    same(proof.clockDomains, {
      transport: 'Date.now milliseconds',
      capture: 'performance.now milliseconds',
    }) &&
    contract.beforeText === (phase === 'load' ? pending : first) &&
    contract.afterText === (phase === 'load' ? first : second) &&
    same(
      contract.forbiddenTexts,
      phase === 'load' ? [unavailable, second] : [unavailable, pending]
    ) &&
    reading.revision.id === `reference-reader-${reading.rowId}` &&
    reading.point?.start === text.indexOf('reading') &&
    reading.point.end === reading.point.start + 1 &&
    reading.point.tolerancePx === 1 &&
    reading.coverage?.maxGapMs === 100 &&
    reading.coverage.maxMeasurementDurationMs === 32 &&
    finite(
      contract.actionTime,
      reading.terminalTime,
      reading.coverage.startTime,
      reading.coverage.endTime
    ) &&
    contract.actionTime - reading.coverage.startTime >= 200 &&
    reading.terminalTime >= contract.actionTime &&
    reading.terminalTime - contract.actionTime <= 10_000 &&
    reading.coverage.endTime === reading.terminalTime + 1000 &&
    finite(record.attemptDurationMs) &&
    reading.coverage.endTime <= record.attemptDurationMs;
  if (!fixed) {
    add('Source, scope, essay or fixed phase contract is invalid');
    return;
  }
  const path = `/v5/said/~zod/${sourceChannel}/post/${sourceId}`;
  const request =
    Array.isArray(requests) && requests.length === 1 ? requests[0] : undefined;
  if (
    !request ||
    request.path !== path ||
    ![request.requestedAt, request.releasedAt, request.forwardedAt].every(
      withinAttempt
    ) ||
    request.releasedAt - request.requestedAt < 200 ||
    request.forwardedAt < request.releasedAt ||
    containingEssay.sent > request.requestedAt ||
    !finite(request.requestedTime) ||
    request.requestedTime >= reading.coverage.startTime
  )
    add('Missing actual uncached request/release/forward transport');
  const postIds = source.snapshot.postIds;
  if (
    !Array.isArray(postIds) ||
    postIds.some((value) => !id(value)) ||
    new Set(postIds.map(id)).size !== postIds.length ||
    postIds.length !== source.snapshot.postCount ||
    postIds.filter((value) => id(value) === id(sourceId)).length !== 1 ||
    postIds.filter((value) => BigInt(id(value)) > BigInt(id(sourceId)))
      .length !== source.snapshot.newerCount
  )
    add(
      'Source history inventory does not independently prove the uncached preparation'
    );
  validateTransport(proof, phase, path, contract, withinAttempt, add);
  validateClockPairs(record, proof, undefined, reject);

  // Structural and temporal validity is independent of the reference-author
  // dimension. A missing author capture cannot hide an otherwise valid jump.
  const read = assessScrollReadingTrace(trace, reading);
  const validReading = !read.issues.some(
    (issue) => issue.kind === 'incomplete' || issue.sampleIndex === 0
  );
  const rawMatches = same(raw, trace);
  if (!rawMatches) add('Missing or contradictory duplicate raw reading trace');
  const geometryIssues = validateGeometry(
    geometry,
    trace,
    contract,
    label,
    position
  );
  geometryIssues.forEach((issue) => add(issue.message, issue.kind));
  const validGeometry = !geometryIssues.some(
    (issue) => issue.kind === 'incomplete'
  );
  read.issues.forEach((issue) =>
    add(
      issue.code,
      validReading && rawMatches && validGeometry ? issue.kind : 'incomplete'
    )
  );
  if (validReading && rawMatches && validGeometry) {
    const ref = assessScrollReferenceTrace(
      trace,
      contract,
      assessScrollReadingTrace
    );
    const ownIssues = ref.issues.filter(
      (issue) => !read.issues.some((other) => same(other, issue))
    );
    const validReference = !ownIssues.some(
      (issue) => issue.kind === 'incomplete' || issue.sampleIndex === 0
    );
    ownIssues.forEach((issue) =>
      add(issue.code, validReference ? issue.kind : 'incomplete')
    );
  } else
    add(
      'Reference semantics require valid baseline and paired temporal capture'
    );
  if (
    contract.authorSelector !== '.is_PostReferenceAuthorName' ||
    contract.authorLabel !== '~zod'
  )
    add('Missing independently declared production source author');
}

function validateGeometry(geometry, trace, contract, label, position) {
  const issues = [];
  const add = (message, kind = 'incomplete') => issues.push({ message, kind });
  const reading = contract.reading;
  if (
    !object(geometry) ||
    !Array.isArray(geometry.frames) ||
    geometry.frames.length < 6 ||
    !Array.isArray(geometry.errors) ||
    geometry.errors.length ||
    !Array.isArray(geometry.marks)
  ) {
    add('Missing paired geometry');
    return issues;
  }
  const frames = geometry.frames;
  const starts = geometry.marks.filter(
    (mark) => mark?.label === `${label}:start`
  );
  const ends = geometry.marks.filter(
    (mark) => mark?.label === `${label}:terminal-state`
  );
  if (
    geometry.marks.length !== 2 ||
    starts.length !== 1 ||
    ends.length !== 1 ||
    !finite(starts[0]?.time, ends[0]?.time) ||
    starts[0].time > contract.actionTime ||
    contract.actionTime - starts[0].time > 100 ||
    ends[0].time < reading.terminalTime ||
    ends[0].time - reading.terminalTime > 100 ||
    frames[0]?.time > reading.coverage.startTime ||
    frames.at(-1)?.time < reading.coverage.endTime
  )
    add(
      'Geometry action/terminal markers or planned deadline are not crosslinked'
    );
  for (const [index, frame] of frames.entries()) {
    const row = frame?.anchors?.[reading.rowId];
    if (
      !frame ||
      !finite(
        frame.time,
        frame.scrollTop,
        frame.scrollHeight,
        frame.clientHeight,
        frame.viewportTop,
        frame.viewportBottom,
        frame.bottomGap
      ) ||
      frame.clientHeight <= 0 ||
      frame.scrollHeight <= frame.clientHeight ||
      !near(frame.viewportBottom - frame.viewportTop, frame.clientHeight) ||
      !near(
        frame.bottomGap,
        frame.scrollHeight - frame.clientHeight - frame.scrollTop
      ) ||
      !object(frame.anchors) ||
      Object.keys(frame.anchors).length !== 1 ||
      !row ||
      !finite(row.top, row.bottom, row.height) ||
      row.height <= 0 ||
      !near(row.bottom - row.top, row.height) ||
      (index &&
        (frame.time <= frames[index - 1].time ||
          frame.time - frames[index - 1].time > 100))
    ) {
      add('Invalid paired geometry or capture gap');
      break;
    }
  }
  if (
    position === 'latest'
      ? !near(frames[0]?.bottomGap, 0)
      : !(frames[0]?.bottomGap > 100)
  )
    add('Invalid latest/history baseline precondition');
  if (
    !Array.isArray(trace.samples) ||
    trace.samples.some(
      (sample) =>
        !frames.some((frame) => {
          const row = frame?.anchors?.[reading.rowId];
          return (
            Math.abs(frame.time - sample?.time) <= 100 &&
            near(frame.viewportTop, sample?.list?.rect?.top) &&
            near(frame.viewportBottom, sample?.list?.rect?.bottom) &&
            near(row?.height, sample?.row?.rect?.height) &&
            near(row?.top + frame.viewportTop, sample?.row?.rect?.top)
          );
        })
    )
  )
    add('Reading point and geometry do not share viewport/row coordinates');
  if (
    !issues.length &&
    position === 'latest' &&
    frames.some((frame) => Math.abs(frame.bottomGap) > 1)
  )
    add('Latest did not remain pinned throughout capture', 'failure');
  return issues;
}

function validateClockPairs(record, proof, committed, reject) {
  const pairs = [];
  const pair = (wall, time) => {
    if (wall !== undefined && time !== undefined) pairs.push([wall, time]);
  };
  for (const request of Array.isArray(proof.requests) ? proof.requests : []) {
    pair(request.requestedAt, request.requestedTime);
    pair(request.releasedAt, request.releasedTime);
    pair(request.forwardedAt, request.forwardedTime);
  }
  for (const entry of [
    proof.editWrite,
    proof.containingBefore?.read,
    proof.containingAfter?.read,
    committed?.read,
  ]) {
    pair(entry?.requestedAt, entry?.requestedTime);
    pair(entry?.completedAt, entry?.completedTime);
  }
  const offsets = pairs.map(([wall, time]) => wall - time);
  if (
    !pairs.length ||
    pairs.some(
      ([wall, time]) =>
        !finite(wall, time) ||
        wall < Date.parse(record.attemptStartTime) ||
        time < 0 ||
        time > record.attemptDurationMs
    ) ||
    Math.max(...offsets) - Math.min(...offsets) > 100
  )
    reject(
      'Transport wall/performance pairs do not belong to a coherent current browser lifetime'
    );
}

function validateTransport(proof, phase, path, contract, withinAttempt, add) {
  const request = proof.requests?.[0];
  const actions = request?.actions;
  if (
    request?.method !== 'PUT' ||
    !/^http:\/\/localhost:3000\/~\/channel\/[^/?#]+$/.test(
      request?.url ?? ''
    ) ||
    !Array.isArray(actions) ||
    actions.filter(
      (action) =>
        action?.action === 'subscribe' &&
        action.ship === 'zod' &&
        action.app === 'channels' &&
        action.path === path
    ).length !== 1 ||
    !same(actions, request.forwardedActions) ||
    request.overrideProvided !== false ||
    !finite(
      request.requestedTime,
      request.releasedTime,
      request.forwardedTime
    ) ||
    request.releasedTime < request.requestedTime ||
    request.forwardedTime < request.releasedTime ||
    (phase === 'load' &&
      (request.releasedTime < contract.actionTime ||
        request.forwardedTime > contract.reading.terminalTime))
  )
    add('Missing raw unchanged-forwarding action and capture-clock evidence');
  // More specific write/scry fields are validated below once present; missing
  // fields stay incomplete instead of upgrading old fixture input to proof.
  if (
    !proof.containingBefore ||
    !proof.containingAfter ||
    id(proof.containingBefore.seal?.id) !== id(contract.reading.rowId) ||
    id(proof.containingAfter.seal?.id) !== id(contract.reading.rowId) ||
    !same(proof.containingBefore.essay, proof.containingEssay) ||
    !same(proof.containingAfter.essay, proof.containingEssay)
  )
    add('Missing immutable backend containing-post witnesses');
  let destination;
  try {
    destination = decodeURIComponent(
      contract.reading.scope.split('/channel/')[1] ?? ''
    );
  } catch {
    /* rejected below */
  }
  for (const [which, capture] of [
    ['before', proof.containingBefore],
    ['after', proof.containingAfter],
  ]) {
    const read = capture?.read;
    if (
      read?.url !==
        `http://localhost:3000/~/scry/channels/v5/${destination}/posts/newest/100/post.json` ||
      ![read?.requestedAt, read?.completedAt].every(withinAttempt) ||
      read.completedAt < read.requestedAt ||
      !finite(read?.requestedTime, read?.completedTime) ||
      read.completedTime < read.requestedTime ||
      (which === 'before'
        ? read.completedTime > contract.reading.coverage.startTime
        : read.requestedTime < contract.reading.coverage.endTime)
    )
      add(`Missing containing-post ${which} read chronology`);
  }
  if (phase !== 'edit') return;
  const write = proof.editWrite;
  const essay = write?.actions?.[0]?.json?.channel?.action?.post?.edit?.essay;
  const expectedPost = { edit: { id: proof.sourceId, essay } };
  if (
    !object(write) ||
    write.method !== 'PUT' ||
    !/^http:\/\/localhost:3000\/~\/channel\/scroller-reference-[0-9a-f-]+$/.test(
      write.url ?? ''
    ) ||
    !Number.isInteger(write.status) ||
    write.status < 200 ||
    write.status >= 300 ||
    !plainEssay(essay, contract.afterText) ||
    !withinAttempt(essay.sent) ||
    ![write.requestedAt, write.completedAt].every(withinAttempt) ||
    write.completedAt < write.requestedAt ||
    !finite(write.requestedTime, write.completedTime) ||
    write.requestedTime < contract.actionTime ||
    write.completedTime < write.requestedTime ||
    write.completedTime > contract.reading.terminalTime ||
    !same(write.actions, [
      {
        id: 1,
        action: 'poke',
        ship: 'zod',
        app: 'channels',
        mark: 'channel-action-2',
        json: {
          channel: {
            nest: proof.sourceChannel,
            action: { post: expectedPost },
          },
        },
      },
    ])
  )
    add('Missing actual exact source edit request/acknowledgement');
}

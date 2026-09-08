import { isDeepStrictEqual as equal } from 'node:util';
import { assessScrollReadingTrace } from '../packages/app/fixtures/scrollReadingTrace.ts';

export const centerEditTitle =
  'editing a visible message above the center reading character preserves that character';
export const centerEditBelowTitle =
  'editing a visible message below the center reading character preserves that character';
export function centerEditPlan(token) {
  if (!/^[a-f0-9]{8}$/.test(token))
    throw new Error('Expected an eight-digit scenario token');
  const corpus = Array.from(
    { length: 36 },
    (_, i) =>
      `Center ${token} row ${i}: unchanged reading words remain visible in this conversation.`
  );
  const original = `Center ${token} edit target: original short text.`;
  corpus[17] = original;
  return {
    token,
    corpus,
    readerIndex: 18,
    editedIndex: 17,
    original,
    expanded:
      `Center ${token} edit target: ${'A deliberately longer saved revision occupies more lines above the reader. '.repeat(9)}`.trimEnd(),
    shrunk: `Center ${token} edit target: short again.`,
    charStart: corpus[18].indexOf('reading'),
    charEnd: corpus[18].indexOf('reading') + 1,
    tolerancePx: 1,
    maxGapMs: 100,
    maxAcquisitionMs: 32,
    quietTailMs: 1000,
    minimumHeightChangePx: 32,
  };
}
/** The legacy ABOVE plan remains unchanged; BELOW has its own exact corpus. */
export function centerEditBelowPlan(token) {
  const plan = centerEditPlan(token);
  plan.corpus[17] = `Center ${token} row 17: unchanged reading words remain visible in this conversation.`;
  plan.corpus[19] = plan.original;
  plan.editedIndex = 19;
  plan.expanded = plan.expanded.replaceAll(
    'above the reader',
    'below the reader'
  );
  return plan;
}
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const canonical = (s) =>
  typeof s === 'string' && /^(?:[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)$/.test(s)
    ? s.replaceAll('.', '')
    : null;
const content = (text) => [{ inline: [text] }];
const verdict = (issues) =>
  issues.some((i) => i.kind === 'failure')
    ? 'FAIL'
    : issues.length
      ? 'INCOMPLETE'
      : 'PASS';

/** Exact raw replay of one bounded geometry/revision case. No paint claim.
 * The existing exposure oracle is called unchanged and its entire result retained.
 * Menu coverage cannot be used to excuse point drift, identity or missing samples.
 */
export function replayCenterEditEvidence(proof, attempt) {
  const issues = [];
  const add = (code, kind = 'incomplete', index) =>
    issues.push({ code, kind, ...(index === undefined ? {} : { index }) });
  let readingAssessment = null;
  const finish = () => ({
    verdict: verdict(issues),
    issues,
    readingAssessment,
    scope:
      'sampled exact center-character geometry and two actual saved revisions; exposure is a separate unmodified oracle result',
    exposure: 'NOT_QUALIFIED_DURING_USER_OPENED_MENUS',
    presentedFrames: 'INCOMPLETE',
    responseEndLatency: 'INCOMPLETE',
  });
  try {
    const below = attempt?.title === centerEditBelowTitle;
    const plan = below
      ? centerEditBelowPlan(proof?.plan?.token)
      : centerEditPlan(proof?.plan?.token);
    const p = proof.preparation,
      c = proof.readingContract,
      t = proof.reading;
    const startWall = Date.parse(attempt?.startTime),
      duration = attempt?.duration;
    if (
      (attempt?.title !== centerEditTitle && !below) ||
      !finite(startWall) ||
      !finite(duration) ||
      duration <= 0 ||
      !equal(plan, proof.plan) ||
      p?.origin !== 'http://localhost:3000' ||
      p.ship !== 'zod' ||
      p.e2eMode !== false ||
      typeof p.headed !== 'boolean' ||
      ![p.timeOrigin, p.time, p.wall].every(finite) ||
      Math.abs(p.wall - p.timeOrigin - p.time) > 100 ||
      p.wall < startWall - 100 ||
      p.wall > startWall + duration ||
      !/^chat\/~zod\/[^/]+$/.test(proof.channel) ||
      !p.scope.includes(encodeURIComponent(proof.channel)) ||
      !Array.isArray(proof.errors) ||
      proof.errors.length
    ) {
      add('invalid-attempt-plan-or-local-scope');
      return finish();
    }
    if (
      !canonical(proof.readerId) ||
      !canonical(proof.editedId) ||
      canonical(proof.readerId) === canonical(proof.editedId) ||
      !c ||
      c.scope !== p.scope ||
      c.rowId !== proof.readerId ||
      c.revision.id !== proof.readerId + ':unchanged' ||
      c.revision.text !== plan.corpus[18] ||
      c.point.start !== plan.charStart ||
      c.point.end !== plan.charEnd ||
      c.point.tolerancePx !== 1 ||
      c.coverage.maxGapMs !== 100 ||
      c.coverage.maxMeasurementDurationMs !== 32 ||
      c.coverage.endTime !== c.terminalTime + 1000 ||
      t.samples[0].time !== c.coverage.startTime ||
      c.coverage.startTime < p.time ||
      c.coverage.endTime + p.timeOrigin > startWall + duration + 100
    ) {
      add('invalid-fixed-reading-contract');
      return finish();
    }
    readingAssessment = assessScrollReadingTrace(t, c);
    for (const issue of readingAssessment.issues) {
      // The original exposure result remains intact. It is not a continuous
      // unobstructed-content requirement while the user opens a real menu.
      if (issue.code !== 'text-obstructed')
        add('reading:' + issue.code, issue.kind, issue.sampleIndex);
    }
    const baseline = t.samples[0];
    if (
      Math.abs(c.point.y - baseline.list.rect.height / 2) > 24 ||
      !baseline.point ||
      Math.abs(c.point.y - baseline.point.relativeY) > 0.01 ||
      Math.abs(c.point.x - baseline.point.relativeX) > 0.01 ||
      readingAssessment.issues.some((i) => i.sampleIndex === 0)
    )
      add('unqualified-center-reading-baseline');
    if (
      !finite(p.wheelStartedAt) ||
      p.time < p.wheelStartedAt ||
      p.time - p.wheelStartedAt > 30000 ||
      !Array.isArray(proof.wheel) ||
      !proof.wheel.some(
        (w) =>
          w.trusted === true &&
          finite(w.time) &&
          finite(w.observedAt) &&
          Math.abs(w.observedAt - w.time) <= 100 &&
          w.scope === p.scope &&
          w.sameList === true &&
          w.time >= p.wheelStartedAt &&
          w.time < c.coverage.startTime &&
          w.deltaY < 0
      )
    )
      add('missing-actual-upward-read');
    const frames = proof.observer?.frames;
    if (
      !Array.isArray(frames) ||
      frames.length < 6 ||
      proof.observer.errors.length ||
      frames[0].time > c.coverage.startTime ||
      frames.at(-1).time < c.coverage.endTime
    ) {
      add('missing-full-neighbor-observer');
      return finish();
    }
    for (const [i, f] of frames.entries()) {
      if (
        ![
          f.time,
          f.duration,
          f.offset,
          f.extent,
          f.height,
          f.edited.top,
          f.edited.height,
        ].every(finite) ||
        !Number.isInteger(f.menuCount) ||
        f.menuCount < 0 ||
        f.menuCount > 1 ||
        f.duration < 0 ||
        f.duration > 32 ||
        f.scope !== p.scope ||
        f.edited.id !== proof.editedId ||
        f.edited.count !== 1 ||
        f.edited.bodyCount !== 1 ||
        f.height <= 0 ||
        f.extent <= f.height ||
        (i &&
          (f.time <= frames[i - 1].time || f.time - frames[i - 1].time > 100))
      )
        add('invalid-neighbor-observer', 'incomplete', i);
      // This first case intentionally excludes range clamping. It cannot turn
      // an asynchronously joined range into permission to move the point.
      if (f.offset <= 1 || f.extent - f.height - f.offset <= 1)
        add('outside-unclamped-read-slice', 'incomplete', i);
      if (
        ![plan.original, plan.expanded + ' ', plan.shrunk + ' '].includes(
          f.edited.text
        )
      )
        add('unexpected-edited-text', 'failure', i);
    }
    if (
      frames[0].extent - frames[0].height - frames[0].offset < 200 ||
      frames[0].edited.top <= 0 ||
      (below
        ? frames[0].edited.top <= c.point.y ||
          frames[0].edited.top + frames[0].edited.height >= frames[0].height
        : frames[0].edited.top + frames[0].edited.height >= c.point.y)
    )
      add(
        below
          ? 'edited-row-not-exposed-below-reader'
          : 'edited-row-not-exposed-above-reader'
      );
    const actions = proof.observer.events;
    if (
      !Array.isArray(actions) ||
      actions.length !== 6 ||
      !equal(
        actions.map((a) => a.kind),
        ['trigger', 'edit', 'save', 'trigger', 'edit', 'save']
      ) ||
      actions.some(
        (a, i) =>
          !finite(a.time) ||
          a.trusted !== true ||
          a.scope !== p.scope ||
          (i && a.time <= actions[i - 1].time) ||
          (a.kind === 'trigger' && a.rowId !== proof.editedId)
      )
    )
      add('missing-exact-real-edit-actions');
    if (
      !Array.isArray(proof.commits) ||
      proof.commits.length !== 2 ||
      !Array.isArray(proof.requests) ||
      proof.requests.length !== 2
    ) {
      add('missing-two-edits');
      return finish();
    }
    const expected = [plan.expanded + ' ', plan.shrunk + ' '];
    const snapshots = [
      proof.before,
      ...proof.commits.map((c) => c.read),
      proof.after,
    ];
    let firstMap;
    for (const [i, read] of snapshots.entries()) {
      const url = `${p.origin}/~/scry/channels/v5/${proof.channel}/posts/newest/100/post.json`;
      const body = read?.body,
        entries = Object.entries(body?.posts ?? {}),
        map = new Map();
      if (
        read?.url !== url ||
        read.status !== 200 ||
        ![read.startTime, read.endTime].every(finite) ||
        read.endTime < read.startTime ||
        entries.length !== 36 ||
        body.total !== 36 ||
        body.newest !== 36 ||
        body.older !== null ||
        body.newer !== null
      ) {
        add('incomplete-exact-backend-window');
        continue;
      }
      for (const [key, post] of entries) {
        const id = canonical(post?.seal?.id);
        if (
          !id ||
          id !== canonical(key) ||
          map.has(id) ||
          post.essay?.author !== '~zod'
        )
          add('invalid-backend-post-identity');
        map.set(id, post);
      }
      if (i === 0) {
        firstMap = map;
        if (
          read.endTime > c.coverage.startTime ||
          !equal(
            [...map.values()]
              .map((v) => v.essay.content)
              .sort((a, b) =>
                JSON.stringify(a).localeCompare(JSON.stringify(b))
              ),
            plan.corpus
              .map(content)
              .sort((a, b) =>
                JSON.stringify(a).localeCompare(JSON.stringify(b))
              )
          )
        )
          add('wrong-initial-corpus');
      } else if (firstMap) {
        for (const [id, post] of firstMap)
          if (id !== canonical(proof.editedId) && !equal(map.get(id), post))
            add('unrelated-post-mutated', 'failure');
      }
      const target = map.get(canonical(proof.editedId)),
        reader = map.get(canonical(proof.readerId));
      if (
        !equal(reader?.essay.content, content(plan.corpus[18])) ||
        !equal(
          target?.essay.content,
          content(i === 0 ? plan.original : expected[Math.min(i - 1, 1)])
        )
      )
        add('wrong-committed-content', 'failure');
      if (i === 3 && read.startTime < c.coverage.endTime)
        add('final-read-before-quiet-tail');
    }
    for (const [i, commit] of proof.commits.entries()) {
      const req = proof.requests[i],
        edit = req.actions?.[0]?.json?.channel?.action?.post?.edit;
      const committedPosts = Object.values(
        commit.read?.body?.posts ?? {}
      ).filter((p) => canonical(p.seal?.id) === canonical(proof.editedId));
      if (
        committedPosts.length !== 1 ||
        !equal(committedPosts[0].essay, edit?.essay)
      )
        add('edit-request-and-committed-essay-differ', 'failure');
      if (
        req.method !== 'PUT' ||
        !req.url.startsWith(p.origin + '/~/channel/') ||
        !Number.isInteger(req.status) ||
        req.status < 200 ||
        req.status >= 300 ||
        !equal(JSON.parse(req.body), req.actions) ||
        req.actions.length !== 1 ||
        req.actions[0].action !== 'poke' ||
        req.actions[0].app !== 'channels' ||
        req.actions[0].ship !== 'zod' ||
        req.actions[0].mark !== 'channel-action-2' ||
        req.actions[0].json.channel.nest !== proof.channel ||
        canonical(edit?.id) !== canonical(proof.editedId) ||
        edit.essay?.author !== '~zod' ||
        !equal(edit.essay.content, content(expected[i])) ||
        ![req.startTime, req.headersTime, commit.time, commit.height].every(
          finite
        ) ||
        req.startTime < actions[i * 3 + 2].time - 100 ||
        req.headersTime < req.startTime ||
        commit.read.startTime < req.headersTime ||
        (req.endTime === null
          ? req.status !== 204
          : !finite(req.endTime) ||
            req.endTime < req.headersTime ||
            req.endTime > proof.after.endTime) ||
        commit.time < commit.read.endTime ||
        (i === 0 && commit.time >= actions[3].time) ||
        commit.time > c.terminalTime ||
        !frames.some(
          (f) =>
            Math.abs(f.time - commit.time) <= 100 &&
            f.edited.text === expected[i] &&
            Math.abs(f.edited.height - commit.height) <= 1
        )
      )
        add('invalid-actual-edit-commit-link');
    }
    if (
      proof.commits[0].height - frames[0].edited.height < 32 ||
      proof.commits[0].height - proof.commits[1].height < 32
    )
      add('unproven-two-height-mutations');
    for (const [i, frame] of frames.entries()) {
      const expectedText =
        frame.time >= proof.commits[1].time
          ? expected[1]
          : frame.time >= proof.commits[0].time && frame.time < actions[5].time
            ? expected[0]
            : null;
      if (expectedText !== null && frame.edited.text !== expectedText)
        add('committed-ui-revision-reverted', 'failure', i);
    }
    for (const issue of readingAssessment.issues.filter(
      (i) => i.code === 'text-obstructed'
    )) {
      const sample = t.samples[issue.sampleIndex];
      const nearest = frames.reduce((a, b) =>
        Math.abs(a.time - sample.time) < Math.abs(b.time - sample.time) ? a : b
      );
      if (Math.abs(nearest.time - sample.time) > 32)
        add('unqualified-obstruction-interval');
      else if (nearest.menuCount !== 1)
        add(
          'unexpected-obstruction-outside-user-menu',
          'failure',
          issue.sampleIndex
        );
    }
    if (
      !frames.some(
        (f) =>
          f.menuCount === 1 &&
          f.time > actions[0].time &&
          f.time < actions[1].time
      ) ||
      !frames.some(
        (f) =>
          f.menuCount === 1 &&
          f.time > actions[3].time &&
          f.time < actions[4].time
      )
    )
      add('missing-real-menu-exposure-intervals');
  } catch (error) {
    add('malformed-center-edit-proof');
  }
  return finish();
}

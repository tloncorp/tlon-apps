import { isDeepStrictEqual as equal } from 'node:util';
import { assessProductionAssets } from './scroll-stability-web-assets.cjs';
import { assessScrollReadingTrace } from '../packages/app/fixtures/scrollReadingTrace.ts';

export const paginationTitle =
  'older pagination failure retains reading and a real boundary retry prepends once';
export const paginationAttachment = 'pagination-retry-proof';
export function paginationPlan(token) {
  if (!/^[a-f0-9]{8}$/.test(token)) throw Error('Invalid pagination token');
  return {
    token,
    corpus: Array.from({ length: 120 }, (_, i) =>
      `Pagination ${token} row ${i}: ${'Original reading words remain in this conversation. '.repeat(2 + (i % 3))}`.trim()
    ),
    failures: 5,
    pageCount: 30,
    maxGapMs: 100,
    maxMeasurementMs: 32,
    tolerancePx: 1,
    quietTailMs: 1000,
  };
}
const finite = Number.isFinite;
const id = (value) =>
  typeof value === 'string' && /^\d[\d.]*$/.test(value)
    ? value.replaceAll('.', '')
    : null;
export function paginationBackendRows(body) {
  if (!body?.posts || typeof body.posts !== 'object') return null;
  const rows = Object.values(body.posts).map((post) => ({
    id: id(String(post?.seal?.id)),
    sequence: Number(post?.seal?.seq),
    text:
      post?.essay?.content?.length === 1 &&
      post.essay.content[0].inline?.length === 1
        ? post.essay.content[0].inline[0]
        : null,
    author: post?.essay?.author,
  }));
  return rows.every(
    (row) =>
      row.id &&
      Number.isSafeInteger(row.sequence) &&
      row.sequence > 0 &&
      typeof row.text === 'string' &&
      row.author === '~zod'
  )
    ? rows
    : null;
}

/** Fixed two-stage product proof. Existing reading geometry is replayed intact;
 * no attached producer verdict or configurable retry policy is authoritative. */
export function replayPaginationEvidence(proof, attempt) {
  const issues = [];
  const add = (code, kind = 'incomplete') => issues.push({ code, kind });
  const readings = [];
  const finish = () => ({
    verdict: issues.some((i) => i.kind === 'failure')
      ? 'FAIL'
      : issues.length
        ? 'INCOMPLETE'
        : 'PASS',
    issues,
    readings,
    presentedFrames: 'INCOMPLETE',
    scope:
      'DAT-03 and retained-content DAT-11; no send/newer/moving/empty-page qualification',
  });
  try {
    const plan = paginationPlan(proof?.plan?.token),
      s = proof.session;
    const wall = Date.parse(attempt?.startTime),
      endWall = wall + attempt?.duration;
    if (
      attempt?.title !== paginationTitle ||
      !finite(wall) ||
      !finite(endWall) ||
      endWall <= wall ||
      !equal(plan, proof.plan) ||
      s?.origin !== 'http://localhost:3000' ||
      s.ship !== 'zod' ||
      s.e2eMode !== false ||
      !finite(s.timeOrigin) ||
      !finite(s.time) ||
      s.timeOrigin + s.time < wall ||
      s.timeOrigin + s.time > endWall ||
      typeof s.headed !== 'boolean' ||
      !equal(s.viewport, { width: 1280, height: 800 }) ||
      proof.freshContext?.storage !== 'cookies-and-localStorage-only' ||
      !/^chat\/~zod\/[^/]+$/.test(proof.channel) ||
      !s.scope.endsWith('/channel/' + encodeURIComponent(proof.channel))
    ) {
      add('pagination-declaration');
      return finish();
    }
    if (proof.assets === 'Built production assets')
      issues.push(
        ...assessProductionAssets(proof.assetProof, {
          origin: s.origin,
          scope: s.scope,
          attemptStartTime: attempt.startTime,
          attemptDurationMs: attempt.duration,
          performanceEndTime: proof.phases?.at(-1)?.contract?.coverage?.endTime,
        })
      );
    else if (proof.assets !== 'Vite development assets')
      add('pagination-assets-unavailable');
    const backend = paginationBackendRows(proof.backend?.body);
    const endpoint = `${s.origin}/~/scry/channels/v5/${proof.channel}/posts/`;
    if (
      proof.backend?.url !== endpoint + 'newest/150/post.json' ||
      proof.backend.status !== 200 ||
      !finite(proof.backend.startWall) ||
      !finite(proof.backend.endWall) ||
      proof.backend.startWall < wall ||
      proof.backend.endWall < proof.backend.startWall ||
      proof.backend.endWall > s.timeOrigin + s.time ||
      backend?.length !== plan.corpus.length ||
      new Set(backend.map((r) => r.id)).size !== backend.length ||
      new Set(backend.map((r) => r.sequence)).size !== backend.length ||
      !equal(backend.map((r) => r.text).sort(), [...plan.corpus].sort())
    ) {
      add('pagination-backend-corpus');
      return finish();
    }
    const byId = new Map(backend.map((r) => [r.id, r]));
    const validQuery = (q) =>
      q &&
      q.scope === s.scope &&
      q.timeOrigin === s.timeOrigin &&
      finite(q.time) &&
      finite(q.durationMs) &&
      q.durationMs >= 0 &&
      q.durationMs <= plan.maxMeasurementMs &&
      q.timeOrigin + q.time >= wall &&
      q.timeOrigin + q.time <= endWall &&
      Array.isArray(q.key) &&
      q.key[0] === 'channelPosts' &&
      q.key[1] === proof.channel &&
      Array.isArray(q.rows) &&
      q.rows.length > 0 &&
      Array.isArray(q.pageParams) &&
      q.rows.every(
        (r) =>
          typeof r.id === 'string' &&
          typeof r.text === 'string' &&
          Number.isSafeInteger(r.sequence)
      );
    const before = proof.before,
      failed = proof.failed,
      pending = proof.retryPending,
      after = proof.after;
    if (
      ![before, failed, pending, after].every(validQuery) ||
      ![failed, pending, after].every((q) => equal(q.key, before.key)) ||
      failed.status !== 'error' ||
      failed.fetchStatus !== 'idle' ||
      failed.failureCount !== 5 ||
      pending.fetchStatus !== 'fetching' ||
      after.status !== 'success' ||
      after.fetchStatus !== 'idle'
    ) {
      add('pagination-query-window');
      return finish();
    }
    if (
      ![before, failed, pending, after].every(
        (q) =>
          new Set(q.rows.map((r) => id(r.id))).size === q.rows.length &&
          q.rows.every((r, i) => {
            const b = byId.get(id(r.id));
            return (
              b &&
              b.text === r.text &&
              b.sequence === r.sequence &&
              (i === 0 || q.rows[i - 1].sequence > r.sequence)
            );
          })
      ) ||
      !equal(failed.rows, before.rows) ||
      !equal(pending.rows, before.rows)
    ) {
      add('pagination-query-membership', 'failure');
      return finish();
    }
    const cursor = Math.min(...before.rows.map((r) => r.sequence));
    const start = Math.max(1, cursor - plan.pageCount);
    const url = endpoint + `range/${start}/${cursor}/outline.json`;
    const requests = proof.requests;
    if (
      !Array.isArray(requests) ||
      requests.length !== 6 ||
      requests.some(
        (r, i) =>
          r.url !== url ||
          r.method !== 'GET' ||
          !finite(r.start) ||
          !finite(r.release) ||
          !finite(r.end) ||
          r.start < before.time ||
          r.release < r.start ||
          r.end < r.release ||
          r.end > after.time ||
          (i < 5
            ? r.outcome !== 'aborted'
            : r.outcome !== 'continued' || r.status !== 200) ||
          (i > 0 && r.start < requests[i - 1].end)
      )
    ) {
      add('pagination-request-train');
      return finish();
    }
    const added = backend.filter(
      (r) => r.sequence >= start && r.sequence < cursor
    );
    const responseRows = paginationBackendRows(requests[5].body);
    if (!responseRows) {
      add('pagination-response-unavailable');
      return finish();
    }
    if (
      !added.length ||
      !added.every((r) => responseRows.some((b) => equal(r, b))) ||
      responseRows.some(
        (r) =>
          !equal(r, byId.get(r.id)) || r.sequence < start || r.sequence > cursor
      ) ||
      !equal(
        after.rows.map((r) => id(r.id)),
        [
          ...before.rows.map((r) => id(r.id)),
          ...added.sort((a, b) => b.sequence - a.sequence).map((r) => r.id),
        ]
      )
    )
      add('pagination-prepend-membership', 'failure');
    const moves = proof.moves,
      observed = proof.observer;
    if (
      !Array.isArray(moves) ||
      moves.length !== 3 ||
      !observed ||
      observed.errors?.length ||
      !Array.isArray(observed.wheel) ||
      !Array.isArray(observed.frames) ||
      observed.frames.length < 6
    ) {
      add('pagination-boundary-actions');
      return finish();
    }
    const [initial, away, retry] = moves;
    if (
      !equal(
        moves.map((m) => m.kind),
        ['initial', 'away', 'retry']
      ) ||
      moves.some(
        (m) =>
          !finite(m.start) ||
          !finite(m.end) ||
          m.end < m.start ||
          !observed.wheel.some(
            (e) =>
              e.time >= m.start &&
              e.time <= m.end &&
              e.observedAt >= e.time &&
              e.observedAt - e.time <= 100 &&
              e.scope === s.scope &&
              e.trusted === true &&
              e.sameList === true &&
              (m.kind === 'away' ? e.deltaY > 0 : e.deltaY < 0)
          )
      ) ||
      !(
        initial.start <= requests[0].start &&
        initial.end < requests[0].release &&
        away.start > failed.time &&
        away.end <= retry.start &&
        away.offset > away.height &&
        retry.start <= requests[5].start &&
        retry.end < requests[5].release
      )
    )
      add('pagination-boundary-actions');
    const attemptEndTime = endWall - s.timeOrigin;
    const frames = observed.frames;
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i],
        previous = frames[i - 1];
      if (
        !finite(f.time) ||
        !finite(f.duration) ||
        f.time < s.time ||
        f.time + f.duration > attemptEndTime ||
        f.duration < 0 ||
        f.duration > 32 ||
        f.scope !== s.scope ||
        !finite(f.height) ||
        f.height <= 0 ||
        !Array.isArray(f.neighbors)
      ) {
        add('pagination-frame-unavailable');
        continue;
      }
      if (previous && (f.time <= previous.time || f.time - previous.time > 100))
        add('pagination-capture-gap');
      if (
        f.neighbors.some(
          (r) => !finite(r.top) || !finite(r.height) || r.height <= 0
        )
      ) {
        add('pagination-frame-unavailable');
        continue;
      }
      if (
        f.neighbors.length === 0 ||
        new Set(f.neighbors.map((r) => r.id)).size !== f.neighbors.length ||
        f.neighbors.some(
          (r, index) =>
            !byId.has(id(r.id)) ||
            (index > 0 &&
              byId.get(id(f.neighbors[index - 1].id))?.sequence >=
                byId.get(id(r.id))?.sequence)
        )
      )
        add('pagination-visible-row-membership', 'failure');
    }
    for (const [i, phase] of (proof.phases ?? []).entries()) {
      const c = phase.contract,
        trace = phase.raw,
        request = requests[i === 0 ? 0 : 5];
      const terminal = i === 0 ? failed.time : after.time;
      if (
        i > 1 ||
        c?.scope !== s.scope ||
        byId.get(id(c?.rowId))?.text !== c?.revision?.text ||
        c.point?.tolerancePx !== 1 ||
        c.coverage?.maxGapMs !== 100 ||
        c.coverage?.maxMeasurementDurationMs !== 32 ||
        !finite(c.coverage.startTime) ||
        c.coverage.startTime < (i === 0 ? initial.end : retry.end) ||
        c.coverage.startTime > request.release ||
        c.coverage.startTime < s.time ||
        c.coverage.endTime > attemptEndTime ||
        c.terminalTime < terminal ||
        c.coverage.endTime - c.terminalTime !== 1000 ||
        c.coverage.startTime < frames[0].time ||
        c.coverage.endTime > frames.at(-1).time ||
        (i === 0 && c.coverage.endTime > away.start) ||
        !trace?.samples?.length ||
        Math.abs(c.point.y - trace.samples[0].list.rect.height / 2) > 24
      ) {
        add('pagination-reading-authority');
        continue;
      }
      const boundedSamples = trace.samples.filter(
        (sample) =>
          finite(sample.time) &&
          finite(sample.measurement?.durationMs) &&
          sample.time >= s.time &&
          sample.time + sample.measurement.durationMs <= attemptEndTime
      );
      if (boundedSamples.length !== trace.samples.length)
        add('pagination-reading-outside-attempt');
      const result = assessScrollReadingTrace(
        { ...trace, samples: boundedSamples },
        c
      );
      readings.push(result);
      issues.push(
        ...result.issues.map((issue) => ({
          ...issue,
          code: `pagination-${i}:${issue.code}`,
        }))
      );
    }
    if (proof.phases?.length !== 2 || readings.length !== 2)
      add('pagination-reading-count');
    if (proof.errors?.length) add('pagination-capture-error');
    if (
      proof.cleanup?.gatesReleased !== true ||
      proof.cleanup?.contextClosed !== true
    )
      add('pagination-cleanup-incomplete');
  } catch {
    add('pagination-proof-unavailable');
  }
  return finish();
}

import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { assessProductionAssets } from './scroll-stability-web-assets.mjs';
import { inflateSync } from 'node:zlib';
import { assessConcurrentContentEvidence } from '../packages/app/fixtures/scrollConcurrentContentTrace.ts';
import { assessScrollReadingTrace } from '../packages/app/fixtures/scrollReadingTrace.ts';

/** Independent entry point. Call with the raw -proof attachment, never assessment. */
export function replayConcurrentContentProof(proof, attempt) {
  const result = assessConcurrentContentEvidence(
    proof,
    assessScrollReadingTrace
  );
  for (const media of Array.isArray(proof?.media) ? proof.media : []) {
    try {
      const bytes = Buffer.from(media.png, 'base64');
      if (
        bytes.length !== media.bytes ||
        createHash('sha256').update(bytes).digest('hex') !== media.sha256 ||
        !bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        bytes.readUInt32BE(16) !== media.width ||
        bytes.readUInt32BE(20) !== media.height
      )
        throw new Error('Mismatched original PNG bytes');
      const compressed = [];
      let offset = 8;
      let ended = false;
      while (offset < bytes.length) {
        const length = bytes.readUInt32BE(offset);
        const type = bytes.toString('ascii', offset + 4, offset + 8);
        const end = offset + 8 + length;
        if (end + 4 > bytes.length) throw new Error('Truncated PNG chunk');
        let crc = 0xffffffff;
        for (const byte of bytes.subarray(offset + 4, end)) {
          crc ^= byte;
          for (let bit = 0; bit < 8; bit++)
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
        if ((crc ^ 0xffffffff) >>> 0 !== bytes.readUInt32BE(end))
          throw new Error('Invalid PNG checksum');
        if (type === 'IDAT') compressed.push(bytes.subarray(offset + 8, end));
        if (type === 'IEND') {
          ended = true;
          if (end + 4 !== bytes.length) throw new Error('Trailing PNG bytes');
        }
        offset = end + 4;
      }
      const raster = inflateSync(Buffer.concat(compressed), {
        maxOutputLength: (media.width * 3 + 1) * media.height,
      });
      if (
        !ended ||
        bytes[24] !== 8 ||
        bytes[25] !== 2 ||
        raster.length !== (media.width * 3 + 1) * media.height
      )
        throw new Error('Wrong original raster');
      for (let y = 0; y < media.height; y++)
        if (raster[y * (media.width * 3 + 1)] !== 0)
          throw new Error('Unexpected raster filter');
    } catch {
      result.issues.push({
        code: 'invalid-original-png',
        kind: 'incomplete',
        stream: media?.id,
      });
    }
  }
  if (proof?.preparation?.assets === 'Built production assets')
    result.issues.push(
      ...assessProductionAssets(proof.preparation.assetProof, {
        origin: proof.preparation.origin,
        scope: proof.preparation.scope,
        attemptStartTime: attempt?.startTime,
        attemptDurationMs: attempt?.duration,
        attemptWallEndTime: attempt?.wallEndTime,
        attemptClockError: attempt?.clockError,
        performanceEndTime: proof.reading?.contract?.coverage?.endTime,
      }).map((issue) => ({ kind: issue.kind, code: issue.message }))
    );
  result.verdict = result.issues.some((issue) => issue.kind === 'failure')
    ? 'FAIL'
    : result.issues.length
      ? 'INCOMPLETE'
      : 'PASS';
  return result;
}

export const concurrentScenarioRegistry = ['latest', 'history'].flatMap(
  (position) =>
    ['portrait', 'landscape'].map((first) => ({
      scenario: `web-concurrent-${position}-${first}`,
      title: `two real images finish ${first} first without disturbing ${position === 'history' ? 'history near bottom' : position}`,
      legacyTitles:
        position === 'history'
          ? [`two real images finish ${first} first without disturbing history`]
          : [],
      source: 'apps/tlon-web/e2e/scroller-concurrent-content.spec.ts',
      suite: null,
      matrix: ['STA-01', 'FLK-07', 'FLK-12'],
      history: [],
      traceNames: [],
      scope: `Two independently held real PNGs in one unchanged post, ${first} first at ${position === 'history' ? 'READ near bottom with hidden latest eligibility' : 'FOLLOW'}; sampled DOM content/reading/geometry, fixed one-second tail. Asset provenance is per attempt; no retry, replacement, visible latest transition or presented/native frame proof.`,
      evidenceLevel: 'sampled-dom-overlapping-image-loads',
      requireConcurrentContentProof: true,
      concurrentPosition: position,
      concurrentFirst: first,
      concurrentAttachment: `concurrent-${position}-${first}-proof`,
    }))
);

export function replayWebConcurrent(record) {
  const issues = [];
  const reject = (message, kind = 'incomplete') =>
    issues.push({ message: `Concurrent content: ${message}`, kind });
  const registered = concurrentScenarioRegistry.find(
    (item) => item.scenario === record?.scenario
  );
  if (!registered || !isDeepStrictEqual(record.contract, registered)) {
    reject('Missing exact registered contract');
    return issues;
  }
  const attachments = record.concurrentProofs;
  if (
    !Array.isArray(attachments) ||
    attachments.length !== 1 ||
    attachments[0]?.name !== registered.concurrentAttachment ||
    attachments[0]?.error ||
    !attachments[0]?.value
  ) {
    reject('Missing unique raw proof');
    return issues;
  }
  const proof = attachments[0].value;
  const replay = replayConcurrentContentProof(proof, {
    startTime: record.attemptStartTime,
    duration: record.attemptDurationMs,
    wallEndTime: record.attemptWallEndTime,
    clockError: record.attemptClockError,
  });

  issues.push(
    ...replay.issues.map((issue) => ({
      kind: issue.kind,
      message: `Concurrent content: ${issue.stream ?? 'proof'}:${issue.code}${issue.sampleIndex === undefined ? '' : ` sample ${issue.sampleIndex}`}`,
    }))
  );
  if (
    proof.position !== registered.concurrentPosition ||
    !isDeepStrictEqual(proof.order, [
      registered.concurrentFirst,
      registered.concurrentFirst === 'portrait' ? 'landscape' : 'portrait',
    ])
  )
    reject('Wrong registered position or completion order');
  if (proof.reading?.trace?.blockAcquisition !== 'retained-element')
    reject('Missing retained-element acquisition provenance');
  const start = Date.parse(record.attemptStartTime),
    end = record.attemptWallEndTime ?? start + record.attemptDurationMs;
  if (
    !Number.isFinite(start) ||
    record.attemptClockError ||
    !Number.isFinite(end) ||
    !(record.attemptDurationMs > 0) ||
    !Array.isArray(proof.requests) ||
    proof.requests.some(
      (request) =>
        ![request.requestedAt, request.releasedAt, request.fulfilledAt].every(
          (t) => Number.isFinite(t) && t >= start && t <= end
        )
    )
  )
    reject('Asset requests are not within this Playwright attempt');
  return issues;
}

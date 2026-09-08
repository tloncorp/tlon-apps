import { describe, expect, it } from 'vitest';
import { assessScrollReadingTrace } from './scrollReadingTrace';
import {
  assessConcurrentContentEvidence,
  type ConcurrentContentProof,
} from './scrollConcurrentContentTrace';
import { concurrentEvidence as evidence } from './scrollConcurrentContentTestSupport';
import { replayConcurrentContentProof } from '../../../scripts/scroll-stability-concurrent-content-evidence.mjs';

const assess = (proof: ConcurrentContentProof) =>
  assessConcurrentContentEvidence(proof, assessScrollReadingTrace);
describe('two-image concurrency evidence, controls only', () => {
  for (const position of ['latest', 'history'] as const)
    for (const first of ['portrait', 'landscape'])
      it(`accepts complete ${position} with ${first} first`, () => {
        const proof = evidence(position, first);
        expect(assess(proof)).toMatchObject({
          verdict: 'PASS',
          presentedFrames: 'INCOMPLETE',
        });
        expect(replayConcurrentContentProof(proof).verdict).toBe('PASS');
      });
  it('accepts actual backend JSON object key order without changing array order', () => {
    const p = evidence();
    const reverse = (value: any): any =>
      Array.isArray(value)
        ? value.map(reverse)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value)
                .reverse()
                .map(([key, child]) => [key, reverse(child)])
            )
          : value;
    p.before.essay = reverse(p.before.essay);
    expect(assess(p).verdict).toBe('PASS');
  });
  it('rejects reversed image block order even when backend before/after agree', () => {
    const p = evidence();
    const story = (p.before.essay as any).content;
    [story[0], story[1]] = [story[1], story[0]];
    p.after.essay = structuredClone(p.before.essay);
    expect(
      assess(p).issues.some(
        (issue) => issue.code === 'missing-exact-backend-content'
      )
    ).toBe(true);
  });
  it('rejects a changed expected image field despite matching before/after', () => {
    const p = evidence();
    (p.before.essay as any).content[0].block.image.alt = 'Wrong media';
    p.after.essay = structuredClone(p.before.essay);
    expect(
      assess(p).issues.some(
        (issue) => issue.code === 'missing-exact-backend-content'
      )
    ).toBe(true);
  });
  it('rejects an independently wrong latest eligibility declaration', () => {
    const p = evidence('history');
    p.chromeEligibility.visibility = 'visible';
    expect(
      assess(p).issues.some(
        (issue) => issue.code === 'invalid-chrome-eligibility'
      )
    ).toBe(true);
  });
  const failures: Array<[string, (p: ConcurrentContentProof) => void]> = [
    [
      'source replacement',
      (p) => {
        p.media[0].trace.samples[10].images[0].sameElement = false;
      },
    ],
    [
      'wrong current source',
      (p) => {
        p.media[0].trace.samples[10].images[0].currentSrc =
          'http://localhost:3000/stale.png';
      },
    ],
    [
      'stale completed dimensions',
      (p) => {
        p.media[0].trace.samples[10].images[0].naturalWidth = 7;
      },
    ],
    [
      'ready reverts',
      (p) => {
        p.media[0].trace.samples[10].images[0].complete = false;
      },
    ],
    [
      'duplicate child',
      (p) => {
        p.media[0].trace.samples[10].images.push(
          structuredClone(p.media[0].trace.samples[10].images[0])
        );
      },
    ],
    [
      'error fallback',
      (p) => {
        p.media[1].trace.samples[10].fallbackPresent = true;
      },
    ],
    [
      'actual error event',
      (p) => {
        p.media[1].trace.events.push({
          ...p.media[1].trace.events[0],
          id: 'image-error',
        });
      },
    ],
    [
      'hidden loaded pixels',
      (p) => {
        p.media[0].trace.samples[10].images[0].presentation.opacity = 0;
      },
    ],
    [
      'covered loaded pixels',
      (p) => {
        p.media[0].trace.samples[10].images[0].frontmost = false;
      },
    ],
    [
      'post identity changes',
      (p) => {
        p.media[0].trace.samples[10].sameRow = false;
      },
    ],
    [
      'immutable essay changed',
      (p) => {
        p.after.essay = { content: [] };
      },
    ],
    [
      'latest flashes',
      (p) => {
        p.chrome.samples[10].controls[0].visible = true;
        p.chrome.samples[10].controls[0].opacity = 1;
      },
    ],
    [
      'unexpected loading glyph',
      (p) => {
        p.chrome.samples[10].controls[0].kind = 'loading';
      },
    ],
    [
      'bottom gaps briefly',
      (p) => {
        p.geometry.frames[10].scrollTop -= 8;
        p.geometry.frames[10].bottomGap += 8;
      },
    ],
    [
      'inner reading displacement',
      (p) => {
        p.reading.trace.samples[10].point!.relativeY += 12;
      },
    ],
  ];
  it.each(failures)('rejects %s', (_label, corrupt) => {
    const p = evidence();
    corrupt(p);
    expect(assess(p).issues.some((issue) => issue.kind === 'failure')).toBe(
      true
    );
  });
  const missing: Array<[string, (p: ConcurrentContentProof) => void]> = [
    [
      'wrong declared order',
      (p) => {
        p.order.reverse();
      },
    ],
    [
      'overlap too short',
      (p) => {
        p.media[1].releaseTime = 600;
      },
    ],
    [
      'absent request',
      (p) => {
        p.requests.pop();
      },
    ],
    [
      'duplicate request',
      (p) => {
        p.requests[1] = p.requests[0];
      },
    ],
    [
      'early request release',
      (p) => {
        p.requests[0].releasedTime = 100;
      },
    ],
    [
      'untrusted load',
      (p) => {
        p.media[0].trace.events[0].trusted = false;
      },
    ],
    [
      'no actual decode',
      (p) => {
        p.media[0].trace.events.pop();
      },
    ],
    [
      'missing stream tail',
      (p) => {
        p.media[0].trace.samples.pop();
      },
    ],
    [
      'sparse stream',
      (p) => {
        p.media[0].trace.samples.splice(9, 3);
      },
    ],
    [
      'slow acquisition',
      (p) => {
        p.media[0].trace.samples[10].measurement.durationMs = 33;
      },
    ],
    [
      'incomplete image inventory',
      (p) => {
        p.media[0].trace.samples.forEach((s) => {
          s.images = s.images.filter((i) => i.sameElement);
        });
      },
    ],
    [
      'missing actual resize',
      (p) => {
        p.media[1].trace.samples.forEach((s) => {
          s.imageFrame.rect.height = 400;
          s.imageFrame.rect.bottom = 450;
          s.imageFrame.clip.height = 400;
          s.imageFrame.clip.bottom = 450;
        });
      },
    ],
    [
      'weakened sampling guard',
      (p) => {
        p.reading.contract.coverage.maxGapMs = 101;
      },
    ],
    [
      'weak point criterion',
      (p) => {
        p.reading.contract.point.tolerancePx = 2;
      },
    ],
    [
      'unrelated geometry witness',
      (p) => {
        p.geometry.frames.forEach((frame) => {
          frame.anchors['123'].top += 40;
          frame.anchors['123'].bottom += 40;
        });
      },
    ],
    [
      'backend after before tail',
      (p) => {
        p.after.read.requestedTime = 1500;
      },
    ],
  ];
  it.each(missing)('keeps %s incomplete', (_label, corrupt) => {
    const p = evidence();
    corrupt(p);
    expect(assess(p).issues.some((issue) => issue.kind === 'incomplete')).toBe(
      true
    );
  });
  it('refuses missing raw proof', () =>
    expect(assess(undefined as any).verdict).toBe('INCOMPLETE'));
  it('independently rejects altered original PNG bytes', () => {
    const p = evidence();
    p.media[0].png = Buffer.from('wrong bytes').toString('base64');
    expect(
      replayConcurrentContentProof(p).issues.some(
        (issue) => issue.code === 'invalid-original-png'
      )
    ).toBe(true);
  });
});

describe('concurrent image behavior versus headed and presentation qualification', () => {
  for (const position of ['latest', 'history'] as const)
    for (const first of ['portrait', 'landscape'])
      for (const headed of [true, false])
        it(`keeps ${position}/${first} ${headed ? 'headed' : 'headless'} behavior separate`, () => {
          const proof = evidence(position, first);
          proof.preparation.headed = headed;
          for (const result of [
            assess(proof),
            replayConcurrentContentProof(proof),
          ]) {
            expect(result.verdict).toBe('PASS');
            expect(result.headedBehavior).toBe(headed ? 'PASS' : 'INCOMPLETE');
            expect(result.presentedFrames).toBe('INCOMPLETE');
            expect(result.fullQualification).toBe('INCOMPLETE');
          }
        });
  it.each([undefined, null, 'false', 0])(
    'rejects unrecorded or malformed mode %s',
    (mode) => {
      const proof = evidence();
      proof.preparation.headed = mode as any;
      expect(assess(proof).verdict).toBe('INCOMPLETE');
      expect(assess(proof).headedBehavior).toBe('INCOMPLETE');
    }
  );
  it('keeps the accepted history button threshold and its failure in headless mode', () => {
    const proof = evidence('history');
    proof.preparation.headed = false;
    proof.chrome.samples[10].controls[0].visible = true;
    proof.chrome.samples[10].controls[0].opacity = 1;
    const result = assess(proof);
    expect(result.verdict).toBe('FAIL');
    expect(result.headedBehavior).toBe('INCOMPLETE');
    expect(result.fullQualification).toBe('FAIL');
  });
  it('does not turn missing original PNG evidence into headed qualification', () => {
    const proof = evidence();
    proof.media[0].png = Buffer.from('invalid bytes').toString('base64');
    const result = replayConcurrentContentProof(proof);
    expect(result.verdict).toBe('INCOMPLETE');
    expect(result.headedBehavior).toBe('INCOMPLETE');
    expect(result.fullQualification).toBe('INCOMPLETE');
  });
});

import { describe, expect, it } from 'vitest';
import {
  assessPendingNavigationTrace,
  navigationBackendThreadRows,
} from './scrollNavigationTrace';

import { evidence } from './scrollNavigationPendingTestData';

type Evidence = ReturnType<typeof evidence>;
const assess = (e: Evidence) =>
  assessPendingNavigationTrace(e.trace, e.plan, e.proof);

describe('real pending-navigation evidence controls', () => {
  it.each(['reply-sync', 'missing-parent'] as const)(
    'accepts qualifying %s evidence with exact original response and quiet tail',
    (kind) => {
      expect(assess(evidence(kind))).toMatchObject({
        verdict: 'PASS',
        presentation: 'INCOMPLETE',
        durableReads: 'INCOMPLETE',
      });
    }
  );
  it('keeps a missing-parent blank as a UI failure despite qualifying pending transport', () => {
    const e = evidence('missing-parent');
    e.trace.samples[16].loadingCount = 0;
    expect(assess(e).issues).toContainEqual({
      code: 'blank-content',
      kind: 'failure',
      sampleIndex: 16,
    });
    expect(assess(e).verdict).toBe('FAIL');
  });
  it('rejects a stale destination returning after original response completion', () => {
    const e = evidence();
    e.trace.samples[70].lists = structuredClone(e.trace.samples[20].lists);
    expect(assess(e).verdict).toBe('FAIL');
  });
  it.each([
    [
      'invalid preparation clock',
      (e: Evidence) => {
        e.proof.before.time = NaN;
      },
    ],
    [
      'invalid backend clock',
      (e: Evidence) => {
        e.proof.backend.completedAt = NaN;
      },
    ],
    [
      'non-array local result',
      (e: Evidence) => {
        e.proof.local!.thread!.ids = null;
      },
    ],
    [
      'malformed original payload',
      (e: Evidence) => {
        e.proof.requests[0].responseBody = 'not a thread';
      },
    ],
    [
      'no GET',
      (e: Evidence) => {
        e.proof.requests = [];
      },
    ],
    [
      'duplicate GET',
      (e: Evidence) => {
        e.proof.requests.push(structuredClone(e.proof.requests[0]));
      },
    ],
    [
      'wrong target',
      (e: Evidence) => {
        e.proof.requests[0].url += '/wrong';
      },
    ],
    [
      'intercept before click',
      (e: Evidence) => {
        e.proof.requests[0].interceptedTime = 100;
      },
    ],
    [
      'release before Back',
      (e: Evidence) => {
        e.proof.requests[0].releasedTime = 600;
      },
    ],
    [
      'release before returned content',
      (e: Evidence) => {
        e.proof.requests[0].releasedTime = 710;
      },
    ],
    [
      'failed completion',
      (e: Evidence) => {
        e.proof.requests[0].failure = 'abort';
      },
    ],
    [
      'wrong status',
      (e: Evidence) => {
        e.proof.requests[0].responseStatus = 404;
      },
    ],
    [
      'changed reply text',
      (e: Evidence) => {
        (e.proof.requests[0].responseBody as typeof e.backendBody).seal.replies[
          '100.007'
        ]['reply-essay'].content[0].inline[0] = 'Wrong';
      },
    ],
    [
      'short completion tail',
      (e: Evidence) => {
        e.proof.requests[0].completedTime = 3000;
      },
    ],
    [
      'missing local witness',
      (e: Evidence) => {
        e.proof.local = null;
      },
    ],
    [
      'local query still pending',
      (e: Evidence) => {
        e.proof.local!.thread!.status = 'pending';
      },
    ],
    [
      'replies already cached',
      (e: Evidence) => {
        e.proof.local!.thread!.ids = ['100.001'];
      },
    ],
    [
      'wrong cached parent',
      (e: Evidence) => {
        e.proof.local!.parent!.id = '100.099';
      },
    ],
    [
      'not cold thread',
      (e: Evidence) => {
        e.proof.before.threadQueryPresent = true;
      },
    ],
  ])('does not qualify %s', (_name, mutate) => {
    const e = evidence();
    mutate(e);
    expect(assess(e).issues.some((issue) => issue.kind === 'incomplete')).toBe(
      true
    );
  });
  it.each([
    [
      'cached parent',
      (e: Evidence) => {
        e.proof.before.parentQueryPresent = true;
      },
    ],
    [
      'resolved parent',
      (e: Evidence) => {
        e.proof.local!.parent!.id = '100.000';
      },
    ],
    [
      'wrong referenced reply',
      (e: Evidence) => {
        e.proof.before.reference!.id = '100.008';
      },
    ],
    [
      'wrong quote text',
      (e: Evidence) => {
        e.proof.before.reference!.text = 'Wrong';
      },
    ],
  ])('keeps missing-parent coverage incomplete for %s', (_name, mutate) => {
    const e = evidence('missing-parent');
    mutate(e);
    expect(assess(e).verdict).toBe('INCOMPLETE');
  });
  it('rejects an author or parent mismatch in independently returned backend essays', () => {
    const e = evidence();
    (e.proof.backend.body as typeof e.backendBody).seal.replies['100.007'].seal[
      'parent-id'
    ] = '100009';
    expect(navigationBackendThreadRows(e.proof.backend.body)).toBeNull();
  });
});

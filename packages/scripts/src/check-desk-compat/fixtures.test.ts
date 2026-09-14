import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { Finding, isBlocking, runCheck } from './check';
import { WORKTREE_REF, ensureRef } from './git';

/**
 * The v10/v3 incident, replayed.
 *
 * `854b46c` is the client commit that shipped `/v10/init` and the `/v3/groups`
 * subscription; `v12.1.0` is the desk release before the one that added them.
 * The desk change and the client cutover landed nine seconds apart, so no
 * released desk could serve that client.
 *
 * These **hard-fail rather than skip** when the refs are absent: a
 * compatibility gate that quietly skips its only regression evidence is worse
 * than no gate. Refs are fetched on demand (`--no-tags --depth=1`), which is
 * what a fresh CI checkout needs.
 */
// The full SHA: a remote cannot be asked for a short one.
const CLIENT = '854b46c3ddd7ccf122485dd447a1225da7a66638';
const N1 = 'v12.1.0';
/** Two releases back: old enough that the activity guards are exercised. */
const WITH_GUARDS = 'v12.0.0';
/** The desk release the incident client shipped against. */
const SHIPPED_WITH = 'v12.2.0';

/**
 * The desk this working tree must support, read from the constant that defines
 * it rather than pinned: once MIN_GROUPS_VERSION moves, this fixture must move
 * with it, or `test:ci` would fail on a perfectly valid client.
 */
const MIN_GROUPS_VERSION = /MIN_GROUPS_VERSION = '([^']+)'/.exec(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../shared/src/logic/deskPolicy.ts'
    ),
    'utf8'
  )
)?.[1];
const N1_TAG = `v${MIN_GROUPS_VERSION}`;

for (const ref of [
  CLIENT,
  N1,
  WITH_GUARDS,
  N1_TAG,
  SHIPPED_WITH,
  'origin/develop',
])
  ensureRef(ref);

const keysWith = (findings: Finding[], verdict: Finding['verdict']) =>
  findings
    .filter((f) => f.verdict === verdict && !f.allowed)
    .map((f) => f.dependency.key)
    .sort();

describe('the incident this gate exists to catch', () => {
  const report = runCheck({ clientRef: CLIENT, deskRef: N1 });

  it('names MIN_GROUPS_VERSION rather than pinning it', () => {
    expect(MIN_GROUPS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('reports every request v12.1.0 could not take', () => {
    expect(keysWith(report.findings, 'MISSING')).toEqual([
      'poke groups group-action-5',
      'scry groups /v3/groups',
      'scry groups /v3/ui/groups/{}',
      'scry groups-ui /v10/init',
      'scry groups-ui /v11/changes/{}',
      'subscribe groups /v3/groups',
    ]);
    expect(report.findings.filter(isBlocking)).toHaveLength(6);
  });

  it('records the different failure modes of a peek and a watch', () => {
    const byKey = new Map(
      report.findings.map((f) => [f.dependency.key, f.failureMode])
    );
    expect(byKey.get('scry groups-ui /v10/init')).toBe('empty');
    expect(byKey.get('subscribe groups /v3/groups')).toBe('crash');
  });

  it('reports the protocol bump that blocks the pair outright', () => {
    // %groups went ~.groups^%2 at v12.1.0 to ^%3 at v12.2.0, which is why
    // v12.1.0 is unusable as a pinned N-1 pier and v12.2.0 is.
    expect(
      report.protocolDifferences.map((d) => `${d.agent} ${d.protocol}`).sort()
    ).toEqual(['channels groups', 'channels-server groups', 'groups groups']);
    expect(report.allowedBumps).toHaveLength(0);
  });

  it('fails the run', () => {
    expect(report.counts.missing).toBe(6);
  });
});

describe('this working tree against the desk it says it supports', () => {
  const report = runCheck({ clientRef: WORKTREE_REF, deskRef: N1_TAG });

  it('needs nothing that desk cannot take', () => {
    // This is rule (b), enforced against the branch under review.
    expect(keysWith(report.findings, 'MISSING')).toEqual([]);
    expect(report.counts.missing).toBe(0);
  });

  it('still records what it could not decide', () => {
    // A gate that decided everything would be lying: unresolved requests,
    // out-of-desk apps, threads and eyre endpoints are all real dependencies.
    expect(report.counts.unverified).toBeGreaterThan(0);
    expect(report.counts.matched).toBeGreaterThan(0);
  });
});

describe('a known-gaps entry against the base it claims to predate', () => {
  // `/chan/{}` has been missing since before v12.0.0, so it is still excused
  // when the base is checked; anything this change introduces is not.
  const allowedKey = 'subscribe groups /chan/{}';

  it('excuses a request the base already made and could not have served', () => {
    const report = runCheck({
      clientRef: WORKTREE_REF,
      deskRef: N1_TAG,
      baseRef: 'origin/develop',
    });
    expect(
      report.findings.find((f) => f.dependency.key === allowedKey)?.allowed
    ).toBeDefined();
    expect(report.counts.missing).toBe(0);
    expect(report.exemptionsUnchecked).toBeUndefined();
  });

  it('knows the entry it is honouring is about a request the base made', () => {
    // The positive case above is only meaningful if the base really makes it.
    const base = runCheck({ clientRef: 'origin/develop', deskRef: N1_TAG });
    expect(
      base.findings.some(
        (f) => f.dependency.key === allowedKey && f.verdict === 'MISSING'
      )
    ).toBe(true);
  });

  it('actually reads the base tree, rather than trusting the flag', () => {
    // The only end-to-end proof that the base is consulted: a base that
    // cannot be opened must fail the run rather than pass it silently.
    expect(() =>
      runCheck({
        clientRef: WORKTREE_REF,
        deskRef: N1_TAG,
        baseRef: 'no-such-base-ref',
      })
    ).toThrow();
  });

  it('measures the base client against the BASE desk, not this one', () => {
    // `854b46c` is the client whose own desk served /v10/init and /v3/groups;
    // `v12.1.0` is the desk that did not. Reading the base against the desk
    // under test would count those as already-broken at base — which is how a
    // change that removes an arm and adds an entry for it clears the bar.
    const againstBase = runCheck({
      clientRef: CLIENT,
      deskRef: N1,
      baseRef: CLIENT,
    });
    expect(againstBase.baseline?.ref).toBe(CLIENT);
    // Its own desk serves the six the run reports missing, so only the
    // long-standing `/chan/{}` breakage is there at base. Measured against
    // v12.1.0 instead, all six would count — and any entry naming one of them
    // would then be honoured.
    expect(againstBase.baseline!.missing).toBe(1);
    expect(againstBase.counts.missing).toBe(6);
  });

  it('knows a self-check spelled two ways is still one tree', () => {
    const sha = execFileSync('git', ['rev-parse', `${SHIPPED_WITH}^{commit}`], {
      encoding: 'utf8',
    }).trim();
    expect(runCheck({ clientRef: SHIPPED_WITH, deskRef: sha }).selfCheck).toBe(
      true
    );
    expect(runCheck({ clientRef: CLIENT, deskRef: N1 }).selfCheck).toBe(false);
  });

  it('says so when no base was given, rather than pretending it checked', () => {
    const report = runCheck({ clientRef: WORKTREE_REF, deskRef: N1_TAG });
    expect(report.exemptionsUnchecked).toContain('--base-ref');
    expect(
      report.findings.find((f) => f.dependency.key === allowedKey)?.allowed
    ).toBeDefined();
  });
});

describe('two releases back, where the capability guards bite', () => {
  const report = runCheck({ clientRef: WORKTREE_REF, deskRef: WITH_GUARDS });

  it('reports the guarded activity requests as GUARDED, not MISSING', () => {
    const guarded = keysWith(report.findings, 'GUARDED');
    for (const key of [
      'poke activity activity-action-2',
      'scry activity /v6/volume-settings',
      'subscribe activity /v6',
    ]) {
      expect(guarded).toContain(key);
    }
    expect(keysWith(report.findings, 'MISSING')).not.toContain(
      'poke activity activity-action-2'
    );
    for (const f of report.findings.filter((f) => f.verdict === 'GUARDED')) {
      expect(f.dependency.guard).toMatch(/getActivitySupportsNotes/);
    }
  });

  it('does not let a guard excuse the run itself', () => {
    // GUARDED never fails a run, but the v3 requests here still do.
    expect(report.counts.missing).toBeGreaterThan(0);
  });
});

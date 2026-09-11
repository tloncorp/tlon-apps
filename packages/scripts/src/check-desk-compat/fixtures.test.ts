import { describe, expect, it } from 'vitest';

import { Finding, runCheck } from './check';
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
const CLIENT = '854b46c';
const N1 = 'v12.1.0';
const SHIPPED_WITH = 'v12.2.0';

for (const ref of [CLIENT, N1, SHIPPED_WITH]) ensureRef(ref);

const missingKeys = (findings: Finding[]) =>
  findings
    .filter((f) => f.verdict === 'MISSING')
    .map((f) => f.dependency.key)
    .sort();

describe('incident fixture — the two call sites that broke build 440', () => {
  const report = runCheck({
    clientRef: CLIENT,
    deskRef: N1,
    onlySites: [
      { file: 'packages/api/src/client/initApi.ts', line: 38 },
      { file: 'packages/api/src/client/groupsApi.ts', line: 1327 },
    ],
  });

  it('produces exactly two records, keyed by surface, both MISSING by P1', () => {
    expect(report.findings.map((f) => f.dependency.key).sort()).toEqual([
      'scry groups-ui /v10/init',
      'subscribe groups /v3/groups',
    ]);
    expect(report.findings.map((f) => [f.verdict, f.rule])).toEqual([
      ['MISSING', 'P1'],
      ['MISSING', 'P1'],
    ]);
    expect([report.counts.found, report.counts.unverified]).toEqual([0, 0]);
  });

  it('records the different failure modes of a peek and a watch', () => {
    const byKey = new Map(
      report.findings.map((f) => [f.dependency.key, f.failureMode])
    );
    expect(byKey.get('scry groups-ui /v10/init')).toBe('empty');
    expect(byKey.get('subscribe groups /v3/groups')).toBe('crash');
  });

  it('would have flagged the boundary on the protocol check alone', () => {
    // %groups moved 2 → 3, and the two agents that expect it moved with it.
    expect(
      report.protocolDifferences.map(
        (d) =>
          `${d.agent} ~.${d.protocol} ${d.clientDeskVersions}/${d.n1Versions}`
      )
    ).toEqual([
      'channels ~.groups 3/2',
      'channels-server ~.groups 3/2',
      'groups ~.groups 3/2',
    ]);
  });
});

describe('full-scan fixture — everything build 440 required', () => {
  const report = runCheck({ clientRef: CLIENT, deskRef: N1 });

  // A superset check with an explicit list, so it documents what the release
  // required without breaking when extraction improves.
  it('reports every hand-verified gap as MISSING', () => {
    expect(missingKeys(report.findings)).toEqual(
      expect.arrayContaining([
        // v12.1.0's groups-ui tops out at [%x %v9 %init ~]
        'scry groups-ui /v10/init',
        // absent at v12.1.0; the watch arms stop at [%v2 %groups ~]
        'subscribe groups /v3/groups',
        // v12.1.0's changes arms stop at [%x %v10 %changes since=@ ~]
        'scry groups-ui /v11/changes/{}',
        // v12.1.0 has [%x ver=?(%v0 %v1 %v2) %ui %groups …]; %v3 arrives at 12.2.0
        'scry groups /v3/ui/groups/{}',
        // desk/mar/group/ at v12.1.0 has action-0…action-4 only
        'poke groups group-action-5',
        // the scry form of /v3/groups is distinct from the subscription
        'scry groups /v3/groups',
      ])
    );
  });

  it('fails the run, but still resolves most of the tree', () => {
    expect(report.counts.missing).toBeGreaterThan(0);
    expect(report.counts.found).toBeGreaterThan(40);
  });
});

describe('this working tree against the desk release it must support', () => {
  // The gate the `test-build` step runs. If this branch needs something
  // v12.2.0 does not serve, that is the whole point of the check.
  const report = runCheck({ clientRef: WORKTREE_REF, deskRef: SHIPPED_WITH });

  it('has no blocking MISSING, and no protocol difference', () => {
    const blocking = report.findings.filter(
      (f) => f.verdict === 'MISSING' && !f.allowed
    );
    expect(blocking.map((f) => f.dependency.key)).toEqual([]);
    expect(report.counts.missing).toBe(0);
    expect(report.protocolDifferences).toEqual([]);
  });

  it('exempts only what known-gaps.json names, by exact request shape', () => {
    const allowed = report.findings.filter((f) => f.allowed);
    expect(allowed.map((f) => f.dependency.key)).toEqual([
      'subscribe groups /chan/{}',
    ]);
    expect(allowed[0].allowed?.issue).toBe('TLON-6538');
  });
});

describe('the same client against the desk that actually shipped it', () => {
  const report = runCheck({ clientRef: CLIENT, deskRef: SHIPPED_WITH });

  it('serves every path the previous release could not, and agrees on protocols', () => {
    const keys = missingKeys(report.findings);
    for (const key of [
      'scry groups-ui /v10/init',
      'subscribe groups /v3/groups',
      'scry groups-ui /v11/changes/{}',
      'poke groups group-action-5',
    ]) {
      expect(keys).not.toContain(key);
    }
    expect(report.protocolDifferences).toEqual([]);
  });
});

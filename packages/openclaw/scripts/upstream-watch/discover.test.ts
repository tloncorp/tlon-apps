import { describe, expect, it } from 'vitest';

import { type DiscoverInput, discover, parseState } from './discover.ts';
import { compareVersions, parseTagList } from './versions.ts';

const npm = {
  'dist-tags': {
    // the next line, which the plugin does not ship yet
    latest: '2026.10.6',
    'extended-stable': '2026.9.8',
    beta: '2026.10.1-beta.1',
  },
  time: {
    created: '2026-01-01T00:00:00Z',
    '2026.7.1': '2026-07-12T00:00:00Z',
    '2026.8.35': '2026-09-20T00:00:00Z',
    '2026.9.4': '2026-09-15T00:00:00Z',
    '2026.9.5': '2026-09-20T00:00:00Z',
    '2026.9.6': '2026-09-25T00:00:00Z',
    '2026.9.7': '2026-09-29T00:00:00Z',
    '2026.9.7-1': '2026-09-29T01:00:00Z',
    '2026.9.8': '2026-10-03T00:00:00Z',
    '2026.10.1-beta.1': '2026-10-05T00:00:00Z',
    '2026.10.6': '2026-10-15T00:00:00Z',
  },
};

const tags = parseTagList(
  [
    'abc\trefs/tags/v2026.9.4',
    'abd\trefs/tags/v2026.9.5',
    'abe\trefs/tags/v2026.9.6',
    'abf\trefs/tags/v2026.9.7',
    'def\trefs/tags/v2026.9.8',
    'def\trefs/tags/v2026.9.8^{}',
    'fed\trefs/tags/v2026.10.1-beta.1',
  ].join('\n')
);

const tagsWithout = (...versions: string[]) =>
  new Set([...tags].filter((v) => !versions.includes(v)));

const input = (overrides: Partial<DiscoverInput>): DiscoverInput => ({
  npm,
  tags,
  prodPins: { default: '2026.7.1', internal: '2026.7.1' },
  state: { lastLatest: '2026.9.4', lastPostedAt: null, reportedUnresolved: [] },
  event: 'schedule',
  dryRun: false,
  ...overrides,
});

describe('discover', () => {
  it('posts a scheduled run when extended-stable moved, listing stable releases in between', () => {
    expect(discover(input({}))).toMatchObject({
      shouldPost: true,
      prev: '2026.9.4',
      next: '2026.9.8',
      intermediates: ['2026.9.5', '2026.9.6', '2026.9.7'],
      untaggedIntermediates: [],
      latestPublishedAt: '2026-10-03T00:00:00Z',
      latest: '2026.10.6',
      noTag: false,
      trigger: 'extended-stable',
      bootstrap: undefined,
      // 9.4 through 9.8 are newer than the prod pin on the 9.x line
      releasesBehindOnLine: 5,
      daysBehind: 83,
    });
  });

  it('does nothing when extended-stable has not moved, whatever latest does', () => {
    const state = {
      lastLatest: '2026.9.8',
      lastPostedAt: null,
      reportedUnresolved: [],
    };
    expect(discover(input({ state })).shouldPost).toBe(false);
    const latestMoved = {
      ...npm,
      'dist-tags': { ...npm['dist-tags'], latest: '2026.10.7' },
    };
    expect(discover(input({ npm: latestMoved, state }))).toMatchObject({
      shouldPost: false,
      next: '2026.9.8',
      latest: '2026.10.7',
    });
  });

  it('fails without a stable extended-stable, even when latest is set', () => {
    const { 'extended-stable': _, ...rest } = npm['dist-tags'];
    expect(() =>
      discover(input({ npm: { ...npm, 'dist-tags': rest } }))
    ).toThrow(/extended-stable/);
    expect(() =>
      discover(
        input({
          npm: {
            ...npm,
            'dist-tags': { ...rest, 'extended-stable': '2026.9.8-1' },
          },
        })
      )
    ).toThrow(/extended-stable/);
  });

  it('bootstraps silently without state', () => {
    expect(discover(input({ state: undefined }))).toMatchObject({
      shouldPost: false,
      bootstrap: {
        lastLatest: '2026.9.8',
        lastPostedAt: null,
        reportedUnresolved: [],
      },
    });
    expect(
      discover(
        input({ state: undefined, dryRun: true, event: 'workflow_dispatch' })
      ).bootstrap
    ).toBeUndefined();
  });

  it('a dispatch with version posts against its baseline and never bootstraps', () => {
    const forced = discover(
      input({
        event: 'workflow_dispatch',
        version: '2026.9.7',
        baseline: '2026.7.1',
        state: undefined,
        tags: tagsWithout('2026.9.7'),
      })
    );
    expect(forced).toMatchObject({
      shouldPost: true,
      prev: '2026.7.1',
      next: '2026.9.7',
      trigger: 'dispatch',
      bootstrap: undefined,
      noTag: true,
    });
    // 8.35 is a maintenance release published after 9.x opened (9.4, 9/15)
    expect(forced.intermediates).toEqual(['2026.9.4', '2026.9.5', '2026.9.6']);
    expect(
      discover(
        input({
          event: 'workflow_dispatch',
          version: '2026.9.7',
          baseline: '2026.7.1',
          dryRun: true,
        })
      ).shouldPost
    ).toBe(false);
    expect(() =>
      discover(input({ event: 'workflow_dispatch', version: '2026.9.7' }))
    ).toThrow(/baseline/);
  });

  it('a dispatch without version never posts', () => {
    expect(discover(input({ event: 'workflow_dispatch' })).shouldPost).toBe(
      false
    );
  });

  it('flags an npm extended-stable without an upstream tag', () => {
    const untagged = { ...npm, 'dist-tags': { 'extended-stable': '2026.9.7' } };
    expect(
      discover(input({ npm: untagged, tags: tagsWithout('2026.9.7') })).noTag
    ).toBe(true);
  });

  it('sets aside an untagged release in between instead of fetching it', () => {
    const result = discover(input({ tags: tagsWithout('2026.9.6') }));
    expect(result).toMatchObject({
      intermediates: ['2026.9.5', '2026.9.7'],
      untaggedIntermediates: ['2026.9.6'],
      // only next decides whether there is anything to digest
      noTag: false,
    });
  });

  it("on a line rollover, counts prev-line releases only from before next's line opened", () => {
    const rollover = {
      'dist-tags': { 'extended-stable': '2026.10.1' },
      time: {
        '2026.9.8': '2026-10-03T00:00:00Z',
        // maintenance on the 9.x line before 10.0 shipped
        '2026.9.9': '2026-10-06T00:00:00Z',
        '2026.10.0': '2026-10-08T00:00:00Z',
        // maintenance on the 9.x line after 10.0 shipped
        '2026.9.35': '2026-10-09T00:00:00Z',
        '2026.10.1': '2026-10-10T00:00:00Z',
      },
    };
    expect(
      discover(
        input({
          npm: rollover,
          tags: new Set(['2026.9.8', '2026.9.9', '2026.10.0', '2026.10.1']),
          state: {
            lastLatest: '2026.9.8',
            lastPostedAt: null,
            reportedUnresolved: [],
          },
        })
      ).intermediates
    ).toEqual(['2026.9.9', '2026.10.0']);
  });

  it('rejects versions that are not plain YYYY.M.N', () => {
    expect(() =>
      discover(
        input({
          event: 'workflow_dispatch',
          version: '2026.9.8; rm -rf /',
          baseline: '2026.9.4',
        })
      )
    ).toThrow(/stable/);
  });
});

describe('versions', () => {
  it('compares numerically per component', () => {
    expect(compareVersions('2026.9.10', '2026.9.9')).toBeGreaterThan(0);
    expect(compareVersions('2026.10.1', '2026.9.35')).toBeGreaterThan(0);
  });

  it('reads stable tags only, peeled duplicates included once', () => {
    expect([...tags]).toEqual([
      '2026.9.4',
      '2026.9.5',
      '2026.9.6',
      '2026.9.7',
      '2026.9.8',
    ]);
  });
});

describe('parseState', () => {
  it('treats an empty variable as absent and fills missing fields', () => {
    expect(parseState('')).toBeUndefined();
    expect(parseState('{"lastLatest":"2026.9.4"}')).toEqual({
      lastLatest: '2026.9.4',
      lastPostedAt: null,
      reportedUnresolved: [],
    });
    expect(() => parseState('{}')).toThrow(/lastLatest/);
  });
});

import { describe, expect, test } from 'vitest';

import type { TimelineRow } from '../Channel/ContextLens/RunTimeline';
import { projectTaskRows } from './projectTaskRows';

const timeline = (overrides: Partial<TimelineRow>[] = []): TimelineRow[] =>
  overrides.map((row, index) => ({
    key: row.key ?? `row-${index}`,
    title: row.title ?? `Step ${index}`,
    detail: row.detail ?? '',
    meta: row.meta ?? '',
    tone: row.tone ?? 'neutral',
    active: row.active,
  }));

const live = (
  label: string,
  toolCalls: { toolName: string; label: string }[] = []
) => ({
  label,
  toolCalls,
});

describe('projectTaskRows', () => {
  test('renders nothing when there is neither a run nor live activity', () => {
    expect(
      projectTaskRows({
        timeline: null,
        runFinished: false,
        runFailed: false,
        live: null,
      })
    ).toEqual([]);
  });

  test('marks the active timeline row as running', () => {
    const rows = projectTaskRows({
      timeline: timeline([
        { key: 'context', title: 'Assembled context' },
        { key: 'tools', title: 'Using web_search', active: true },
      ]),
      runFinished: false,
      runFailed: false,
      live: null,
    });
    expect(rows.map((row) => [row.id, row.status])).toEqual([
      ['context', 'completed'],
      ['tools', 'running'],
    ]);
    expect(rows.map((row) => row.sequence)).toEqual([1, 2]);
  });

  test('resolves the last row to completed when the run finishes', () => {
    const rows = projectTaskRows({
      timeline: timeline([
        { key: 'context', title: 'Assembled context' },
        { key: 'delivery', title: 'Delivered reply', active: true },
      ]),
      runFinished: true,
      runFailed: false,
      live: null,
    });
    expect(rows.at(-1)).toMatchObject({ id: 'delivery', status: 'completed' });
    expect(rows.some((row) => row.status === 'running')).toBe(false);
  });

  test('resolves the last row to failed when the run fails', () => {
    const rows = projectTaskRows({
      timeline: timeline([
        { key: 'context', title: 'Assembled context' },
        {
          key: 'delivery',
          title: 'Run failed',
          tone: 'negative',
          active: true,
        },
      ]),
      runFinished: true,
      runFailed: true,
      live: null,
    });
    expect(rows.at(-1)).toMatchObject({ id: 'delivery', status: 'failed' });
  });

  test('carries a negative tone through as a failed row mid-run', () => {
    const rows = projectTaskRows({
      timeline: timeline([
        { key: 'tools', title: 'Tool errored', tone: 'negative' },
        { key: 'delivery', title: 'Delivering', active: true },
      ]),
      runFinished: false,
      runFailed: false,
      live: null,
    });
    expect(rows[0]).toMatchObject({ status: 'failed' });
  });

  // Without a lens run there is no step data, so callers keep showing the
  // existing presence indicator rather than a lone synthetic row.
  test('yields nothing when presence is active but no run has synced', () => {
    expect(
      projectTaskRows({
        timeline: null,
        runFinished: false,
        runFailed: false,
        live: live('Thinking...'),
      })
    ).toEqual([]);
  });

  // The lens lags a live run by a sync round trip, so presence retitles the
  // in-flight row rather than appending a duplicate.
  test('presence retitles the in-flight row instead of adding one', () => {
    const rows = projectTaskRows({
      timeline: timeline([
        { key: 'context', title: 'Assembled context' },
        { key: 'tools', title: 'Using tools', active: true },
      ]),
      runFinished: false,
      runFailed: false,
      live: live('Checking the web'),
    });
    expect(rows).toHaveLength(2);
    expect(rows.at(-1)).toMatchObject({
      id: 'tools',
      title: 'Checking the web',
      status: 'running',
    });
  });

  test('appends a live row when the timeline has no active step', () => {
    const rows = projectTaskRows({
      timeline: timeline([{ key: 'context', title: 'Assembled context' }]),
      runFinished: false,
      runFailed: false,
      live: live('Thinking...'),
    });
    expect(rows).toHaveLength(2);
    expect(rows.at(-1)).toMatchObject({ id: 'live', status: 'running' });
  });

  // A finalized run is authoritative; a stale presence entry must not drag a
  // completed run back into looking active.
  test('a finished run ignores lingering presence', () => {
    const rows = projectTaskRows({
      timeline: timeline([
        { key: 'context', title: 'Assembled context' },
        { key: 'delivery', title: 'Delivered reply', active: true },
      ]),
      runFinished: true,
      runFailed: false,
      live: live('Thinking...'),
    });
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.status === 'running')).toBe(false);
  });

  test('maps detail and meta onto the row', () => {
    const rows = projectTaskRows({
      timeline: timeline([
        {
          key: 'context',
          title: 'Assembled context',
          detail: '3 messages',
          meta: 'ready',
        },
      ]),
      runFinished: false,
      runFailed: false,
      live: null,
    });
    expect(rows[0]).toMatchObject({
      meta: 'ready',
      details: [{ label: 'Detail', value: '3 messages' }],
    });
  });

  test('omits meta and details when the timeline has none', () => {
    const rows = projectTaskRows({
      timeline: timeline([{ key: 'context', title: 'Assembled context' }]),
      runFinished: false,
      runFailed: false,
      live: null,
    });
    expect(rows[0].meta).toBeUndefined();
    expect(rows[0].details).toBeUndefined();
  });
});

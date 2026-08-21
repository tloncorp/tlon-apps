import { describe, expect, it } from 'vitest';

import {
  type ContextLensActivity,
  type ContextLensActivityKind,
  hasContextLensActivityCardContent,
} from '../urbit/lens';

function activity(
  kind?: Exclude<ContextLensActivityKind, 'lifecycle' | 'plan'>
): ContextLensActivity {
  return {
    schemaVersion: 1,
    eventCount: kind ? 1 : 0,
    lastEventAt: kind ? 1 : null,
    truncated: false,
    plan: null,
    items: kind
      ? [
          {
            id: 'item-1',
            kind,
            title: 'Activity',
            status: 'running',
            startedAt: 1,
            updatedAt: 1,
            completedAt: null,
          },
        ]
      : [],
  };
}

describe('hasContextLensActivityCardContent', () => {
  it('stores plans but waits for user-visible work before qualifying', () => {
    const planned = activity();
    planned.plan = {
      updatedAt: 1,
      steps: [{ id: 'step-1', title: 'Do the work', status: 'running' }],
    };

    expect(hasContextLensActivityCardContent(planned)).toBe(false);
    planned.items = activity('commentary').items;
    expect(hasContextLensActivityCardContent(planned)).toBe(true);
  });

  it('qualifies user-facing commentary, actions, and requester input', () => {
    for (const kind of [
      'commentary',
      'tool',
      'approval',
      'request_input',
      'command',
      'patch',
      'error',
    ] as const) {
      expect(hasContextLensActivityCardContent(activity(kind))).toBe(true);
    }
  });

  it('does not qualify empty activity, generic items, or compaction', () => {
    expect(hasContextLensActivityCardContent(activity())).toBe(false);
    expect(hasContextLensActivityCardContent(activity('item'))).toBe(false);
    expect(hasContextLensActivityCardContent(activity('compaction'))).toBe(
      false
    );
    const planTool = activity('tool');
    planTool.items[0]!.name = 'update_plan';
    expect(hasContextLensActivityCardContent(planTool)).toBe(false);
  });
});

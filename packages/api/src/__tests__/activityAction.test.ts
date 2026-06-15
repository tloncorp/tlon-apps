import { afterEach, describe, expect, test } from 'vitest';

import { activityAction } from '../client/activityApi';
import { setActivitySupportsReactions } from '../client/urbit';
import type { ActivityAction } from '../urbit';

const volume = {
  post: { unreads: true, notify: true },
  react: { unreads: false, notify: true },
  'dm-react': { unreads: false, notify: true },
};

const adjustAction: ActivityAction = {
  adjust: { source: { base: null }, volume },
};

afterEach(() => setActivitySupportsReactions(false));

describe('activityAction mark gating', () => {
  test('uses the v9 mark and keeps react keys when supported', () => {
    setActivitySupportsReactions(true);
    const action = activityAction(adjustAction);
    expect(action.mark).toBe('activity-action-1');
    const sent = action.json as typeof adjustAction;
    expect(sent.adjust.volume).toHaveProperty('react');
    expect(sent.adjust.volume).toHaveProperty('dm-react');
  });

  test('uses the v8 mark and strips react keys when unsupported', () => {
    setActivitySupportsReactions(false);
    const action = activityAction(adjustAction);
    expect(action.mark).toBe('activity-action');
    const sent = action.json as typeof adjustAction;
    expect(sent.adjust.volume).not.toHaveProperty('react');
    expect(sent.adjust.volume).not.toHaveProperty('dm-react');
    // non-react keys are preserved
    expect(sent.adjust.volume).toHaveProperty('post');
    // does not mutate the caller's action
    expect(adjustAction.adjust.volume).toHaveProperty('react');
  });

  test('passes non-adjust actions through unchanged on the v8 mark', () => {
    setActivitySupportsReactions(false);
    const action = activityAction({ 'clear-group-invites': null });
    expect(action.mark).toBe('activity-action');
    expect(action.json).toEqual({ 'clear-group-invites': null });
  });
});

import { beforeEach, expect, test, vi } from 'vitest';

import { A2UI_ACTION_MARK, submitA2UIUserAction } from '../client/a2uiApi';
import { poke } from '../client/urbit';

vi.mock('../client/urbit', () => ({
  poke: vi.fn(async (params) => params),
}));

beforeEach(() => {
  vi.mocked(poke).mockClear();
});

test('submits A2UI user actions to the action host with context', async () => {
  const envelope = {
    userAction: {
      name: 'tlon.approval.approve',
      surfaceId: 'approval-card',
      sourceComponentId: 'approve',
      timestamp: '2026-05-07T15:00:00.000Z',
      context: { approvalId: 'approval-123' },
    },
  };
  const source = {
    postId: 'post-123',
    channelId: 'chat/~malmur-halmex/general',
    authorId: '~sampel-palnet',
    actionHostShip: '~sitrul-nacwyl',
  };

  await submitA2UIUserAction({ envelope, source });

  expect(A2UI_ACTION_MARK).toBe('a2ui-action');
  expect(poke).toHaveBeenCalledWith({
    ship: '~sitrul-nacwyl',
    app: 'a2ui',
    mark: 'a2ui-action',
    json: {
      ...envelope,
      tlonContext: source,
    },
  });
});

import type { PostBlobDataEntryActionButton } from '@tloncorp/api/lib/content-helpers';
import { expect, test, vi } from 'vitest';

import {
  actionButtonErrorMessage,
  fireActionButtonPoke,
} from './actionButtonPoke';

const actionButton: PostBlobDataEntryActionButton = {
  type: 'action-button',
  version: 1,
  label: 'Approve',
  pokeApp: 'permissions',
  pokeMark: 'json',
  pokeJson: { allow: true, requestId: 'req-123' },
};

test('fireActionButtonPoke sends the action-button payload through poke', async () => {
  const poke = vi.fn().mockResolvedValue(undefined);

  await fireActionButtonPoke(actionButton, poke);

  expect(poke).toHaveBeenCalledWith({
    app: 'permissions',
    mark: 'json',
    json: { allow: true, requestId: 'req-123' },
  });
});

test('actionButtonErrorMessage includes the underlying error when available', () => {
  expect(actionButtonErrorMessage(new Error('network down'))).toBe(
    'Failed to send action: network down'
  );
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getConfirmationMessage,
  handleBlockingAction,
} from '../blockingActions';
import { blockUser, unblockUser } from '../dmActions';
import { queryClient } from '../reactQuery';

// Mock dependencies
vi.mock('../dmActions');
vi.mock('../reactQuery', () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
  },
}));

describe('blockingLogic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleBlockingAction', () => {
    const userId = '~sampel-palnet';

    it('should unblock user when currently blocked', async () => {
      await handleBlockingAction(userId, true);

      expect(unblockUser).toHaveBeenCalledWith(userId);
      expect(blockUser).not.toHaveBeenCalled();
      expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
    });

    it('should block user when currently unblocked', async () => {
      await handleBlockingAction(userId, false);

      expect(blockUser).toHaveBeenCalledWith(userId);
      expect(unblockUser).not.toHaveBeenCalled();
      expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
    });
  });

  describe('getConfirmationMessage', () => {
    it('should return block message for blocking action', () => {
      const result = getConfirmationMessage(true);
      expect(result).toBe('Are you sure you want to block this user?');
    });

    it('should return unblock message for unblocking action', () => {
      const result = getConfirmationMessage(false);
      expect(result).toBe('Are you sure you want to unblock this user?');
    });
  });
});

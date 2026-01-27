import * as store from '@tloncorp/shared/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as navigationUtils from '../navigation/utils';
import * as ui from '../ui';
import { useGroupContext } from './useGroupContext';
import * as useCurrentUser from './useCurrentUser';

// Mock dependencies
vi.mock('@tloncorp/shared/store', () => ({
  useGroup: vi.fn(),
  SyncPriority: { High: 'high' },
}));

vi.mock('@tloncorp/shared', () => ({
  sync: {
    syncGroup: vi.fn(),
  },
  useUpdateChannel: vi.fn(() => vi.fn()),
}));

vi.mock('../navigation/utils', () => ({
  useNavigation: vi.fn(),
}));

vi.mock('../ui', () => ({
  useIsWindowNarrow: vi.fn(),
}));

vi.mock('./useCurrentUser', () => ({
  useCurrentUserId: vi.fn(),
}));

describe('useGroupContext - Navigation on Group Removal', () => {
  const mockNavigate = vi.fn();
  const mockReset = vi.fn();
  const mockCurrentUserId = '~test-user';
  const mockGroupId = '~host-user/test-group';

  const mockGroup = {
    id: mockGroupId,
    title: 'Test Group',
    members: [
      {
        contactId: mockCurrentUserId,
        roles: [{ roleId: 'member' }],
        status: 'joined',
      },
    ],
    channels: [],
    roles: [],
    navSections: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    (navigationUtils.useNavigation as any).mockReturnValue({
      navigate: mockNavigate,
      reset: mockReset,
    });
    
    (useCurrentUser.useCurrentUserId as any).mockReturnValue(mockCurrentUserId);
  });

  describe('Edge Case: Initial Load (Loading State)', () => {
    it('should NOT navigate when group is null on initial render (still loading)', () => {
      // First render: group is null (loading)
      (store.useGroup as any).mockReturnValue({ data: null });
      (ui.useIsWindowNarrow as any).mockReturnValue(true);

      const { result, rerender } = renderHook(() =>
        useGroupContext({ groupId: mockGroupId })
      );

      expect(result.current.group).toBeNull();
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockReset).not.toHaveBeenCalled();
    });
  });

  describe('Edge Case: Valid Group Loads After Initial Null', () => {
    it('should NOT navigate when group loads from null to valid', () => {
      // First render: group is null (loading)
      (store.useGroup as any).mockReturnValue({ data: null });
      (ui.useIsWindowNarrow as any).mockReturnValue(true);

      const { rerender } = renderHook(() =>
        useGroupContext({ groupId: mockGroupId })
      );

      // Second render: group loads
      (store.useGroup as any).mockReturnValue({ data: mockGroup });
      rerender();

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockReset).not.toHaveBeenCalled();
    });
  });

  describe('Edge Case: User is Kicked/Banned (Valid → Null)', () => {
    it('should navigate to ChatList on mobile when group becomes null after being valid', () => {
      // First render: group is valid
      (store.useGroup as any).mockReturnValue({ data: mockGroup });
      (ui.useIsWindowNarrow as any).mockReturnValue(true);

      const { rerender } = renderHook(() =>
        useGroupContext({ groupId: mockGroupId })
      );

      // Second render: user is kicked/banned, group becomes null
      (store.useGroup as any).mockReturnValue({ data: null });
      rerender();

      expect(mockNavigate).toHaveBeenCalledWith('ChatList');
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

    it('should reset navigation to Home on desktop when group becomes null after being valid', () => {
      // First render: group is valid
      (store.useGroup as any).mockReturnValue({ data: mockGroup });
      (ui.useIsWindowNarrow as any).mockReturnValue(false);

      const { rerender } = renderHook(() =>
        useGroupContext({ groupId: mockGroupId })
      );

      // Second render: user is kicked/banned, group becomes null
      (store.useGroup as any).mockReturnValue({ data: null });
      rerender();

      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Home' }],
      });
      expect(mockReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Case: Group Remains Null', () => {
    it('should NOT navigate multiple times if group stays null', () => {
      // First render: group is valid
      (store.useGroup as any).mockReturnValue({ data: mockGroup });
      (ui.useIsWindowNarrow as any).mockReturnValue(true);

      const { rerender } = renderHook(() =>
        useGroupContext({ groupId: mockGroupId })
      );

      // Second render: group becomes null (kicked)
      (store.useGroup as any).mockReturnValue({ data: null });
      rerender();

      expect(mockNavigate).toHaveBeenCalledTimes(1);

      // Third render: group still null
      rerender();

      // Should NOT navigate again
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Case: Group Changes Between Different Valid Groups', () => {
    it('should NOT navigate when switching between valid groups', () => {
      const otherGroup = { ...mockGroup, id: '~host-user/other-group' };

      // First render: first group
      (store.useGroup as any).mockReturnValue({ data: mockGroup });
      (ui.useIsWindowNarrow as any).mockReturnValue(true);

      const { rerender } = renderHook(() =>
        useGroupContext({ groupId: mockGroupId })
      );

      // Second render: switch to different valid group
      (store.useGroup as any).mockReturnValue({ data: otherGroup });
      rerender();

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockReset).not.toHaveBeenCalled();
    });
  });

  describe('Edge Case: Rapid Valid → Null → Valid Transition', () => {
    it('should handle rapid transitions correctly (simulating network blip)', () => {
      // First render: group is valid
      (store.useGroup as any).mockReturnValue({ data: mockGroup });
      (ui.useIsWindowNarrow as any).mockReturnValue(true);

      const { rerender } = renderHook(() =>
        useGroupContext({ groupId: mockGroupId })
      );

      // Second render: temporary null (network issue?)
      (store.useGroup as any).mockReturnValue({ data: null });
      rerender();

      // Should navigate
      expect(mockNavigate).toHaveBeenCalledTimes(1);

      // Third render: group comes back (false positive)
      (store.useGroup as any).mockReturnValue({ data: mockGroup });
      rerender();

      // Navigation was already triggered (this is acceptable behavior)
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Case: Multiple Hook Instances', () => {
    it('should handle navigation when multiple components use the same hook', () => {
      // Simulate two components rendering with the same group
      (store.useGroup as any).mockReturnValue({ data: mockGroup });
      (ui.useIsWindowNarrow as any).mockReturnValue(true);

      const { rerender: rerender1 } = renderHook(() =>
        useGroupContext({ groupId: mockGroupId })
      );
      const { rerender: rerender2 } = renderHook(() =>
        useGroupContext({ groupId: mockGroupId })
      );

      // Both see the group become null
      (store.useGroup as any).mockReturnValue({ data: null });
      rerender1();
      rerender2();

      // Both will call navigate (this is acceptable - navigation is idempotent)
      expect(mockNavigate).toHaveBeenCalledTimes(2);
      expect(mockNavigate).toHaveBeenCalledWith('ChatList');
    });
  });
});

// Helper to simulate renderHook from @testing-library/react-hooks
// This is a simplified version for Vitest
function renderHook<T>(callback: () => T) {
  let result: { current: T } = { current: undefined as any };
  let renderCount = 0;

  const TestComponent = () => {
    result.current = callback();
    renderCount++;
    return null;
  };

  // Mock React rendering
  const render = () => {
    TestComponent();
  };

  const rerender = () => {
    render();
  };

  // Initial render
  render();

  return {
    result,
    rerender,
    renderCount: () => renderCount,
  };
}

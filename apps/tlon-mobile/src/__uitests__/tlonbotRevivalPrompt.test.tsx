import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, cleanup, renderHook } from '@testing-library/react-native';
import { HostedNodeStatus } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';

import { useTlonbotRevivalPrompt } from '../components/TlonbotRevivalPromptSheet';
import type { NodeStatusCheckResult } from '../hooks/useCheckNodeStopped';

jest.mock('@tloncorp/app/contexts/ship', () => ({
  useShip: () => ({ authType: 'hosted' }),
}));
jest.mock('@tloncorp/app/ui', () => ({}));
jest.mock('@tloncorp/app/ui/hooks/useSheetCloseAfterAnimation', () => ({
  useSheetCloseAfterAnimation: () => ({}),
}));
jest.mock('@tloncorp/shared', () => ({
  HostedNodeStatus: { Running: 'running' },
  createDevLogger: () => ({ trackEvent: jest.fn() }),
}));
jest.mock('@tloncorp/shared/db', () => ({
  hostingBotEnabled: { getValue: jest.fn() },
}));
jest.mock('@tloncorp/shared/store', () => ({}));
jest.mock('@tloncorp/ui', () => ({}));

const revivalNode: NodeStatusCheckResult = {
  nodeStatus: HostedNodeStatus.Running,
  onboardingFlow: 'tlonbotRevival',
  didStopNode: false,
};

describe('Tlonbot revival prompt hosting auth', () => {
  beforeEach(() => {
    jest
      .mocked(db.hostingBotEnabled.getValue)
      .mockReset()
      .mockResolvedValue(false);
  });
  afterEach(cleanup);

  it('waits for the forced auth check and keeps the prompt closed on expiration', async () => {
    let finishAuthCheck!: (valid: boolean) => void;
    const requireHostingAuth = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishAuthCheck = resolve;
        })
    );
    const { result } = renderHook(() =>
      useTlonbotRevivalPrompt(requireHostingAuth)
    );

    const pending = result.current.maybeShowPrompt(revivalNode);
    expect(requireHostingAuth).toHaveBeenCalledWith({ force: true });
    expect(db.hostingBotEnabled.getValue).not.toHaveBeenCalled();
    expect(result.current.promptSheet.props.open).toBe(false);

    await act(async () => {
      finishAuthCheck(false);
      await pending;
    });
    expect(db.hostingBotEnabled.getValue).not.toHaveBeenCalled();
    expect(result.current.promptSheet.props.open).toBe(false);
  });

  it.each([false, true])(
    'uses the refreshed bot-enabled value (%s) after passing auth',
    async (botEnabled) => {
      const requireHostingAuth = jest.fn(async () => {
        jest
          .mocked(db.hostingBotEnabled.getValue)
          .mockResolvedValue(botEnabled);
        return true;
      });
      const { result } = renderHook(() =>
        useTlonbotRevivalPrompt(requireHostingAuth)
      );

      await act(async () => result.current.maybeShowPrompt(revivalNode));
      expect(requireHostingAuth).toHaveBeenCalledWith({ force: true });
      expect(db.hostingBotEnabled.getValue).toHaveBeenCalledTimes(1);
      expect(result.current.promptSheet.props.open).toBe(!botEnabled);
    }
  );

  it('does not force an auth check for a node without a revival prompt', async () => {
    const requireHostingAuth = jest.fn(async () => true);
    const { result } = renderHook(() =>
      useTlonbotRevivalPrompt(requireHostingAuth)
    );

    await act(async () =>
      result.current.maybeShowPrompt({
        ...revivalNode,
        onboardingFlow: undefined,
      })
    );
    expect(requireHostingAuth).not.toHaveBeenCalled();
    expect(db.hostingBotEnabled.getValue).not.toHaveBeenCalled();
    expect(result.current.promptSheet.props.open).toBe(false);
  });
});

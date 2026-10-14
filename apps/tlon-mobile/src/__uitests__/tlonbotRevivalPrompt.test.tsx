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
import * as store from '@tloncorp/shared/store';

import { useTlonbotRevivalPrompt } from '../components/TlonbotRevivalPromptSheet';
import type { NodeStatusCheckResult } from '../hooks/useCheckNodeStopped';

const mockStartSplashSequence = jest.fn(() => true);

jest.mock('@tloncorp/app/contexts/ship', () => ({
  useShip: () => ({
    ship: '~zod',
    shipUrl: 'https://zod.test',
    startSplashSequence: mockStartSplashSequence,
  }),
}));
jest.mock('@tloncorp/app/ui', () => ({}));
jest.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: {
    ErrorWayfinding: 'Error Wayfinding',
    InitiatedTlonbotRevival: 'Initiated Tlonbot Revival',
  },
  AnalyticsSeverity: { High: 'high' },
  HostedNodeStatus: { Running: 'running' },
  createDevLogger: () => ({ trackEvent: jest.fn() }),
}));
jest.mock('@tloncorp/shared/db', () => ({
  hostingBotEnabled: { getValue: jest.fn() },
}));
jest.mock('@tloncorp/shared/store', () => ({
  clearShipRevivalStatus: jest.fn(),
}));
jest.mock('@tloncorp/ui', () => ({ useIsWindowNarrow: () => true }));

const revivalNode: NodeStatusCheckResult = {
  nodeStatus: HostedNodeStatus.Running,
  onboardingFlow: 'tlonbotRevival',
  didStopNode: false,
};

describe('Tlonbot revival prompt hosting auth', () => {
  beforeEach(() => {
    mockStartSplashSequence.mockReset().mockReturnValue(true);
    jest
      .mocked(store.clearShipRevivalStatus)
      .mockReset()
      .mockResolvedValue(undefined);
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

  it('starts revival through the session-scoped splash update', async () => {
    const requireHostingAuth = jest.fn(async () => true);
    const { result } = renderHook(() =>
      useTlonbotRevivalPrompt(requireHostingAuth)
    );

    await act(async () => result.current.maybeShowPrompt(revivalNode));
    await act(async () => result.current.promptSheet.props.onStart());
    expect(result.current.promptSheet.props.open).toBe(false);
    expect(mockStartSplashSequence).not.toHaveBeenCalled();
    await act(async () => result.current.promptSheet.props.onNativeDismissed());
    await act(async () => result.current.promptSheet.props.onNativeDismissed());
    expect(mockStartSplashSequence).toHaveBeenCalledWith('tlonbotRevival');
    expect(store.clearShipRevivalStatus).toHaveBeenCalledTimes(1);
  });

  it('leaves revival status intact when the delayed session is stale', async () => {
    mockStartSplashSequence.mockReturnValue(false);
    const requireHostingAuth = jest.fn(async () => true);
    const { result } = renderHook(() =>
      useTlonbotRevivalPrompt(requireHostingAuth)
    );

    await act(async () => result.current.maybeShowPrompt(revivalNode));
    await act(async () => result.current.promptSheet.props.onStart());
    await act(async () => result.current.promptSheet.props.onNativeDismissed());

    expect(mockStartSplashSequence).toHaveBeenCalledWith('tlonbotRevival');
    expect(store.clearShipRevivalStatus).not.toHaveBeenCalled();
  });

  it('cancels revival when the prompt owner unmounts during dismissal', async () => {
    const { result, unmount } = renderHook(() =>
      useTlonbotRevivalPrompt(jest.fn(async () => true))
    );
    await act(async () => result.current.maybeShowPrompt(revivalNode));
    await act(async () => result.current.promptSheet.props.onStart());
    const complete = result.current.promptSheet.props.onNativeDismissed;
    unmount();
    await act(async () => complete());
    expect(mockStartSplashSequence).not.toHaveBeenCalled();
    expect(store.clearShipRevivalStatus).not.toHaveBeenCalled();
  });
});

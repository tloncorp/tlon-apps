import { trackEvent } from '@tloncorp/shared';
import { getPathFromState } from '@react-navigation/core';
import React, { useEffect } from 'react';
import { type ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { useA2UINavigation } from '../../hooks/useA2UINavigation';
import {
  BrowserCredentialHandoffProvider,
  useBrowserCredentialHandoff,
} from './BrowserCredentialHandoffProvider';

const { navigate, navigateToGroup } = vi.hoisted(() => ({
  navigate: vi.fn(),
  navigateToGroup: vi.fn(),
}));
vi.mock('../../navigation/utils', () => ({
  useRootNavigation: () => ({
    navigateToBrowserCredentialHandoff: navigate,
    navigateToGroup,
  }),
}));
vi.mock('@tloncorp/api/client', () => ({ getCanonicalPostId: vi.fn() }));
vi.mock('@tloncorp/shared', () => ({
  trackEvent: vi.fn(),
  AnalyticsEvent: { BrowserLifecycle: 'Browser Lifecycle' },
  createDevLogger: () => ({ log: vi.fn() }),
}));
vi.mock('@tloncorp/shared/db', () => ({}));
vi.mock('@tloncorp/shared/logic', () => ({}));

describe('browser handoff registry', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });
  it('renders navigation consumers without a registry and only requires it for trusted handoffs', async () => {
    let navigateA2UI!: ReturnType<typeof useA2UINavigation>;
    function Preview() {
      const navigateToTarget = useA2UINavigation();
      useEffect(() => {
        navigateA2UI = navigateToTarget;
      }, [navigateToTarget]);
      return null;
    }
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<Preview />);
    });
    await navigateA2UI({ type: 'group', groupId: '~zod/example' });
    expect(navigateToGroup).toHaveBeenCalledWith('~zod/example');
    const target = {
      type: 'screen',
      screen: 'browserCredentialHandoff',
      viewerUrl: 'https://browser-session.tlon.network/s/payload.signature',
    } as const;
    await expect(navigateA2UI(target)).resolves.toBeUndefined();
    await expect(
      navigateA2UI(target, { allowBrowserCredentialHandoff: true })
    ).rejects.toThrow('provider is unavailable');
    expect(navigate).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });
  it('keeps the capability out of linked navigation state and discards it on completion', async () => {
    let registry!: ReturnType<typeof useBrowserCredentialHandoff>;
    let navigateA2UI!: ReturnType<typeof useA2UINavigation>;
    function Consumer() {
      const value = useBrowserCredentialHandoff();
      const navigateToTarget = useA2UINavigation();
      useEffect(() => {
        registry = value;
        navigateA2UI = navigateToTarget;
      }, [value, navigateToTarget]);
      return null;
    }
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <BrowserCredentialHandoffProvider>
          <Consumer />
        </BrowserCredentialHandoffProvider>
      );
    });
    const viewerUrl =
      'https://browser-session.tlon.network/s/payload.signature';
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const target = {
      type: 'screen',
      screen: 'browserCredentialHandoff',
      viewerUrl,
    } as const;
    await navigateA2UI(target);
    expect(navigate).not.toHaveBeenCalled();
    await navigateA2UI(target, {
      allowBrowserCredentialHandoff: true,
      onBrowserCredentialHandoffComplete: onComplete,
    });
    const [handoffId] = navigate.mock.calls[0];
    expect(navigate).toHaveBeenCalledWith(expect.any(String));
    const state = {
      routes: [{ name: 'BrowserCredentialHandoff', params: { handoffId } }],
    };
    expect(getPathFromState(state)).toContain(handoffId);
    expect(JSON.stringify(state)).not.toContain(viewerUrl);
    expect(getPathFromState(state)).not.toContain('payload.signature');
    expect(registry.resolve(handoffId)).toBe(viewerUrl);
    vi.mocked(trackEvent).mockClear();
    registry.report(handoffId, { phase: 'form_opened', outcome: 'unknown' });
    registry.report(handoffId, { phase: 'form_opened', outcome: 'unknown' });
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(trackEvent).mock.calls)).not.toContain(
      viewerUrl
    );
    await registry.complete(handoffId);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(registry.resolve(handoffId)).toBeUndefined();
    act(() => renderer.unmount());
  });

  it('supports optional completion, retries, and dismissal', async () => {
    let registry!: ReturnType<typeof useBrowserCredentialHandoff>;
    function Consumer() {
      const value = useBrowserCredentialHandoff();
      useEffect(() => {
        registry = value;
      }, [value]);
      return null;
    }
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <BrowserCredentialHandoffProvider>
          <Consumer />
        </BrowserCredentialHandoffProvider>
      );
    });
    const viewerUrl =
      'https://browser-session.tlon.network/s/payload.signature';
    const onComplete = vi
      .fn()
      .mockRejectedValueOnce(new Error('Try again'))
      .mockResolvedValue(undefined);
    const id = registry.register({ viewerUrl, onComplete });
    await expect(registry.complete(id)).rejects.toThrow('Try again');
    expect(registry.resolve(id)).toBe(viewerUrl);
    await registry.complete(id);
    let rejectCompletion!: (error: Error) => void;
    const pendingId = registry.register({
      viewerUrl,
      onComplete: () =>
        new Promise<void>((_resolve, reject) => {
          rejectCompletion = reject;
        }),
    });
    const completion = registry.complete(pendingId);
    expect(registry.resolve(pendingId)).toBeUndefined();
    await expect(registry.complete(pendingId)).rejects.toThrow(
      'no longer available'
    );
    registry.discard(pendingId);
    rejectCompletion(new Error('Send failed after dismissal'));
    await expect(completion).rejects.toThrow('Send failed after dismissal');
    expect(registry.resolve(pendingId)).toBeUndefined();
    await expect(registry.complete(pendingId)).rejects.toThrow(
      'no longer available'
    );
    const noCallbackId = registry.register({ viewerUrl });
    await registry.complete(noCallbackId);
    expect(registry.resolve(noCallbackId)).toBeUndefined();
    const dismissedId = registry.register({ viewerUrl });
    registry.discard(dismissedId);
    expect(registry.resolve(dismissedId)).toBeUndefined();
    await expect(registry.complete(dismissedId)).rejects.toThrow(
      'no longer available'
    );
    act(() => renderer.unmount());
  });
});

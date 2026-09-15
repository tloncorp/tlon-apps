import { getPathFromState } from '@react-navigation/core';
import React, { useEffect } from 'react';
import { type ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { useA2UINavigation } from '../../hooks/useA2UINavigation';
import {
  BrowserCredentialHandoffProvider,
  useBrowserCredentialHandoff,
} from './BrowserCredentialHandoffProvider';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('../../navigation/utils', () => ({
  useRootNavigation: () => ({ navigateToBrowserCredentialHandoff: navigate }),
}));
vi.mock('@tloncorp/api/client', () => ({ getCanonicalPostId: vi.fn() }));
vi.mock('@tloncorp/shared', () => ({
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

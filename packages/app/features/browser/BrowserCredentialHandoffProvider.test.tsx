import React, { useEffect } from 'react';
import { type ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { useA2UINavigation } from '../../hooks/useA2UINavigation';
import { BrowserCredentialHandoffProvider } from './BrowserCredentialHandoffProvider';
import { useBrowserCredentialHandoff } from './BrowserCredentialHandoffContext';
import { BrowserCredentialHandoffSheet } from './BrowserCredentialHandoffSheet';
vi.mock('./BrowserCredentialHandoffSheet', () => ({
  BrowserCredentialHandoffSheet: 'BrowserCredentialHandoffSheet',
}));

const { navigateToGroup, platform, openWindow, showToast } = vi.hoisted(() => ({
  platform: { isWeb: false },
  showToast: vi.fn(),
  openWindow: vi.fn(),
  navigateToGroup: vi.fn(),
}));
vi.mock('./browserCredentialHandoff', async (original) => {
  const actual = await original<typeof import('./browserCredentialHandoff')>();
  return {
    ...actual,
    authorizeBrowserViewer: async (url: string) =>
      actual.trustedBrowserViewerUrl(url),
  };
});
vi.mock('@tloncorp/ui', () => ({ useToast: () => showToast }));
vi.mock('tamagui', () => ({
  get isWeb() {
    return platform.isWeb;
  },
}));
vi.mock('../../navigation/utils', () => ({
  useRootNavigation: () => ({
    navigateToGroup,
  }),
}));
vi.mock('@tloncorp/api/client', () => ({ getCanonicalPostId: vi.fn() }));
vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ log: vi.fn() }),
}));
vi.mock('@tloncorp/shared/db', () => ({}));
vi.mock('@tloncorp/shared/logic', () => ({}));
vi.mock('./BrowserViewerModal', () => ({ BrowserViewerModal: () => null }));

describe('browser handoff registry', () => {
  beforeEach(() => {
    platform.isWeb = false;
    showToast.mockClear();
    openWindow.mockClear();
    openWindow.mockReturnValue({
      opener: {},
      document: { write: vi.fn() },
      location: { replace: vi.fn() },
      close: vi.fn(),
      closed: false,
    });
    vi.stubGlobal('window', { open: openWindow });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens trusted session actions in a modal on web', async () => {
    platform.isWeb = true;
    let registry!: ReturnType<typeof useBrowserCredentialHandoff>;
    function Consumer() {
      const value = useBrowserCredentialHandoff();
      useEffect(() => {
        registry = value;
      }, [value]);
      return null;
    }
    const { BrowserViewerModal } = await import('./BrowserViewerModal');
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <BrowserCredentialHandoffProvider>
          <Consumer />
        </BrowserCredentialHandoffProvider>
      );
    });
    const url = 'https://browser-session.tlon.network/s/payload.signature';
    expect(registry.viewerOpen).toBe(false);
    await act(async () => registry.openViewer(url));
    expect(registry.viewerOpen).toBe(true);
    expect(openWindow).not.toHaveBeenCalled();
    const viewer = renderer.root.findByType(BrowserViewerModal);
    expect(viewer.props.viewerUrl).toBe(url);
    await act(async () => viewer.props.onClose());
    expect(renderer.root.findAllByType(BrowserViewerModal)).toHaveLength(0);
    expect(registry.viewerOpen).toBe(false);
    await expect(
      registry.openViewer('https://evil.example/s/payload.signature')
    ).rejects.toThrow('trusted');
    expect(openWindow).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });
  it('opens a separate session card directly, without form navigation or continuation', async () => {
    let navigateA2UI!: ReturnType<typeof useA2UINavigation>;
    function Consumer() {
      const navigateToTarget = useA2UINavigation();
      useEffect(() => {
        navigateA2UI = navigateToTarget;
      }, [navigateToTarget]);
      return null;
    }
    const { BrowserViewerModal } = await import('./BrowserViewerModal');
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <BrowserCredentialHandoffProvider>
          <Consumer />
        </BrowserCredentialHandoffProvider>
      );
    });
    const target = {
      type: 'screen',
      screen: 'browserSession',
      viewerUrl: 'https://browser-session.tlon.network/s/payload.signature',
    } as const;
    await act(async () => {
      await navigateA2UI(target, { allowBrowserCredentialHandoff: true });
    });
    expect(renderer.root.findAllByType(BrowserViewerModal)).toHaveLength(0);
    await act(async () => {
      await navigateA2UI(target, {
        allowBrowserSession: true,
      });
    });
    const viewer = renderer.root.findByType(BrowserViewerModal);
    expect(viewer.props.viewerUrl).toBe(target.viewerUrl);
    await act(async () => viewer.props.onClose());
    expect(renderer.root.findAllByType(BrowserViewerModal)).toHaveLength(0);

    await expect(
      navigateA2UI(
        {
          ...target,
          viewerUrl: 'https://attacker.example/s/payload.signature',
        },
        { allowBrowserSession: true }
      )
    ).rejects.toThrow('trusted');
    act(() => renderer.unmount());
  });

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
      screen: 'browserSecureEntry',
      viewerUrl: 'https://browser-session.tlon.network/s/payload.signature',
    } as const;
    await expect(navigateA2UI(target)).resolves.toBeUndefined();
    await expect(
      navigateA2UI(target, { allowBrowserCredentialHandoff: true })
    ).rejects.toThrow('provider is unavailable');
    act(() => renderer.unmount());
  });
  it.each([
    undefined,
    { record: { id: '8e40b5f5-fd41-4851-8922-b9545e470d6e', revision: 3 } },
  ])(
    'keeps the capability private and preserves approval intent (%j)',
    async (loginApproval) => {
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

      const target = {
        type: 'screen',
        screen: 'browserSecureEntry',
        viewerUrl,
        ...(loginApproval ? { loginApproval } : {}),
      } as const;
      await navigateA2UI(target);
      await act(async () =>
        navigateA2UI(target, {
          allowBrowserCredentialHandoff: true,
        })
      );
      const sheet = renderer.root.findByType(BrowserCredentialHandoffSheet);
      const handoffId = sheet.props.handoffId;
      expect(sheet.props.loginApproval).toEqual(loginApproval);
      expect(handoffId).not.toContain(viewerUrl);
      expect(handoffId).not.toContain('payload.signature');
      expect(registry.resolve(handoffId)).toBe(viewerUrl);
      registry.discard(handoffId);

      expect(registry.resolve(handoffId)).toBeUndefined();
      act(() => renderer.unmount());
    }
  );

  it('discards only the selected in-memory handoff', async () => {
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
    const firstId = registry.register({ viewerUrl });
    const secondId = registry.register({ viewerUrl });
    registry.discard(firstId);
    expect(registry.resolve(firstId)).toBeUndefined();
    expect(registry.resolve(secondId)).toBe(viewerUrl);
    registry.discard(secondId);
    expect(registry.resolve(secondId)).toBeUndefined();
    act(() => renderer.unmount());
  });
});

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { authorizeBrowserViewer } from './browserCredentialHandoff';
import { rememberBrowserPreview } from './browserPreviewCache';
import { BrowserVaultRequestError } from '@tloncorp/api/client/browserVault';
import { BrowserViewerModal } from './BrowserViewerModal';

vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ trackError: vi.fn() }),
}));
vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Icon: 'Icon',
  Pressable: 'Pressable',
  Text: 'Text',
}));
vi.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 1200, height: 900 }),
}));
vi.mock('./browserCredentialHandoff', () => ({
  trustedBrowserViewerUrl: (url: string) => url,
  authorizeBrowserViewer: vi.fn(async (url: string) => url),
}));
vi.mock('tamagui', () => ({
  Dialog: Object.assign(
    ({ children }: { children: React.ReactNode }) => <>{children}</>,
    {
      Portal: 'Portal',
      Overlay: 'Overlay',
      Content: 'Content',
      Title: 'Title',
    }
  ),
  VisuallyHidden: 'VisuallyHidden',
  YStack: 'YStack',
  Spinner: 'Spinner',
}));
vi.mock('./browserPreviewCache', () => ({
  browserPreviewCache: { useValue: () => ({}) },
  isBrowserEnded: (status: string) => ['ended', 'expired'].includes(status),
  rememberBrowserPreview: vi.fn(),
}));
const origin = 'https://browser-session.tlon.network';
let renderer: ReactTestRenderer;
let listener: (event: unknown) => void;
let contentWindow: { postMessage: ReturnType<typeof vi.fn> };
let onClose: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('window', {
    addEventListener: (_: string, handler: typeof listener) => {
      listener = handler;
    },
    removeEventListener: vi.fn(),
  });
  contentWindow = { postMessage: vi.fn() };
  onClose = vi.fn();
  act(() => {
    renderer = create(
      <BrowserViewerModal viewerUrl={`${origin}/s/test`} onClose={onClose} />,
      {
        createNodeMock: (element) =>
          element.type === 'iframe' ? { contentWindow } : null,
      }
    );
  });
});
afterEach(() => {
  act(() => renderer.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function message(
  data: object,
  source: unknown = contentWindow,
  senderOrigin = origin
) {
  act(() => listener({ data, source, origin: senderOrigin }));
}
function close() {
  act(() =>
    renderer.root.findByProps({ 'aria-label': 'Close browser' }).props.onPress()
  );
}
it('has only an accessible hidden title, and hands back before dismissing', () => {
  expect(renderer.root.findAllByType('Text' as never)).toHaveLength(0);
  act(() => renderer.root.findByType('iframe').props.onLoad());
  expect(contentWindow.postMessage).toHaveBeenCalledWith(
    { type: 'tlon.browser.status' },
    origin
  );
  message({ type: 'tlon.browser.ready', closeSupported: true });
  close();
  expect(contentWindow.postMessage).toHaveBeenCalledWith(
    { type: 'tlon.browser.close' },
    origin
  );
  expect(onClose).not.toHaveBeenCalled();
  message({ type: 'tlon.browser.closed', ok: true }, {});
  message(
    { type: 'tlon.browser.closed', ok: true },
    contentWindow,
    'https://other.example'
  );
  expect(onClose).not.toHaveBeenCalled();
  message({ type: 'tlon.browser.closed', ok: true });
  expect(onClose).toHaveBeenCalledOnce();
});
it('keeps the modal open after handback failure or timeout and allows retry', () => {
  message({ type: 'tlon.browser.ready', closeSupported: true });
  close();
  message({ type: 'tlon.browser.closed', ok: false });
  expect(onClose).not.toHaveBeenCalled();
  expect(renderer.root.findByProps({ role: 'alert' })).toBeTruthy();
  close();
  act(() => {
    vi.advanceTimersByTime(10000);
  });
  expect(onClose).not.toHaveBeenCalled();
  close();
  message({ type: 'tlon.browser.closed', ok: true });
  expect(onClose).toHaveBeenCalledOnce();
});
it('keeps existing unmount cleanup for viewers without the close bridge', () => {
  close();
  expect(onClose).toHaveBeenCalledOnce();
});

it('replaces the failed iframe with a proper ended state', () => {
  message({ type: 'tlon.browser.unavailable', status: 410 });
  expect(renderer.root.findAllByType('iframe')).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Ask your bot to open a new browser.'
  );
  expect(renderer.root.findAllByProps({ label: 'Try again' })).toHaveLength(0);
});
it('allows retry for a temporary viewer failure', async () => {
  message({ type: 'tlon.browser.unavailable', status: 502 });
  expect(renderer.root.findAllByType('iframe')).toHaveLength(0);
  await act(async () =>
    renderer.root.findByProps({ label: 'Try again' }).props.onPress()
  );
  expect(renderer.root.findAllByType('iframe')).toHaveLength(1);
});

it('closes immediately after an input-capable viewer has failed', () => {
  message({ type: 'tlon.browser.ready', closeSupported: true });
  message({ type: 'tlon.browser.unavailable', status: 410 });
  close();
  expect(onClose).toHaveBeenCalledOnce();
  expect(contentWindow.postMessage).not.toHaveBeenCalled();
  act(() => {
    vi.advanceTimersByTime(10000);
  });
  expect(renderer.root.findAllByProps({ role: 'alert' })).toHaveLength(0);
});
it('finishes a pending close when the viewer becomes unavailable', () => {
  message({ type: 'tlon.browser.ready', closeSupported: true });
  close();
  message({ type: 'tlon.browser.unavailable', status: 502 });
  expect(onClose).toHaveBeenCalledOnce();
  act(() => {
    vi.advanceTimersByTime(10000);
  });
  expect(renderer.root.findAllByProps({ role: 'alert' })).toHaveLength(0);
});
it('can close after the iframe load fails without an unavailable message', () => {
  message({ type: 'tlon.browser.ready', closeSupported: true });
  act(() => renderer.root.findByType('iframe').props.onError());
  close();
  expect(onClose).toHaveBeenCalledOnce();
  act(() => {
    vi.advanceTimersByTime(10000);
  });
  expect(renderer.root.findAllByProps({ role: 'alert' })).toHaveLength(0);
});

it.each([401, 403])(
  'reauthorizes viewer HTTP %s instead of expiring the card',
  async (status) => {
    message({ type: 'tlon.browser.unavailable', status });
    expect(rememberBrowserPreview).toHaveBeenLastCalledWith(
      `${origin}/s/test`,
      { status: 'unavailable' }
    );
    vi.mocked(authorizeBrowserViewer).mockResolvedValueOnce(
      `${origin}/s/renewed`
    );
    await act(async () =>
      renderer.root.findByProps({ label: 'Try again' }).props.onPress()
    );
    expect(authorizeBrowserViewer).toHaveBeenCalledWith(
      `${origin}/s/test`,
      expect.any(AbortSignal)
    );
    expect(renderer.root.findByType('iframe').props.src).toContain(
      '/s/renewed'
    );
  }
);
it('records expiry only when authorization confirms the original link expired', async () => {
  message({ type: 'tlon.browser.unavailable', status: 401 });
  vi.mocked(authorizeBrowserViewer).mockRejectedValueOnce(
    new BrowserVaultRequestError(401)
  );
  await act(async () =>
    renderer.root.findByProps({ label: 'Try again' }).props.onPress()
  );
  expect(rememberBrowserPreview).toHaveBeenLastCalledWith(`${origin}/s/test`, {
    status: 'expired',
  });
  expect(renderer.root.findAllByProps({ label: 'Try again' })).toHaveLength(0);
});

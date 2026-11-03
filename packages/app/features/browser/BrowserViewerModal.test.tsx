import React from 'react';
import { Alert, Modal } from 'react-native';
import { WebView } from 'react-native-webview';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BrowserViewerModal } from './BrowserViewerModal.native';

vi.mock('expo-clipboard', () => ({ getStringAsync: vi.fn() }));
vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Text: 'Text',
  Icon: 'Icon',
}));
vi.mock('../../ui/components/GlassSurface', () => ({
  GlassSurface: 'GlassSurface',
  supportsLiquidGlass: () => true,
}));
vi.mock('react-native', () => ({
  Modal: 'Modal',
  Alert: { alert: vi.fn() },
  Pressable: 'Pressable',
  Keyboard: {
    addListener: vi.fn(() => ({ remove: vi.fn() })),
    dismiss: vi.fn(),
  },
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'ios' },
}));
vi.mock('react-native-webview', () => ({ WebView: 'WebView' }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));
vi.mock('tamagui', () => ({
  useThemeName: () => 'light',
  useTheme: () => ({
    background: { val: '#fff' },
    primaryText: { val: '#000' },
  }),
  Spinner: 'Spinner',
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
}));
const viewerUrl = 'https://browser-session.tlon.network/s/payload.signature';

function render(url = viewerUrl) {
  const onClose = vi.fn();
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<BrowserViewerModal viewerUrl={url} onClose={onClose} />);
  });
  return { renderer, onClose };
}

describe('native live browser modal', () => {
  beforeAll(() => {
    vi.stubGlobal('__DEV__', true);
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    vi.unstubAllGlobals();
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  it('replaces a failed viewer with a safe error and retries with a fresh WebView', () => {
    const { renderer } = render();
    const original = renderer.root.findByType(WebView);
    act(() =>
      original.props.onHttpError({
        nativeEvent: { url: viewerUrl, statusCode: 401 },
      })
    );
    expect(renderer.root.findAllByType(WebView)).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain(
      'share a fresh session'
    );
    expect(JSON.stringify(renderer.toJSON())).not.toContain(
      'payload.signature'
    );
    act(() =>
      renderer.root.findByProps({ label: 'Try again' }).props.onPress()
    );
    const retry = renderer.root.findByType(WebView);
    expect(retry).not.toBe(original);
    act(() => retry.props.onLoad());
    expect(JSON.stringify(renderer.toJSON())).not.toContain(
      'Loading live browser'
    );
    act(() => renderer.unmount());
  });

  it('ignores subresource HTTP errors', () => {
    const { renderer } = render();
    const original = renderer.root.findByType(WebView);
    act(() =>
      original.props.onHttpError({
        nativeEvent: {
          url: 'https://browser-session.tlon.network/favicon.ico',
          statusCode: 404,
        },
      })
    );
    expect(renderer.root.findByType(WebView)).toBe(original);
    act(() => renderer.unmount());
  });

  it('dismisses with the close button and Android back action', async () => {
    const { renderer, onClose } = render();
    await act(async () =>
      renderer.root.findByType(Modal).props.onRequestClose()
    );
    expect(onClose).toHaveBeenCalledOnce();
    await act(async () =>
      renderer.root
        .findByProps({ accessibilityLabel: 'Close browser' })
        .props.onPress()
    );
    expect(onClose).toHaveBeenCalledTimes(2);
    act(() => renderer.unmount());
  });
  it('shows takeover without native input controls and waits for confirmed handback before closing', async () => {
    vi.stubEnv(
      'EXPO_PUBLIC_BROWSER_VIEWER_DEV_ORIGIN',
      'http://127.0.0.1:43841'
    );
    const url = 'http://127.0.0.1:43841/s/payload.signature';
    const { renderer, onClose } = render(url);
    const view = renderer.root.findByType(WebView);
    const message = (data: object) =>
      act(() =>
        view.props.onMessage({
          nativeEvent: { url, data: JSON.stringify(data) },
        })
      );
    const status = (ready: boolean) =>
      message({
        type: 'tlon.browser.input',
        version: 1,
        context: 1,
        ready,
        keyboardOpen: false,
        nativeControl: true,
        canTakeControl: true,
      });
    status(false);
    expect(
      renderer.root.findAllByProps({ label: 'Take control' })
    ).toHaveLength(1);
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: 'Keyboard' })
    ).toHaveLength(0);
    status(true);
    expect(
      renderer.root.findAllByProps({ label: 'Take control' })
    ).toHaveLength(0);
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: 'Keyboard' })
    ).toHaveLength(0);
    let closing!: Promise<void>;
    act(() => {
      closing = renderer.root.findByType(Modal).props.onRequestClose();
    });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      message({ type: 'tlon.browser.closed', ok: false });
      await closing;
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalled();
    act(() => {
      closing = renderer.root.findByType(Modal).props.onRequestClose();
    });
    await act(async () => {
      message({ type: 'tlon.browser.closed', ok: true });
      await closing;
    });
    expect(onClose).toHaveBeenCalledOnce();
    act(() => renderer.unmount());
    vi.unstubAllEnvs();
  });
});

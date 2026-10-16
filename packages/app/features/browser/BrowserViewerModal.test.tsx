import React from 'react';
import { Modal } from 'react-native';
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

function render() {
  const onClose = vi.fn();
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <BrowserViewerModal viewerUrl={viewerUrl} onClose={onClose} />
    );
  });
  return { renderer, onClose };
}

describe('native live browser modal', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
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

  it('dismisses with the close button and Android back action', () => {
    const { renderer, onClose } = render();
    act(() => renderer.root.findByType(Modal).props.onRequestClose());
    expect(onClose).toHaveBeenCalledOnce();
    act(() =>
      renderer.root
        .findByProps({ accessibilityLabel: 'Close browser' })
        .props.onPress()
    );
    expect(onClose).toHaveBeenCalledTimes(2);
    act(() => renderer.unmount());
  });
});

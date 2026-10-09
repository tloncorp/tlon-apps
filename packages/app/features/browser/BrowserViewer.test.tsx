import React from 'react';
import { Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BrowserViewer as NativeBrowserViewer } from './BrowserViewer.native';

vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Text: 'Text',
  Icon: 'Icon',
}));
vi.mock('../../ui/components/GlassSurface', () => ({
  GlassSurface: 'GlassSurface',
  supportsLiquidGlass: () => true,
}));
vi.mock('tamagui', () => ({
  useThemeName: () => 'light',
  useTheme: () => ({
    background: { val: '#fff' },
    primaryText: { val: '#000' },
  }),
  XStack: 'XStack',
  YStack: 'YStack',
}));
vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  Alert: { alert: vi.fn() },
  Keyboard: {
    addListener: vi.fn(() => ({ remove: vi.fn() })),
    dismiss: vi.fn(),
  },
}));
const { getStringAsync, injectJavaScript } = vi.hoisted(() => ({
  getStringAsync: vi.fn(),
  injectJavaScript: vi.fn(),
}));
vi.mock('expo-clipboard', () => ({ getStringAsync }));
vi.mock('react-native-webview', () => ({ WebView: 'WebView' }));
const viewerUrl =
  'https://browser-session.tlon.network/s/payload.signature?clipboardBridge=true';

describe('embedded browser boundaries', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  it('resynchronizes the retained viewer when React reconnects effects', () => {
    injectJavaScript.mockClear();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <React.StrictMode>
          <NativeBrowserViewer
            viewerUrl={viewerUrl}
            onLoad={vi.fn()}
            onError={vi.fn()}
          />
        </React.StrictMode>,
        {
          createNodeMock: (node) =>
            node.type === 'WebView' ? { injectJavaScript } : null,
        }
      );
    });
    // Strict Mode replays effect cleanup/setup while retaining the view, just
    // like Fast Refresh. The viewer must be asked to restore its control state.
    expect(injectJavaScript).toHaveBeenCalledWith(
      expect.stringContaining('"type":"status"')
    );
    act(() => renderer.unmount());
  });

  it('keeps native navigation in the viewer without sharing app cookies', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <NativeBrowserViewer
          viewerUrl={viewerUrl}
          onLoad={vi.fn()}
          onError={vi.fn()}
        />
      );
    });
    const view = renderer.root.findByType(WebView);
    expect(view.props.incognito).toBe(true);
    expect(view.props.sharedCookiesEnabled).toBe(false);
    const navigate = view.props.onShouldStartLoadWithRequest;
    expect(navigate({ url: viewerUrl })).toBe(true);
    for (const url of [
      'https://evil.example',
      'tel:123',
      'file:///private',
      'https://browser-session.tlon.network/s/other.signature',
    ]) {
      expect(navigate({ url })).toBe(false);
    }
    act(() => renderer.unmount());
  });
  it('sends the safe area and control footprint once the viewer is loaded', () => {
    injectJavaScript.mockClear();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <NativeBrowserViewer
          viewerUrl={viewerUrl}
          topInset={62}
          bottomInset={34}
          onLoad={vi.fn()}
          onError={vi.fn()}
        />,
        {
          createNodeMock: (node) =>
            node.type === 'WebView' ? { injectJavaScript } : null,
        }
      );
    });
    act(() => renderer.root.findByType(WebView).props.onLoad());
    const receive = vi.fn();
    new Function('window', injectJavaScript.mock.lastCall?.[0])({
      tlonBrowserInput: { receive },
    });
    expect(receive).toHaveBeenCalledWith({
      version: 1,
      type: 'insets',
      top: 130,
      bottom: 114,
      keyboardBottom: 80,
    });
    act(() => renderer.unmount());
  });
  it('accepts status only from this viewer and reads clipboard only on Paste', async () => {
    injectJavaScript.mockClear();
    getStringAsync.mockReset();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <NativeBrowserViewer
          viewerUrl={viewerUrl}
          onLoad={vi.fn()}
          onError={vi.fn()}
        />,
        {
          createNodeMock: (node) =>
            node.type === 'WebView'
              ? { injectJavaScript, requestFocus: vi.fn() }
              : null,
        }
      );
    });
    const view = renderer.root.findByType(WebView);
    const status = (fields = {}, url = viewerUrl) =>
      act(() =>
        view.props.onMessage({
          nativeEvent: {
            url,
            data: JSON.stringify({
              type: 'tlon.browser.input',
              version: 1,
              ready: true,
              keyboardOpen: false,
              context: 2,
              ...fields,
            }),
          },
        })
      );
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Paste' }).props.disabled
    ).toBe(true);
    status({}, 'https://evil.example');
    status({ version: 2 });
    status({ context: '2' });
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Paste' }).props.disabled
    ).toBe(true);
    expect(getStringAsync).not.toHaveBeenCalled();
    status();
    act(() =>
      renderer.root
        .findByProps({ accessibilityLabel: 'Keyboard' })
        .props.onPress()
    );
    expect(injectJavaScript.mock.lastCall?.[0]).toContain(
      '"type":"keyboard","open":true,"context":2'
    );
    status({ keyboardOpen: true });
    act(() =>
      renderer.root
        .findByProps({ accessibilityLabel: 'Hide keyboard' })
        .props.onPress()
    );
    expect(injectJavaScript.mock.lastCall?.[0]).toContain('"open":false');
    getStringAsync.mockResolvedValue('emoji 🌈 " </script>');
    await act(async () =>
      renderer.root.findByProps({ accessibilityLabel: 'Paste' }).props.onPress()
    );
    expect(getStringAsync).toHaveBeenCalledOnce();
    const script = injectJavaScript.mock.lastCall?.[0];
    const receive = vi.fn();
    // Evaluate exactly what the WebView receives, ensuring clipboard stays data.
    new Function('window', script)({ tlonBrowserInput: { receive } });
    expect(receive).toHaveBeenCalledWith({
      version: 1,
      type: 'paste',
      context: 2,
      text: 'emoji 🌈 " </script>',
    });
    act(() => renderer.unmount());
  });

  it('switches layouts from the native menu and confirms reload using current control', () => {
    injectJavaScript.mockClear();
    vi.mocked(Alert.alert).mockClear();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <NativeBrowserViewer
          viewerUrl={viewerUrl}
          onLoad={vi.fn()}
          onError={vi.fn()}
        />,
        {
          createNodeMock: (node) =>
            node.type === 'WebView' ? { injectJavaScript } : null,
        }
      );
    });
    const view = renderer.root.findByType(WebView);
    const status = (fields = {}) =>
      act(() =>
        view.props.onMessage({
          nativeEvent: {
            url: viewerUrl,
            data: JSON.stringify({
              type: 'tlon.browser.input',
              version: 1,
              ready: true,
              keyboardOpen: false,
              context: 2,
              mode: 'agent',
              reloadRequired: null,
              ...fields,
            }),
          },
        })
      );
    status();
    act(() =>
      renderer.root
        .findByProps({ accessibilityLabel: 'Browser options' })
        .props.onPress()
    );
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Agent View' }).props
        .accessibilityState.selected
    ).toBe(true);
    act(() =>
      renderer.root
        .findByProps({ accessibilityLabel: 'Mobile View' })
        .props.onPress()
    );
    expect(injectJavaScript.mock.lastCall?.[0]).toContain(
      '"type":"layout","mode":"mobile","context":2'
    );
    status({ ready: false, context: 3, reloadRequired: 'mobile' });
    status({ ready: true, context: 4, reloadRequired: 'mobile' });
    expect(Alert.alert).toHaveBeenCalledOnce();
    act(() =>
      vi
        .mocked(Alert.alert)
        .mock.lastCall?.[2]?.find((item) => item.text === 'Reload')
        ?.onPress?.()
    );
    expect(injectJavaScript.mock.lastCall?.[0]).toContain(
      '"mode":"mobile","reload":true,"context":4'
    );
    status({ mode: 'mobile', context: 5 });
    act(() =>
      renderer.root
        .findByProps({ accessibilityLabel: 'Browser options' })
        .props.onPress()
    );
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Mobile View' }).props
        .accessibilityState.selected
    ).toBe(true);
    act(() => renderer.unmount());
  });

  it('toggles browser controls only when supported and waits for viewer confirmation', () => {
    injectJavaScript.mockClear();
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(
        <NativeBrowserViewer
          viewerUrl={viewerUrl}
          onLoad={vi.fn()}
          onError={vi.fn()}
        />,
        {
          createNodeMock: (node) =>
            node.type === 'WebView' ? { injectJavaScript } : null,
        }
      );
    });
    const status = (fields = {}) =>
      act(() =>
        renderer.root.findByType(WebView).props.onMessage({
          nativeEvent: {
            url: viewerUrl,
            data: JSON.stringify({
              type: 'tlon.browser.input',
              version: 1,
              ready: true,
              keyboardOpen: false,
              context: 1,
              mode: 'agent',
              ...fields,
            }),
          },
        })
      );
    // Open the Android/fallback menu to exercise the actual control callbacks.
    act(() =>
      renderer.root
        .findByProps({ accessibilityLabel: 'Browser options' })
        .props.onPress()
    );
    const toggle = () =>
      renderer.root.findByProps({
        accessibilityLabel: 'Show browser controls',
      });
    status();
    expect(toggle().props.disabled).toBe(true);
    status({ browserControlsVisible: 'yes' });
    expect(toggle().props.disabled).toBe(true);
    status({ browserControlsVisible: false });
    expect(toggle().props.disabled).toBe(false);
    act(() => toggle().props.onPress());
    expect(injectJavaScript.mock.lastCall?.[0]).toContain(
      '"type":"browserControls","visible":true'
    );
    act(() =>
      renderer.root
        .findByProps({ accessibilityLabel: 'Browser options' })
        .props.onPress()
    );
    expect(toggle().props.accessibilityState.checked).toBe(false);
    status({ browserControlsVisible: true });
    expect(toggle().props.accessibilityState.checked).toBe(true);
    act(() => toggle().props.onPress());
    expect(injectJavaScript.mock.lastCall?.[0]).toContain('"visible":false');
    act(() => renderer.unmount());
  });

  it('discards pending clipboard reads after control changes, reload or close', async () => {
    for (const transition of ['control', 'reload', 'close']) {
      injectJavaScript.mockClear();
      let resolve!: (value: string) => void;
      getStringAsync.mockImplementation(
        () =>
          new Promise<string>((done) => {
            resolve = done;
          })
      );
      let renderer!: ReactTestRenderer;
      act(() => {
        renderer = create(
          <NativeBrowserViewer
            viewerUrl={viewerUrl}
            onLoad={vi.fn()}
            onError={vi.fn()}
          />,
          {
            createNodeMock: (node) =>
              node.type === 'WebView'
                ? { injectJavaScript, requestFocus: vi.fn() }
                : null,
          }
        );
      });
      const view = renderer.root.findByType(WebView);
      const status = (context: number) =>
        view.props.onMessage({
          nativeEvent: {
            url: viewerUrl,
            data: JSON.stringify({
              type: 'tlon.browser.input',
              version: 1,
              ready: true,
              keyboardOpen: false,
              context,
            }),
          },
        });
      act(() => status(1));
      let pending!: Promise<void>;
      act(() => {
        pending = renderer.root
          .findByProps({ accessibilityLabel: 'Paste' })
          .props.onPress();
      });
      act(() => {
        if (transition === 'control') status(2);
        else if (transition === 'reload') view.props.onLoadStart();
        else renderer.unmount();
      });
      await act(async () => {
        resolve('sensitive clipboard');
        await pending;
      });
      expect(injectJavaScript).not.toHaveBeenCalled();
      if (transition !== 'close') act(() => renderer.unmount());
    }
  });
  it('reports empty, denied, and oversized clipboard reads without sending text', async () => {
    for (const [text, expected] of [
      ['', 'No text to paste.'],
      [null, 'Could not read the clipboard.'],
      ['x'.repeat(100001), 'That text is too long.'],
    ]) {
      injectJavaScript.mockClear();
      if (text === null) getStringAsync.mockRejectedValue(new Error('Denied'));
      else getStringAsync.mockResolvedValue(text);
      let renderer!: ReactTestRenderer;
      act(() => {
        renderer = create(
          <NativeBrowserViewer
            viewerUrl={viewerUrl}
            onLoad={vi.fn()}
            onError={vi.fn()}
          />,
          {
            createNodeMock: (node) =>
              node.type === 'WebView'
                ? { injectJavaScript, requestFocus: vi.fn() }
                : null,
          }
        );
      });
      act(() =>
        renderer.root.findByType(WebView).props.onMessage({
          nativeEvent: {
            url: viewerUrl,
            data: JSON.stringify({
              type: 'tlon.browser.input',
              version: 1,
              ready: true,
              keyboardOpen: false,
              context: 1,
            }),
          },
        })
      );
      await act(async () =>
        renderer.root
          .findByProps({ accessibilityLabel: 'Paste' })
          .props.onPress()
      );
      expect(injectJavaScript).not.toHaveBeenCalled();
      expect(JSON.stringify(renderer.toJSON())).toContain(expected);
      expect(
        renderer.root.findByProps({ accessibilityLabel: 'Paste' }).props
          .disabled
      ).toBe(false);
      act(() => renderer.unmount());
    }
  });
});

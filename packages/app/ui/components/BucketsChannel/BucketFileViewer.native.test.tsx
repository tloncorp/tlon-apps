import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScreenHeader } from '../ScreenHeader';
import { BucketFileViewer } from './BucketFileViewer.native';
import {
  type BucketFileViewerItem,
  HTML_PREVIEW_LINK_MESSAGE,
  HTML_PREVIEW_POLICY,
} from './BucketFileViewer.shared';

const mocks = vi.hoisted(() => ({
  openURL: vi.fn(() => Promise.resolve(true)),
  platform: { OS: 'ios' as string },
}));

vi.mock('react-native', () => ({
  Linking: { openURL: mocks.openURL },
  Platform: mocks.platform,
}));

vi.mock('react-native-webview', () => ({ WebView: 'WebView' }));

vi.mock('expo-video', () => ({
  VideoView: 'VideoView',
  useVideoPlayer: () => null,
}));

vi.mock('../../../hooks/useWebview', () => ({ useWebView: () => null }));

vi.mock('@tloncorp/ui', () => {
  const FilePreview = () => null;
  FilePreview.fileExtensionFrom = () => null;
  return { FilePreview, Image: 'Image', Pressable: 'Pressable', Text: 'Text' };
});

vi.mock('tamagui', () => ({
  ScrollView: 'ScrollView',
  Spinner: 'Spinner',
  View: 'View',
  YStack: 'YStack',
}));

vi.mock('../ScreenHeader', () => {
  const ScreenHeader = () => null;
  ScreenHeader.TextButton = () => null;
  return { ScreenHeader };
});

const htmlFile: BucketFileViewerItem = {
  name: 'report.html',
  mimeType: 'text/html',
  sizeLabel: '4 KB',
  textContent:
    '<!doctype html><title>Quarterly numbers</title><p>Quarterly numbers</p>',
  uri: 'https://storage.example/signed-read-url',
};

function render(item: BucketFileViewerItem = htmlFile) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<BucketFileViewer item={item} onClose={() => {}} />);
  });
  return renderer;
}

function renderWebView(item: BucketFileViewerItem = htmlFile) {
  return render(item).root.findByType('WebView' as never);
}

afterEach(() => {
  mocks.platform.OS = 'ios';
  mocks.openURL.mockClear();
});

// The token the shell was rendered with, as the shell's own script carries it.
function shellToken(html: string): string {
  const token = html.match(/token: '([0-9a-f]{32})'/)?.[1];
  if (!token) throw new Error('no token in the shell');
  return token;
}

function linkMessage(fields: Record<string, unknown>) {
  return {
    nativeEvent: {
      data: JSON.stringify({ type: HTML_PREVIEW_LINK_MESSAGE, ...fields }),
    },
  };
}

describe('BucketFileViewer html preview (native)', () => {
  // The WebView loads a shell of ours that carries the policy; the file sits
  // in a sandboxed frame inside it and inherits that policy.
  it('loads the file inside the shell, sandboxed and under the policy, not from its URL', () => {
    const { props } = renderWebView();
    expect(props.source.uri).toBeUndefined();
    const shell: string = props.source.html;
    expect(shell).toContain(
      `<meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_POLICY}">`
    );
    expect(shell).toContain('<iframe sandbox="allow-scripts" srcdoc="');
    expect(shell).toContain('&lt;p&gt;Quarterly numbers&lt;/p&gt;');
  });

  it('names the page by its title, with the file beneath', () => {
    const header = render().root.findByType(ScreenHeader);
    expect(header.props.title).toBe('Quarterly numbers');
    expect(header.props.subtitle).toBe('report.html · 4 KB');
  });

  // These props are the isolation: a change to any of them is a decision.
  it('keeps the document apart from the app on iOS', () => {
    const { props } = renderWebView();
    expect(props.javaScriptEnabled).toBe(true);
    expect(props.incognito).toBe(true);
    expect(props.sharedCookiesEnabled).toBe(false);
    expect(props.thirdPartyCookiesEnabled).toBe(false);
    expect(props.setSupportMultipleWindows).toBe(false);
    expect(props.originWhitelist).toEqual(['*']);
  });

  // incognito on Android clears the cookie jar the whole app shares.
  it('keeps the shared cookie jar intact on Android', () => {
    mocks.platform.OS = 'android';
    const { props } = renderWebView();
    expect(props.incognito).toBe(false);
    expect(props.javaScriptEnabled).toBe(true);
    expect(props.sharedCookiesEnabled).toBe(false);
    expect(props.originWhitelist).toEqual(['*']);
  });

  // The shell asks the app to open a link the reader tapped; the app opens it
  // the way it opens a link in chat, but only with the shell's token, since
  // every frame, the file's included, can post to the bridge.
  it('opens a tapped link the shell sends with its token', () => {
    const { props } = renderWebView();
    const token = shellToken(props.source.html);
    expect(props.source.html).toContain(
      'window.ReactNativeWebView.postMessage('
    );
    props.onMessage(
      linkMessage({ token, href: 'https://shop.example/item?id=1' })
    );
    expect(mocks.openURL).toHaveBeenCalledWith(
      'https://shop.example/item?id=1'
    );
  });

  it('ignores a message without the token, or for anything but a web, mail or phone link', () => {
    const { props } = renderWebView();
    const token = shellToken(props.source.html);
    props.onMessage(linkMessage({ token: 'guess', href: 'https://tlon.io/' }));
    props.onMessage(linkMessage({ href: 'https://tlon.io/' }));
    props.onMessage(linkMessage({ token, href: 'file:///etc/passwd' }));
    props.onMessage(linkMessage({ token, href: 'tlon://open' }));
    props.onMessage({ nativeEvent: { data: 'https://tlon.io/' } });
    expect(mocks.openURL).not.toHaveBeenCalled();
  });

  // A burst of messages opens one link: the app leaves for the browser on the
  // first.
  it('opens one link for a burst of messages', () => {
    const { props } = renderWebView();
    const token = shellToken(props.source.html);
    props.onMessage(linkMessage({ token, href: 'https://tlon.io/a' }));
    props.onMessage(linkMessage({ token, href: 'https://tlon.io/b' }));
    expect(mocks.openURL).toHaveBeenCalledTimes(1);
    expect(mocks.openURL).toHaveBeenCalledWith('https://tlon.io/a');
  });

  it('loads the inline documents and refuses every other navigation, a tapped link included', () => {
    const { props } = renderWebView();
    expect(
      props.onShouldStartLoadWithRequest({
        url: 'about:blank',
        isTopFrame: true,
        navigationType: 'other',
      })
    ).toBe(true);
    expect(
      props.onShouldStartLoadWithRequest({
        url: 'about:srcdoc',
        isTopFrame: false,
        navigationType: 'other',
      })
    ).toBe(true);
    // A tap, or a script's click reported as one.
    expect(
      props.onShouldStartLoadWithRequest({
        url: 'https://tlon.io/',
        isTopFrame: false,
        navigationType: 'click',
      })
    ).toBe(false);
    expect(
      props.onShouldStartLoadWithRequest({
        url: 'https://evil.example/',
        isTopFrame: false,
        navigationType: 'other',
      })
    ).toBe(false);
    // The shape Android sends: no frame, no gesture.
    expect(
      props.onShouldStartLoadWithRequest({ url: 'https://evil.example/' })
    ).toBe(false);
  });
});

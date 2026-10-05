import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BucketFileViewer } from './BucketFileViewer.native';
import type { BucketFileViewerItem } from './BucketFileViewer.shared';

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
  textContent: '<!doctype html><p>Quarterly numbers</p>',
  uri: 'https://storage.example/signed-read-url',
};

function renderWebView(item: BucketFileViewerItem = htmlFile) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<BucketFileViewer item={item} onClose={() => {}} />);
  });
  return renderer.root.findByType('WebView' as never);
}

afterEach(() => {
  mocks.platform.OS = 'ios';
  mocks.openURL.mockClear();
});

describe('BucketFileViewer html preview (native)', () => {
  // The WebView loads a shell of ours; the file sits in a sandboxed frame
  // inside it, under the policy that keeps its scripts offline.
  it('loads the file inside the shell, sandboxed and under the policy, not from its URL', () => {
    const { props } = renderWebView();
    expect(props.source.uri).toBeUndefined();
    const shell: string = props.source.html;
    expect(shell).toContain('content="frame-src about:"');
    expect(shell).toContain('<iframe sandbox="allow-scripts" srcdoc="');
    expect(shell).toContain('&lt;p&gt;Quarterly numbers&lt;/p&gt;');
    expect(shell).toContain("connect-src 'none'");
    expect(shell).toContain("form-action 'none'");
    expect(shell).toContain("frame-src 'none'");
  });

  // These props are the isolation: a change to any of them is a decision.
  it('keeps the document apart from the app on iOS', () => {
    const { props } = renderWebView();
    expect(props.javaScriptEnabled).toBe(true);
    expect(props.incognito).toBe(true);
    expect(props.sharedCookiesEnabled).toBe(false);
    expect(props.thirdPartyCookiesEnabled).toBe(false);
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

  it('hands a tapped link to the system browser and keeps the preview', () => {
    const { props } = renderWebView();
    expect(
      props.onShouldStartLoadWithRequest({
        url: 'https://tlon.io/',
        isTopFrame: false,
        navigationType: 'click',
      })
    ).toBe(false);
    expect(mocks.openURL).toHaveBeenCalledWith('https://tlon.io/');
  });

  it('loads the inline documents and refuses a navigation that is not a tap', () => {
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
    expect(mocks.openURL).not.toHaveBeenCalled();
  });
});

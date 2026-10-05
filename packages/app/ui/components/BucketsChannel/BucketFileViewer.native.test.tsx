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
  it('loads the file as a document under the form policy, not from its URL', () => {
    const { props } = renderWebView();
    expect(props.source.uri).toBeUndefined();
    expect(props.source.html).toContain('<p>Quarterly numbers</p>');
    expect(props.source.html).toContain("connect-src 'none'");
    expect(props.source.html).toContain("form-action 'none'");
    expect(props.source.html).toContain("frame-src 'none'");
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
        isTopFrame: true,
        navigationType: 'click',
      })
    ).toBe(false);
    expect(mocks.openURL).toHaveBeenCalledWith('https://tlon.io/');
  });

  it('loads the document and refuses a navigation that is not a tap', () => {
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
        url: 'https://evil.example/',
        isTopFrame: true,
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

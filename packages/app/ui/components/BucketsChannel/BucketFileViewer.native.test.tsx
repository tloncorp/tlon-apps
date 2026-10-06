import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScreenHeader } from '../ScreenHeader';
import { BucketFileViewer } from './BucketFileViewer.native';
import {
  type BucketFileViewerItem,
  HTML_PREVIEW_LINK_MESSAGE,
  HTML_PREVIEW_POLICY,
  htmlPreviewHeldPolicy,
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
  return {
    FilePreview,
    Icon: 'Icon',
    Image: 'Image',
    Pressable: 'Pressable',
    Text: 'Text',
  };
});

vi.mock('tamagui', () => ({
  ScrollView: 'ScrollView',
  Spinner: 'Spinner',
  View: 'View',
  XStack: 'XStack',
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

const scriptedFile: BucketFileViewerItem = {
  ...htmlFile,
  textContent:
    '<!doctype html><title>Quarterly numbers</title><p id="n">three</p><script>document.getElementById("n").textContent = "3";</script>',
};

function render(item: BucketFileViewerItem = htmlFile) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<BucketFileViewer item={item} onClose={() => {}} />);
  });
  return renderer;
}

function webViewOf(renderer: ReactTestRenderer) {
  return renderer.root.findByType('WebView' as never).props;
}

// The Enable action in the banner a page with held scripts shows.
function enableScriptsButton(renderer: ReactTestRenderer) {
  return renderer.root.findAllByProps({
    testID: 'BucketFileViewerEnableScripts',
  })[0];
}

afterEach(() => {
  mocks.platform.OS = 'ios';
  mocks.openURL.mockClear();
});

describe('BucketFileViewer html preview (native)', () => {
  // The WebView loads a shell of ours that carries the policy, not the file's
  // URL; the file sits in a sandboxed frame inside it and inherits the policy.
  // Until the reader asks, it runs ours alone: a running page could post to
  // the bridge as often as it liked.
  it("holds a page's scripts until the reader enables them", () => {
    const renderer = render(scriptedFile);
    const { subtitle, title } = renderer.root.findByType(ScreenHeader).props;
    expect({ subtitle, title }).toEqual({
      subtitle: 'report.html · 4 KB',
      title: 'Quarterly numbers',
    });
    const { source } = webViewOf(renderer);
    expect(source.uri).toBeUndefined();
    const nonce = source.html.match(/'nonce-([0-9a-f]{32})'/)?.[1];
    expect(source.html).toContain(
      `<meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${htmlPreviewHeldPolicy(nonce!)}">`
    );
    expect(source.html).toContain(`<script nonce="${nonce}">`);
    expect(source.html).toContain(
      '<iframe sandbox="allow-scripts" srcdoc="&lt;!doctype html&gt;'
    );

    act(() => enableScriptsButton(renderer).props.onPress());
    const running: string = webViewOf(renderer).source.html;
    expect(running).toContain(
      `<meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_POLICY}">`
    );
    expect(running).not.toContain('nonce');
    expect(enableScriptsButton(renderer)).toBeUndefined();
  });

  it('offers nothing to run for a page without scripts', () => {
    expect(enableScriptsButton(render())).toBeUndefined();
  });

  // Nesting deeper than the preview reads, it gets the notice and Open.
  it('renders no WebView for a file that nests too deep', () => {
    const renderer = render({
      ...scriptedFile,
      textContent: '<script>go()</script>' + '<div>'.repeat(1000),
    });
    expect(renderer.root.findAllByType('WebView' as never)).toHaveLength(0);
    expect(enableScriptsButton(renderer)).toBeUndefined();
  });

  // These props are the isolation: a change to any of them is a decision.
  // incognito on Android would clear the cookie jar the whole app shares.
  it.each([
    ['ios', true],
    ['android', false],
  ])('keeps the document apart from the app on %s', (os, incognito) => {
    mocks.platform.OS = os;
    expect(webViewOf(render())).toMatchObject({
      incognito,
      javaScriptEnabled: true,
      originWhitelist: ['*'],
      setSupportMultipleWindows: false,
      sharedCookiesEnabled: false,
      thirdPartyCookiesEnabled: false,
    });
  });

  // The shell asks the app to open a link the reader tapped, with its token,
  // since every frame, the file's included, can post to the bridge. A burst
  // opens one link: the app leaves for the browser on the first.
  it('opens a tapped link the shell sends with its token, once per burst', () => {
    const { onMessage, source } = webViewOf(render());
    const token = source.html.match(/token: '([0-9a-f]{32})'/)?.[1];
    const link = (fields: Record<string, unknown>) =>
      onMessage({
        nativeEvent: {
          data: JSON.stringify({ type: HTML_PREVIEW_LINK_MESSAGE, ...fields }),
        },
      });
    link({ token: 'guess', href: 'https://tlon.io/' });
    link({ href: 'https://tlon.io/' });
    link({ token, href: 'file:///etc/passwd' });
    link({ token, href: 'tlon://open' });
    onMessage({ nativeEvent: { data: 'https://tlon.io/' } });
    expect(mocks.openURL).not.toHaveBeenCalled();
    link({ token, href: 'https://shop.example/item?id=1' });
    link({ token, href: 'https://tlon.io/b' });
    expect(mocks.openURL).toHaveBeenCalledTimes(1);
    expect(mocks.openURL).toHaveBeenCalledWith(
      'https://shop.example/item?id=1'
    );
  });

  it.each([
    [{ url: 'about:blank', isTopFrame: true, navigationType: 'other' }, true],
    [{ url: 'about:srcdoc', isTopFrame: false, navigationType: 'other' }, true],
    // A tap, or a script's click reported as one.
    [
      { url: 'https://tlon.io/', isTopFrame: false, navigationType: 'click' },
      false,
    ],
    [
      {
        url: 'https://evil.example/',
        isTopFrame: false,
        navigationType: 'other',
      },
      false,
    ],
    // The shape Android sends: no frame, no gesture.
    [{ url: 'https://evil.example/' }, false],
  ])('loads only the inline documents: %o', (request, loads) => {
    expect(webViewOf(render()).onShouldStartLoadWithRequest(request)).toBe(
      loads
    );
  });
});

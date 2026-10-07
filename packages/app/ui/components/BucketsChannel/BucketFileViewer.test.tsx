import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScreenHeader } from '../ScreenHeader';
import { BucketFileViewer } from './BucketFileViewer';
import {
  type BucketFileViewerItem,
  HTML_PREVIEW_POLICY,
  htmlPreviewHeldPolicy,
  releaseHtmlPreview,
} from './BucketFileViewer.shared';

const mocks = vi.hoisted(() => ({ isElectron: false }));

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

vi.mock('./BucketFileViewer.shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./BucketFileViewer.shared')>();
  return {
    ...actual,
    releaseHtmlPreview: vi.fn(actual.releaseHtmlPreview),
  };
});

vi.mock('../ScreenHeader', () => {
  const ScreenHeader = () => null;
  ScreenHeader.TextButton = () => null;
  return { ScreenHeader };
});

vi.mock('../../../hooks/useIsElectron', () => ({
  useIsElectron: () => mocks.isElectron,
}));

const htmlFile: BucketFileViewerItem = {
  name: 'report.html',
  mimeType: 'text/html',
  sizeLabel: '4 KB',
  textContent:
    '<!doctype html><title>Quarterly numbers</title><p id="n">three</p><script>document.getElementById("n").textContent = "3";</script>',
  uri: 'https://storage.example/signed-read-url',
};

// A static page whose only title is in a noscript.
const offlinePage = '<noscript><title>Offline</title></noscript><p>x</p>';

function render(item: BucketFileViewerItem) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<BucketFileViewer item={item} onClose={() => {}} />);
  });
  return renderer;
}

function frames(renderer: ReactTestRenderer) {
  return renderer.root.findAllByType('iframe' as never);
}

function headerOf(renderer: ReactTestRenderer) {
  const { title, subtitle } = renderer.root.findByType(ScreenHeader).props;
  return { title, subtitle };
}

// The Enable action in the banner a page with held scripts shows.
function enableScriptsButton(renderer: ReactTestRenderer) {
  return renderer.root.findAllByProps({
    testID: 'BucketFileViewerEnableScripts',
  })[0];
}

afterEach(() => {
  mocks.isElectron = false;
});

describe('BucketFileViewer html preview (web)', () => {
  // Its parsed tree can hold tens of megabytes, so it goes with the viewer.
  it('lets go of the file it read once it closes', () => {
    const renderer = render(htmlFile);
    vi.mocked(releaseHtmlPreview).mockClear();
    act(() => renderer.unmount());
    expect(releaseHtmlPreview).toHaveBeenCalledTimes(1);
  });

  // From its text, so the storage's headers cannot turn the preview into a
  // download, inside a shell of ours whose policy the file's frame inherits.
  // A page's scripts share the app's thread, so until the reader asks the
  // policy runs ours alone, which carry the nonce; once asked, the frame runs
  // the page's too, and our script and the shell's share a key the file never
  // sees.
  it("holds a page's scripts until the reader enables them", () => {
    const renderer = render(htmlFile);
    expect(headerOf(renderer)).toEqual({
      title: 'Quarterly numbers',
      subtitle: 'report.html · 4 KB',
    });
    const held = frames(renderer)[0].props;
    expect(held.src).toBeUndefined();
    expect(held.sandbox).toBe(
      'allow-scripts allow-popups allow-popups-to-escape-sandbox'
    );
    const nonce = held.srcDoc.match(/'nonce-([0-9a-f]{32})'/)?.[1];
    expect(held.srcDoc).toContain(
      `<meta http-equiv="Content-Security-Policy" content="${htmlPreviewHeldPolicy(nonce!)}">`
    );
    expect(held.srcDoc).toContain(
      '<iframe sandbox="allow-scripts" srcdoc="&lt;!doctype html&gt;'
    );
    expect(held.srcDoc).toContain(`&lt;script nonce=&quot;${nonce}&quot;&gt;`);

    act(() => enableScriptsButton(renderer).props.onPress());
    const shell: string = frames(renderer)[0].props.srcDoc;
    expect(shell).toContain(
      `<meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_POLICY}">`
    );
    expect(shell).not.toContain('nonce');
    const key = shell.match(/\}\)\('([0-9a-f]{32})', function \(href\)/)?.[1];
    expect(shell).toContain(`})('${key}', true);`);
    expect(shell).toContain(
      "window.open(href, '_blank', 'noopener,noreferrer')"
    );
    expect(enableScriptsButton(renderer)).toBeUndefined();
  });

  // With scripting on, a noscript holds text: the page has no title.
  it('offers nothing to run for a page without scripts', () => {
    const renderer = render({ ...htmlFile, textContent: offlinePage });
    expect(frames(renderer)[0].props.srcDoc).toContain("'nonce-");
    expect(enableScriptsButton(renderer)).toBeUndefined();
    expect(headerOf(renderer).title).toBe('report.html');
  });

  // The desktop shell disables web security, which defeats the opaque origin,
  // so there scripts never run: links are aimed at popups in the markup, our
  // inert link script is left out, and a noscript holds markup.
  it('never runs scripts under Electron, and aims its links at popups', () => {
    mocks.isElectron = true;
    const renderer = render({
      ...htmlFile,
      textContent: `${offlinePage}<a href="https://tlon.io" target="_self">brief</a><script>x()</script>`,
    });
    const popups = 'allow-popups allow-popups-to-escape-sandbox';
    const { sandbox, srcDoc } = frames(renderer)[0].props;
    expect(sandbox).toBe(popups);
    expect(srcDoc).toContain(`<iframe sandbox="${popups}" srcdoc="`);
    expect(srcDoc).toContain(
      '&lt;a target=&quot;_blank&quot; href=&quot;https://tlon.io/&quot;&gt;brief&lt;/a&gt;'
    );
    expect(srcDoc).not.toContain('composedPath');
    expect(enableScriptsButton(renderer)).toBeUndefined();
    expect(headerOf(renderer).title).toBe('Offline');
  });

  // Past the size cap the text is never fetched, and the file falls through
  // to the unsupported notice with its Open button; a text file shows source.
  it('renders a frame only for HTML whose text is in hand', () => {
    const unfetched = render({ ...htmlFile, textContent: undefined });
    expect(frames(unfetched)).toHaveLength(0);
    expect(headerOf(unfetched)).toEqual({
      title: 'report.html',
      subtitle: '4 KB',
    });

    // Nesting deeper than the preview reads, in the file or an inline frame's
    // document, it gets the notice and Open.
    for (const textContent of [
      '<title>Deep</title>' + '<div>'.repeat(1000),
      `<title>Deep</title><iframe srcdoc="${'<div>'.repeat(1000)}"></iframe>`,
    ]) {
      const deep = render({ ...htmlFile, textContent });
      expect(frames(deep)).toHaveLength(0);
      expect(enableScriptsButton(deep)).toBeUndefined();
      expect(headerOf(deep).title).toBe('report.html');
    }

    const notes = render({
      ...htmlFile,
      mimeType: 'text/markdown',
      name: 'notes.md',
      textContent: '# Notes',
    });
    expect(frames(notes)).toHaveLength(0);
    const text = notes.root
      .findAllByType('Text' as never)
      .flatMap((node) => node.props.children)
      .join('');
    expect(text).toContain('# Notes');
    expect(headerOf(notes).title).toBe('notes.md');
  });
});

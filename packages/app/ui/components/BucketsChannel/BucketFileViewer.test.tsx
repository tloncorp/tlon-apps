import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScreenHeader } from '../ScreenHeader';
import { BucketFileViewer } from './BucketFileViewer';
import {
  type BucketFileViewerItem,
  HTML_PREVIEW_POLICY,
  htmlPreviewHeldPolicy,
} from './BucketFileViewer.shared';

const mocks = vi.hoisted(() => ({ isElectron: false }));

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

vi.mock('../../../hooks/useIsElectron', () => ({
  useIsElectron: () => mocks.isElectron,
}));

const htmlFile: BucketFileViewerItem = {
  name: 'report.html',
  mimeType: 'text/html',
  sizeLabel: '4 KB',
  textContent:
    '<!doctype html><title>Quarterly numbers</title><p>Quarterly numbers</p>',
  uri: 'https://storage.example/signed-read-url',
};

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

afterEach(() => {
  mocks.isElectron = false;
});

const scriptedFile: BucketFileViewerItem = {
  ...htmlFile,
  textContent:
    '<!doctype html><title>Quarterly numbers</title><p id="n">three</p><script>document.getElementById("n").textContent = "3";</script>',
};

function runScriptsButton(renderer: ReactTestRenderer) {
  const controls = renderer.root.findByType(ScreenHeader).props.rightControls;
  return React.Children.toArray(controls?.props.children).find(
    (child) =>
      React.isValidElement<{ testID?: string }>(child) &&
      child.props.testID === 'BucketFileViewerRunScripts'
  ) as React.ReactElement<{ onPress: () => void }> | undefined;
}

describe('BucketFileViewer html preview (web)', () => {
  // From its text, so the storage's Content-Type and Content-Disposition
  // cannot turn the preview into a download; inside a shell of ours that
  // carries the policy its document inherits and keeps the file's frame where
  // it is. In a browser a page's scripts share the app's thread, so they run
  // only once the reader asks: until then the policy runs ours alone, which
  // carry the preview's nonce, and links open as they do with the page's.
  it('renders the file from its text, scripts held until the reader asks', () => {
    const renderer = render(scriptedFile);
    const [frame] = frames(renderer);
    expect(frame.props.src).toBeUndefined();
    expect(frame.props.sandbox).toBe(
      'allow-scripts allow-popups allow-popups-to-escape-sandbox'
    );
    const shell: string = frame.props.srcDoc;
    const nonce = shell.match(/'nonce-([0-9a-f]{32})'/)?.[1];
    expect(nonce).toBeDefined();
    expect(shell).toContain(
      `<meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${htmlPreviewHeldPolicy(nonce!)}">`
    );
    expect(shell).toContain(`<script nonce="${nonce}">`);
    expect(shell).toContain('<iframe sandbox="allow-scripts" srcdoc="');
    expect(shell).toContain('&lt;p id=&quot;n&quot;&gt;three&lt;/p&gt;');
    // Our script in the file's frame carries the nonce; the file's does not.
    expect(shell).toContain(`&lt;script nonce=&quot;${nonce}&quot;&gt;`);
    expect(shell).toContain('composedPath');
    expect(runScriptsButton(renderer)).toBeDefined();
  });

  // Once asked, the file's frame runs its scripts and nothing else, and our
  // script and the shell's, sharing one key the file never sees, open a
  // tapped link as a new tab.
  it('runs the scripts when the reader asks, keyed to our script in the frame', () => {
    const renderer = render(scriptedFile);
    act(() => runScriptsButton(renderer)!.props.onPress());
    const [frame] = frames(renderer);
    expect(frame.props.sandbox).toBe(
      'allow-scripts allow-popups allow-popups-to-escape-sandbox'
    );
    const shell: string = frame.props.srcDoc;
    expect(shell).toContain('<iframe sandbox="allow-scripts" srcdoc="');
    const key = shell.match(/\}\)\('([0-9a-f]{32})', function \(href\)/)?.[1];
    expect(key).toBeDefined();
    // The same key closes our script in the file's frame, escaped in srcdoc.
    expect(shell).toContain(`})('${key}', true);`);
    expect(shell).toContain(
      `<meta http-equiv="Content-Security-Policy" content="${HTML_PREVIEW_POLICY}">`
    );
    expect(shell).not.toContain('nonce');
    expect(shell).toContain(
      "window.open(href, '_blank', 'noopener,noreferrer')"
    );
    expect(runScriptsButton(renderer)).toBeUndefined();
  });

  // A page with nothing to run renders the same either way.
  it('offers nothing to run for a page without scripts', () => {
    const renderer = render(htmlFile);
    expect(frames(renderer)[0].props.srcDoc).toContain("'nonce-");
    expect(runScriptsButton(renderer)).toBeUndefined();
  });

  // The desktop shell disables web security, which defeats the opaque origin,
  // so there scripts never run; with none to aim a click, every link in the
  // markup is aimed at a popup, and our inert link script is left out.
  it('never runs scripts under Electron, and aims its links at popups', () => {
    mocks.isElectron = true;
    const renderer = render({
      ...scriptedFile,
      textContent:
        '<!doctype html><p>Quarterly numbers</p><a href="https://tlon.io" target="_self">brief</a><script>x()</script>',
    });
    const [frame] = frames(renderer);
    const popups = 'allow-popups allow-popups-to-escape-sandbox';
    expect(frame.props.sandbox).toBe(popups);
    const shell: string = frame.props.srcDoc;
    expect(shell).toContain(`<iframe sandbox="${popups}" srcdoc="`);
    expect(shell).toContain(
      '&lt;a target=&quot;_blank&quot; href=&quot;https://tlon.io/&quot;&gt;brief&lt;/a&gt;'
    );
    expect(shell).not.toContain('composedPath');
    expect(runScriptsButton(renderer)).toBeUndefined();
  });

  it('names the page by its title, with the file beneath', () => {
    const header = render(htmlFile).root.findByType(ScreenHeader);
    expect(header.props.title).toBe('Quarterly numbers');
    expect(header.props.subtitle).toBe('report.html · 4 KB');
  });

  // Past the size cap the text is never fetched, and the file falls through
  // to the unsupported notice with its Open button rather than to a frame.
  it('renders no frame until the text has been fetched', () => {
    const renderer = render({ ...htmlFile, textContent: undefined });
    expect(frames(renderer)).toHaveLength(0);
    const header = renderer.root.findByType(ScreenHeader);
    expect(header.props.title).toBe('report.html');
    expect(header.props.subtitle).toBe('4 KB');
  });

  it('still shows a plain text file as source', () => {
    const renderer = render({
      ...htmlFile,
      mimeType: 'text/markdown',
      name: 'notes.md',
      textContent: '# Notes',
    });
    expect(frames(renderer)).toHaveLength(0);
    const text = renderer.root
      .findAllByType('Text' as never)
      .flatMap((node) => node.props.children)
      .join('');
    expect(text).toContain('# Notes');
    expect(renderer.root.findByType(ScreenHeader).props.title).toBe('notes.md');
  });
});

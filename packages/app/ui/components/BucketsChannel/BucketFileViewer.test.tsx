import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScreenHeader } from '../ScreenHeader';
import { BucketFileViewer } from './BucketFileViewer';
import type { BucketFileViewerItem } from './BucketFileViewer.shared';

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

describe('BucketFileViewer html preview (web)', () => {
  // From its text, so the storage's Content-Type and Content-Disposition
  // cannot turn the preview into a download; inside a shell of ours that
  // carries the policy its document inherits, keeps the file's frame where
  // it is and opens its links; the file's frame sandboxed with scripts and
  // nothing else, so it cannot open a window itself.
  it('renders the file from its text in a sandboxed frame, not from its URL', () => {
    const [frame] = frames(render(htmlFile));
    expect(frame.props.src).toBeUndefined();
    expect(frame.props.sandbox).toBe(
      'allow-scripts allow-popups allow-popups-to-escape-sandbox'
    );
    const shell: string = frame.props.srcDoc;
    expect(shell).toContain(
      '<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="connect-src \'none\'; form-action \'none\'; frame-src about:; object-src \'none\'">'
    );
    expect(shell).toContain('<iframe sandbox="allow-scripts" srcdoc="');
    expect(shell).toContain('&lt;p&gt;Quarterly numbers&lt;/p&gt;');
    expect(shell).toContain('&lt;base target=&quot;_blank&quot;&gt;');
  });

  // Our script in the file's frame and the shell's share one key, which the
  // file never sees; the shell opens a tapped link as a new tab.
  it('opens a tapped link as a new tab, keyed to our script in the frame', () => {
    const shell: string = frames(render(htmlFile))[0].props.srcDoc;
    const key = shell.match(/\}\)\('([0-9a-f]{32})', function \(href\)/)?.[1];
    expect(key).toBeDefined();
    // The same key closes our script in the file's frame, escaped in srcdoc.
    expect(shell).toContain(`})('${key}');`);
    expect(shell).toContain(
      "window.open(href, '_blank', 'noopener,noreferrer')"
    );
  });

  // The desktop shell disables web security, which defeats the opaque origin.
  // With no script anywhere, a link the reader clicks opens as a popup.
  it('withholds scripts under Electron and lets links open as popups', () => {
    mocks.isElectron = true;
    const [frame] = frames(render(htmlFile));
    const popups = 'allow-popups allow-popups-to-escape-sandbox';
    expect(frame.props.sandbox).toBe(popups);
    expect(frame.props.srcDoc).toContain(
      `<iframe sandbox="${popups}" srcdoc="`
    );
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

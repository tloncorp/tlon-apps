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
  // carries the policy its document inherits and keeps the file's frame
  // where it is; sandboxed with nothing but scripts, inside and out.
  it('renders the file from its text in a sandboxed frame, not from its URL', () => {
    const [frame] = frames(render(htmlFile));
    expect(frame.props.src).toBeUndefined();
    expect(frame.props.sandbox).toBe('allow-scripts');
    const shell: string = frame.props.srcDoc;
    expect(shell).toContain(
      '<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="connect-src \'none\'; form-action \'none\'; frame-src about:; object-src \'none\'">'
    );
    expect(shell).toContain('<iframe sandbox="allow-scripts" srcdoc="');
    expect(shell).toContain('&lt;p&gt;Quarterly numbers&lt;/p&gt;');
    expect(shell).toContain('&lt;base target=&quot;_blank&quot;&gt;');
  });

  // The desktop shell disables web security, which defeats the opaque origin.
  it('withholds scripts under Electron', () => {
    mocks.isElectron = true;
    const [frame] = frames(render(htmlFile));
    expect(frame.props.sandbox).toBe('');
    expect(frame.props.srcDoc).toContain('<iframe sandbox="" srcdoc="');
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

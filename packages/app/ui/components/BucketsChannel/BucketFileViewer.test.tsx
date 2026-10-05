import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  textContent: '<!doctype html><p>Quarterly numbers</p>',
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
  // cannot turn the preview into a download; sandboxed without the app's
  // origin or forms; carrying the policy that keeps its scripts offline.
  it('renders the file from its text in a sandboxed frame, not from its URL', () => {
    const [frame] = frames(render(htmlFile));
    expect(frame.props.src).toBeUndefined();
    expect(frame.props.srcDoc).toContain('<p>Quarterly numbers</p>');
    expect(frame.props.srcDoc).toContain("connect-src 'none'");
    expect(frame.props.srcDoc).toContain('<base target="_blank">');
    const tokens = frame.props.sandbox.split(' ');
    expect(tokens).toContain('allow-scripts');
    expect(tokens).not.toContain('allow-same-origin');
    expect(tokens).not.toContain('allow-forms');
  });

  // The desktop shell disables web security, which defeats the opaque origin.
  it('withholds scripts under Electron', () => {
    mocks.isElectron = true;
    const [frame] = frames(render(htmlFile));
    const tokens = frame.props.sandbox.split(' ');
    expect(tokens).not.toContain('allow-scripts');
    expect(tokens).not.toContain('allow-same-origin');
  });

  // Past the size cap the text is never fetched, and the file falls through
  // to the unsupported notice with its Open button rather than to a frame.
  it('renders no frame until the text has been fetched', () => {
    expect(
      frames(render({ ...htmlFile, textContent: undefined }))
    ).toHaveLength(0);
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
  });
});

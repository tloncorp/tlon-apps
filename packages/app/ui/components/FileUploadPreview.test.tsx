import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { FileUploadLockup } from './FileUploadPreview';

vi.mock('tamagui', () => ({ XStack: 'XStack', YStack: 'YStack' }));
vi.mock('@tloncorp/ui', () => ({
  FilePreview: Object.assign(() => null, { fileExtensionFrom: () => 'PDF' }),
  Icon: 'Icon',
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
}));
vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: {},
  trackEvent: () => {},
}));
vi.mock('@tloncorp/shared/utils', () => ({
  formatMemorySize: (bytes: number) => `${bytes}b`,
}));
vi.mock('../contexts/navigation', () => ({
  useNavigation: () => ({ openExternalLink: async () => {} }),
}));
vi.mock('./ContentReference/Reference', () => ({ Reference: {} }));
vi.mock('./PostContent/BlockquoteSideBorder', () => ({
  BlockquoteSideBorder: 'BlockquoteSideBorder',
}));

function texts(size: number): string[] {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <FileUploadLockup
        file={{ fileUri: 'https://x/f.pdf', name: 'f.pdf', size }}
      />
    );
  });
  return renderer.root
    .findAll((node) => (node.type as unknown) === 'Text')
    .map((node) => node.props.children);
}

describe('FileUploadLockup size label', () => {
  it('shows a known size', () => {
    expect(texts(2048)).toEqual(['f.pdf', '2048b']);
  });

  it('hides the unknown-size sentinel', () => {
    expect(texts(-1)).toEqual(['f.pdf']);
  });
});

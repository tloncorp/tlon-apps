import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { VideoPreview } from './VideoPreview';

vi.mock('tamagui', () => ({
  View: 'View',
  styled: () => 'StyledView',
}));
vi.mock('@tloncorp/ui', () => ({
  GestureTrigger: 'GestureTrigger',
  Icon: 'Icon',
  Image: 'Image',
  Pressable: 'Pressable',
  Text: 'Text',
}));
vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: { VideoPlaybackOpened: 'VideoPlaybackOpened' },
  createDevLogger: () => ({ trackEvent: () => {} }),
  makePrettyDurationFromSeconds: () => undefined,
}));
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: () => {} }),
}));
vi.mock('../../utils/mediaViewer', () => ({
  getVideoViewerId: () => null,
}));

const SRC = 'https://cdn.example.com/clip.mp4';

async function render(video: { width?: number; height?: number }) {
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(<VideoPreview video={{ src: SRC, ...video }} />);
  });
  const frame = renderer!.root.find(
    (node) => (node.type as unknown) === 'Pressable'
  );
  const media = frame.find(
    (node) => (node.type as unknown) === 'View' && node.props.width === '100%'
  );
  return { frame: frame.props, media: media.props };
}

describe('VideoPreview dimensions', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  it.each([
    ['missing', {}],
    ['partial', { width: 640 }],
    ['zero', { width: 0, height: 360 }],
  ])('fills its container when dimensions are %s', async (_name, video) => {
    const { frame, media } = await render(video);
    expect(frame.width).toBe('100%');
    expect(frame.maxWidth).toBeUndefined();
    expect(media.aspectRatio).toBe(1);
  });

  it('caps known dimensions at the natural width and keeps the ratio', async () => {
    const { frame, media } = await render({ width: 640, height: 320 });
    expect(frame.width).toBe('100%');
    expect(frame.maxWidth).toBe(640);
    expect(media.aspectRatio).toBe(2);
  });

  it('keeps an explicit maxWidth constraint for unknown dimensions', async () => {
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(<VideoPreview video={{ src: SRC }} maxWidth={300} />);
    });
    const frame = renderer!.root.find(
      (node) => (node.type as unknown) === 'Pressable'
    );
    expect(frame.props.maxWidth).toBe(300);
  });
});

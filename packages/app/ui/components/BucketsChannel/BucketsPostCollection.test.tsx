import React, { createRef } from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { BucketsPostCollection } from './BucketsPostCollection';

const mocks = vi.hoisted(() => ({
  channel: { id: 'buckets/~zod/files', type: 'buckets' },
  deskSupportsBuckets: undefined as boolean | undefined,
  // Stands in for the live view: everything that talks to %buckets sits
  // behind its mount, so not mounting it is what keeps a ship without the
  // agent from issuing requests.
  liveChannel: vi.fn((_props: Record<string, unknown>) => null),
}));

vi.mock('@tloncorp/api', () => ({
  parseBucketsChannelId: (channelId: string) => {
    const [kind, host, name] = channelId.split('/');
    return kind === 'buckets' && host && name ? { host, name } : null;
  },
}));

vi.mock('@tloncorp/shared', () => ({
  useDeskSupportsBuckets: () => mocks.deskSupportsBuckets,
}));

vi.mock('@tloncorp/ui', () => ({ Text: 'Text' }));

vi.mock('tamagui', () => ({ YStack: 'YStack' }));

vi.mock('../../../features/buckets/BucketsLiveChannel', () => ({
  BucketsLiveChannel: mocks.liveChannel,
}));

vi.mock('../../contexts/postCollection', () => ({
  usePostCollectionContext: () => ({ channel: mocks.channel }),
}));

function render() {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<BucketsPostCollection ref={createRef()} />);
  });
  return renderer;
}

function textOf(renderer: ReactTestRenderer) {
  return renderer.root
    .findAllByType('Text' as never)
    .flatMap((node) => node.props.children)
    .join('');
}

describe('BucketsPostCollection', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    mocks.channel = { id: 'buckets/~zod/files', type: 'buckets' };
    mocks.liveChannel.mockClear();
  });

  it('shows the unsupported notice instead of the live view on a ship without %buckets', () => {
    mocks.deskSupportsBuckets = false;

    const renderer = render();

    expect(mocks.liveChannel).not.toHaveBeenCalled();
    expect(
      renderer.root.findAll(
        (node) => node.props.testID === 'BucketsUnsupportedNotice'
      )
    ).toHaveLength(1);
    expect(textOf(renderer)).toContain('newer version of the Tlon backend');
  });

  it('renders nothing until the stored desk version has been read', () => {
    mocks.deskSupportsBuckets = undefined;

    const renderer = render();

    expect(mocks.liveChannel).not.toHaveBeenCalled();
    expect(renderer.toJSON()).toBeNull();
  });

  it('opens the live view once the desk version is known to support it', () => {
    mocks.deskSupportsBuckets = undefined;
    const renderer = render();
    expect(mocks.liveChannel).not.toHaveBeenCalled();

    mocks.deskSupportsBuckets = true;
    act(() => {
      renderer.update(<BucketsPostCollection ref={createRef()} />);
    });

    expect(mocks.liveChannel).toHaveBeenCalled();
    expect(mocks.liveChannel.mock.lastCall?.[0].flag).toEqual({
      host: '~zod',
      name: 'files',
    });
  });

  it('keeps reporting an invalid address ahead of the support check', () => {
    mocks.channel = { id: 'buckets/~zod', type: 'buckets' };
    mocks.deskSupportsBuckets = false;

    const renderer = render();

    expect(mocks.liveChannel).not.toHaveBeenCalled();
    expect(textOf(renderer)).toBe('This Bucket address is invalid.');
  });
});

import React from 'react';
import { act, create } from 'react-test-renderer';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ChannelLinkReferenceLoader } from './ContentReference';

const mocks = vi.hoisted(() => ({
  channel: undefined as undefined | Record<string, unknown>,
  group: undefined as undefined | Record<string, unknown>,
  nav: {} as {
    onPressChannelRef?: (channel: unknown) => void;
    onPressGroupRef?: (group: unknown) => void;
  },
  referenceProps: [] as Array<{ onPress?: () => void }>,
}));

vi.mock('@tloncorp/shared/store', () => ({
  useChannelPreview: () => ({ data: mocks.channel, isLoading: false }),
  useGroupPreview: () => ({ data: mocks.group }),
  useNoteReference: () => ({}),
  usePostReference: () => ({}),
}));

vi.mock('../../contexts/navigation', () => ({
  useNavigation: () => mocks.nav,
}));

vi.mock('./Reference', () => {
  const Reference = (props: { onPress?: () => void }) => {
    mocks.referenceProps.push(props);
    return null;
  };
  Reference.Body = () => null;
  return {
    Reference,
    ReferenceContext: {},
    ReferenceSkeleton: () => null,
    useReferenceContext: () => ({}),
  };
});

vi.mock('@react-navigation/native', () => ({ useNavigation: () => ({}) }));
vi.mock('@tloncorp/api/urbit', () => ({ getChannelType: () => 'chat' }));
vi.mock('@tloncorp/shared/db', () => ({}));
vi.mock('@tloncorp/shared/domain', () => ({}));
vi.mock('@tloncorp/ui', () => ({ Text: 'Text' }));
vi.mock('tamagui', () => ({
  View: 'View',
  XStack: 'XStack',
  styled: () => 'Styled',
}));
vi.mock('../../utils', () => ({
  useChannelTitle: () => 'Channel',
  useGroupTitle: () => 'Group',
}));
vi.mock('../Avatar', () => ({ ContactAvatar: () => null }));
vi.mock('../ContactNameV2', () => ({ useContactName: () => '' }));
vi.mock('../GalleryPost/GalleryContentRenderer', () => ({
  GalleryContentRenderer: () => null,
}));
vi.mock('../GroupAvatar', () => ({ GroupAvatar: () => null }));
vi.mock('../ListItem', () => ({ ListItem: () => null }));
vi.mock('../PostContent/BlockRenderer', () => ({
  ContentReferenceContext: React.createContext(null),
  IsInsideReferenceContext: React.createContext(false),
}));
vi.mock('../PostContent/ContentRenderer', () => ({
  PostContentRenderer: () => null,
}));
vi.mock('../listItems/listItemUtils', () => ({
  useBoundHandler: () => undefined,
}));

const channelId = 'chat/~host/example';
const groupId = '~host/group';

function renderLoader() {
  mocks.referenceProps = [];
  let renderer: ReturnType<typeof create>;
  act(() => {
    renderer = create(<ChannelLinkReferenceLoader channelId={channelId} />);
  });
  act(() => renderer!.unmount());
  return mocks.referenceProps[mocks.referenceProps.length - 1];
}

describe('ChannelLinkReferenceLoader', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    mocks.channel = { id: channelId, groupId, currentUserIsMember: true };
    mocks.group = { id: groupId, currentUserIsMember: true };
    mocks.nav = {
      onPressChannelRef: vi.fn(),
      onPressGroupRef: vi.fn(),
    };
  });

  it('opens a readable channel for a group member', () => {
    const props = renderLoader();
    props.onPress!();
    expect(mocks.nav.onPressChannelRef).toHaveBeenCalledWith(mocks.channel);
    expect(mocks.nav.onPressGroupRef).not.toHaveBeenCalled();
  });

  it('opens a preview channel with unset read access for a group member', () => {
    mocks.channel = { id: channelId, groupId };
    const props = renderLoader();
    props.onPress!();
    expect(mocks.nav.onPressChannelRef).toHaveBeenCalledWith(mocks.channel);
  });

  it('falls back to the group when the member cannot read the channel', () => {
    mocks.channel = { id: channelId, groupId, currentUserIsMember: false };
    const props = renderLoader();
    props.onPress!();
    expect(mocks.nav.onPressGroupRef).toHaveBeenCalledWith(mocks.group);
    expect(mocks.nav.onPressChannelRef).not.toHaveBeenCalled();
  });

  it('is inert when only the group callback exists and the channel is readable', () => {
    mocks.nav = { onPressGroupRef: vi.fn() };
    const props = renderLoader();
    expect(props.onPress).toBeUndefined();
  });

  it('opens the group for a non-member when only the group callback exists', () => {
    mocks.group = { id: groupId, currentUserIsMember: false };
    mocks.nav = { onPressGroupRef: vi.fn() };
    const props = renderLoader();
    props.onPress!();
    expect(mocks.nav.onPressGroupRef).toHaveBeenCalledWith(mocks.group);
  });
});

import React from 'react';
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

import { ContactAvatar } from './Avatar';

const mocks = vi.hoisted(() => ({
  contacts: {} as Record<
    string,
    { id: string; botInfo?: string; botLiveness?: string }
  >,
}));

vi.mock('tamagui', () => ({
  View: 'View',
  Text: 'Text',
  styled: () => 'AvatarFrame',
  useStyle: () => ({}),
  getTokenValue: () => 32,
  isWeb: false,
}));
vi.mock('@tloncorp/ui', () => ({
  Icon: 'Icon',
  Image: 'Image',
  UrbitSigil: 'UrbitSigil',
}));
vi.mock('../utils', () => ({
  getChannelTypeIcon: () => 'Channel',
  useChannelTitle: () => null,
}));
vi.mock('../utils/colorUtils', () => ({
  useSigilColors: () => ({ backgroundColor: '#000', foregroundColor: '#fff' }),
  getContrastingColor: () => '#fff',
}));
vi.mock('../contexts/appDataContext', () => ({
  useContact: (id: string) => mocks.contacts[id] ?? null,
  useCalm: () => ({
    disableAvatars: false,
    disableNicknames: false,
    disableRemoteContent: false,
  }),
}));

const botInfoClaim = JSON.stringify({
  v: 1,
  harness: 'openclaw',
  version: '1',
});
const offlineClaim = JSON.stringify({ v: 1, state: 'offline' });
const onlineClaim = JSON.stringify({ v: 1, state: 'online' });

const findByTestID = (renderer: ReactTestRenderer, testID: string) =>
  renderer.root.findAll((n) => n.props.testID === testID);

const dimmedWrappers = (renderer: ReactTestRenderer) =>
  renderer.root.findAll(
    (n) => (n.type as unknown) === 'View' && n.props.opacity === 0.5
  );

async function renderAvatar(element: React.ReactElement) {
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(element);
  });
  return renderer!;
}

describe('ContactAvatar bot liveness', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    mocks.contacts = {};
  });

  it('dims and dots the avatar of an offline bot from the context', async () => {
    mocks.contacts['~pinser-botter-sampel-palnet'] = {
      id: '~pinser-botter-sampel-palnet',
      botLiveness: offlineClaim,
    };
    const renderer = await renderAvatar(
      <ContactAvatar contactId="~pinser-botter-sampel-palnet" />
    );
    expect(findByTestID(renderer, 'ContactAvatarOffline')).toHaveLength(1);
    expect(findByTestID(renderer, 'ContactAvatarOfflineDot')).toHaveLength(1);
    expect(dimmedWrappers(renderer)).toHaveLength(1);
    act(() => renderer.unmount());
  });

  it('dims an offline bot supplied only through contactOverride', async () => {
    const renderer = await renderAvatar(
      <ContactAvatar
        contactId="~offline-override-bot"
        contactOverride={{
          id: '~offline-override-bot',
          botInfo: botInfoClaim,
          botLiveness: offlineClaim,
        }}
      />
    );
    expect(findByTestID(renderer, 'ContactAvatarOffline')).toHaveLength(1);
    expect(findByTestID(renderer, 'ContactAvatarOfflineDot')).toHaveLength(1);
    expect(dimmedWrappers(renderer)).toHaveLength(1);
    act(() => renderer.unmount());
  });

  it('keeps the dim at $xl but drops the dot', async () => {
    mocks.contacts['~pinser-botter-sampel-palnet'] = {
      id: '~pinser-botter-sampel-palnet',
      botLiveness: offlineClaim,
    };
    const renderer = await renderAvatar(
      <ContactAvatar contactId="~pinser-botter-sampel-palnet" size="$xl" />
    );
    expect(findByTestID(renderer, 'ContactAvatarOffline')).toHaveLength(1);
    expect(findByTestID(renderer, 'ContactAvatarOfflineDot')).toHaveLength(0);
    expect(dimmedWrappers(renderer)).toHaveLength(1);
    act(() => renderer.unmount());
  });

  it('keeps the dim for a custom size but drops the dot', async () => {
    mocks.contacts['~pinser-botter-sampel-palnet'] = {
      id: '~pinser-botter-sampel-palnet',
      botLiveness: offlineClaim,
    };
    const renderer = await renderAvatar(
      <ContactAvatar
        contactId="~pinser-botter-sampel-palnet"
        size="custom"
        width={20}
        height={20}
      />
    );
    expect(findByTestID(renderer, 'ContactAvatarOffline')).toHaveLength(1);
    expect(findByTestID(renderer, 'ContactAvatarOfflineDot')).toHaveLength(0);
    expect(dimmedWrappers(renderer)).toHaveLength(1);
    act(() => renderer.unmount());
  });

  it('shows no indicator for an online bot', async () => {
    mocks.contacts['~online-bot'] = {
      id: '~online-bot',
      botInfo: botInfoClaim,
      botLiveness: onlineClaim,
    };
    const renderer = await renderAvatar(
      <ContactAvatar contactId="~online-bot" />
    );
    expect(findByTestID(renderer, 'ContactAvatarOffline')).toHaveLength(0);
    expect(dimmedWrappers(renderer)).toHaveLength(0);
    act(() => renderer.unmount());
  });

  it('shows no indicator for a non-bot carrying an offline claim', async () => {
    mocks.contacts['~sampel-palnet'] = {
      id: '~sampel-palnet',
      botLiveness: offlineClaim,
    };
    const renderer = await renderAvatar(
      <ContactAvatar contactId="~sampel-palnet" />
    );
    expect(findByTestID(renderer, 'ContactAvatarOffline')).toHaveLength(0);
    expect(dimmedWrappers(renderer)).toHaveLength(0);
    act(() => renderer.unmount());
  });
});

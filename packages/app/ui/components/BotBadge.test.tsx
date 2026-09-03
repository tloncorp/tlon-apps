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

import { BotBadge } from './BotBadge';

const mocks = vi.hoisted(() => ({
  contacts: {} as Record<
    string,
    { id: string; botInfo?: string; botLiveness?: string }
  >,
}));

vi.mock('tamagui', () => ({
  View: 'View',
  Text: 'Text',
  SizableText: 'SizableText',
  styled: () => 'AvatarFrame',
  useStyle: () => ({}),
  getTokenValue: () => 32,
  isWeb: false,
}));
vi.mock('@tloncorp/ui', () => ({
  Icon: 'Icon',
  Image: 'Image',
  UrbitSigil: 'UrbitSigil',
  Pressable: 'Pressable',
}));
vi.mock('../utils', () => ({
  getAndroidRoundedBackgroundKey: () => 'bg-key',
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

function renderedBadge(renderer: ReactTestRenderer) {
  const views = renderer.root.findAll(
    (n) => (n.type as unknown) === 'View' && n.props.backgroundColor
  );
  const texts = renderer.root.findAll(
    (n) => (n.type as unknown) === 'SizableText'
  );
  return {
    backgroundColor: views[0]?.props.backgroundColor,
    text: texts[0]?.children?.join(''),
  };
}

async function renderBadge(element: React.ReactElement) {
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(element);
  });
  return renderer!;
}

describe('BotBadge', () => {
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

  it('renders nothing for a non-bot contact', async () => {
    mocks.contacts['~sampel-palnet'] = { id: '~sampel-palnet' };
    const renderer = await renderBadge(<BotBadge contactId="~sampel-palnet" />);
    expect(renderer.toJSON()).toBeNull();
    act(() => renderer.unmount());
  });

  it('shows a neutral Bot badge for a bot with no liveness claim', async () => {
    mocks.contacts['~sampel-palnet'] = {
      id: '~sampel-palnet',
      botInfo: botInfoClaim,
    };
    const renderer = await renderBadge(<BotBadge contactId="~sampel-palnet" />);
    expect(renderedBadge(renderer)).toEqual({
      backgroundColor: '$secondaryBackground',
      text: 'Bot',
    });
    act(() => renderer.unmount());
  });

  it('shows a warning badge when the bot claims offline', async () => {
    mocks.contacts['~sampel-palnet'] = {
      id: '~sampel-palnet',
      botInfo: botInfoClaim,
      botLiveness: offlineClaim,
    };
    const renderer = await renderBadge(<BotBadge contactId="~sampel-palnet" />);
    expect(renderedBadge(renderer)).toEqual({
      backgroundColor: '$orangeSoft',
      text: 'Bot · Offline',
    });
    act(() => renderer.unmount());
  });

  it('assumeBot reads the claim even for an id isBotContact rejects', async () => {
    mocks.contacts['~sampel-palnet'] = {
      id: '~sampel-palnet',
      botLiveness: offlineClaim,
    };
    const renderer = await renderBadge(
      <BotBadge contactId="~sampel-palnet" assumeBot />
    );
    expect(renderedBadge(renderer)).toEqual({
      backgroundColor: '$orangeSoft',
      text: 'Bot · Offline',
    });
    act(() => renderer.unmount());
  });
});

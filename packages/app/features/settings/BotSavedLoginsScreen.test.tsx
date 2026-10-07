import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { BotSavedLoginsScreen } from './BotSavedLoginsScreen';

const mocks = vi.hoisted(() => ({
  moon: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('@tloncorp/api', () => ({ getTlawnMoon: mocks.moon }));
vi.mock('@tloncorp/api/client/browserVault', () => ({
  listBrowserLogins: mocks.list,
  deleteBrowserLogin: mocks.remove,
}));
vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  ConfirmDialog: 'ConfirmDialog',
  Text: 'Text',
}));
vi.mock('tamagui', () => ({ View: 'View', YStack: 'YStack' }));
vi.mock('../../ui', () => ({
  ScreenHeader: 'ScreenHeader',
  SettingsContentScrollView: 'SettingsContentScrollView',
}));
vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUserId: () => '~sampel-palnet',
}));
vi.mock('./bot/helpers', () => ({
  normalizeMoonName: (moon: string, planet: string) =>
    moon.includes(planet) ? moon.replace(/^~/, '') : `${moon}-${planet}`,
}));

const account = {
  id: '8e40b5f5-fd41-4851-8922-b9545e470d6e',
  revision: 3,
  label: 'Personal',
  origin: 'https://example.com',
  updatedAt: 1,
};

async function render(moon?: string) {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <BotSavedLoginsScreen
        navigation={{ goBack: vi.fn() }}
        route={{ params: moon ? { moon } : undefined }}
      />
    );
  });
  return renderer;
}

describe('saved login management', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.moon.mockResolvedValue('pinser-botter');
    mocks.list.mockResolvedValue([account]);
    mocks.remove.mockResolvedValue(undefined);
  });

  it('loads the configured bot and deletes only the confirmed account revision', async () => {
    const renderer = await render();
    expect(mocks.list).toHaveBeenCalledWith(
      'pinser-botter-sampel-palnet',
      expect.any(AbortSignal)
    );
    act(() =>
      renderer.root.findByProps({ label: 'Delete login' }).props.onPress()
    );
    expect(mocks.remove).not.toHaveBeenCalled();
    act(() =>
      renderer.root
        .findByProps({ title: 'Delete saved login?' })
        .props.onOpenChange(false)
    );
    expect(mocks.remove).not.toHaveBeenCalled();
    act(() =>
      renderer.root.findByProps({ label: 'Delete login' }).props.onPress()
    );
    await act(async () =>
      renderer.root
        .findByProps({ title: 'Delete saved login?' })
        .props.onConfirm()
    );
    expect(mocks.remove).toHaveBeenCalledWith('pinser-botter-sampel-palnet', {
      id: account.id,
      revision: 3,
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('No saved logins.');
    act(() => renderer.unmount());
  });

  it('keeps a failed deletion visible and reads the store again on refresh', async () => {
    mocks.remove.mockRejectedValue(new Error('Conflict'));
    const renderer = await render();
    act(() =>
      renderer.root.findByProps({ label: 'Delete login' }).props.onPress()
    );
    await act(async () =>
      renderer.root
        .findByProps({ title: 'Delete saved login?' })
        .props.onConfirm()
    );
    expect(JSON.stringify(renderer.toJSON())).toContain('Personal');
    expect(JSON.stringify(renderer.toJSON())).toContain('could not be deleted');
    mocks.list.mockResolvedValue([]);
    act(() =>
      renderer.root
        .findByProps({ title: 'Delete saved login?' })
        .props.onOpenChange(false)
    );
    await act(async () =>
      renderer.root.findByProps({ label: 'Refresh' }).props.onPress()
    );
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(renderer.toJSON())).toContain('No saved logins.');
    act(() => renderer.unmount());
  });

  it.each(['other-hosted-bot', undefined])(
    'manages the originating bot without consulting Hosting (configured bot=%s)',
    async (configuredMoon) => {
      mocks.moon.mockResolvedValue(configuredMoon);
      const moon = 'marzod-botter-sampel-palnet';
      const renderer = await render(`~${moon}`);
      expect(mocks.moon).not.toHaveBeenCalled();
      expect(mocks.list).toHaveBeenCalledWith(moon, expect.any(AbortSignal));
      act(() =>
        renderer.root.findByProps({ label: 'Delete login' }).props.onPress()
      );
      await act(async () =>
        renderer.root
          .findByProps({ title: 'Delete saved login?' })
          .props.onConfirm()
      );
      expect(mocks.remove).toHaveBeenCalledWith(moon, {
        id: account.id,
        revision: 3,
      });
      await act(async () => renderer.unmount());
    }
  );
});

import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EMPTY_VALUES,
  resetBotSettingsDraft,
  useBotSettingsDraftStore,
} from './botSettingsDraftStore';
import { useApplyBotSettings } from './useBotSettingsDraft';
import type { BotSettingsQueries } from './useBotSettingsData';

const mocks = vi.hoisted(() => ({
  chat: vi.fn(),
  model: vi.fn(),
  setQueryData: vi.fn(),
  setProviderConfig: vi.fn(),
}));
vi.mock('@tloncorp/api', () => ({
  setTlawnChatConfig: mocks.chat,
  nestToFlag: vi.fn(),
}));
vi.mock('./botSettingsTelemetry', () => ({
  trackTlonbotSettingUpdated: vi.fn(),
}));
vi.mock('./useBotSettingsData', () => ({
  useBotSettingsMutations: () => ({
    queryClient: { setQueryData: mocks.setQueryData },
    setProviderConfig: mocks.setProviderConfig,
    savePrimaryModel: { mutateAsync: mocks.model },
  }),
}));

const providerConfig = { keys: {}, models: [], defaultKeys: {} };
const chatConfig = {
  dmAllowlist: [],
  defaultAuthorizedShips: [],
  groupInviteAllowlist: [],
  autoAcceptDmInvites: false,
  autoDiscoverChannels: false,
  groupChannels: [],
  channelRules: {},
};
let renderer: ReactTestRenderer | undefined;
let apply: ReturnType<typeof useApplyBotSettings>;

async function mount(serverConfig = chatConfig) {
  const queries = {
    ship: 'sampel-palnet',
    providerConfig,
    providerConfigQuery: {
      refetch: vi
        .fn()
        .mockResolvedValue({ isSuccess: true, data: providerConfig }),
    },
    configQuery: {
      refetch: vi
        .fn()
        .mockResolvedValue({ isSuccess: true, data: serverConfig }),
    },
    readyQuery: { refetch: vi.fn() },
  } as unknown as BotSettingsQueries;
  function Harness() {
    const current = useApplyBotSettings(queries);
    React.useEffect(() => {
      apply = current;
    }, [current]);
    return null;
  }
  await act(async () => {
    renderer = create(<Harness />);
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  resetBotSettingsDraft();
  useBotSettingsDraftStore
    .getState()
    .syncServerValues('sampel-palnet', EMPTY_VALUES);
  mocks.chat.mockResolvedValue({
    config: { ...chatConfig, autoDiscoverChannels: true },
    providerConfig,
  });
  mocks.model.mockResolvedValue(providerConfig);
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
});

describe('bot settings apply', () => {
  it('applies chat settings without changing browser routing', async () => {
    useBotSettingsDraftStore.getState().commitDraft((current) => ({
      ...current,
      chat: { ...current.chat, autoDiscoverChannels: true },
    }));
    await mount();
    expect(apply.changeLabels).toEqual(['Auto-discover']);
    await act(async () => {
      await apply.applyChanges();
    });
    expect(mocks.chat).toHaveBeenCalledOnce();
    expect(apply.hasChanges).toBe(false);
  });

  it('forwards the server autoAcceptDmInvites value on an unrelated save', async () => {
    useBotSettingsDraftStore.getState().commitDraft((current) => ({
      ...current,
      chat: { ...current.chat, autoDiscoverChannels: true },
    }));
    await mount({ ...chatConfig, autoAcceptDmInvites: true });
    await act(async () => {
      await apply.applyChanges();
    });
    expect(mocks.chat).toHaveBeenCalledWith(
      'sampel-palnet',
      expect.objectContaining({
        config: expect.objectContaining({ autoAcceptDmInvites: true }),
      })
    );
  });

  it('applies the selected model independently of browser settings', async () => {
    useBotSettingsDraftStore.getState().commitDraft((current) => ({
      ...current,
      model: { ...current.model, provider: 'basic' },
    }));
    await mount();
    await act(async () => {
      await apply.applyChanges();
    });
    expect(mocks.model).toHaveBeenCalledOnce();
    expect(mocks.chat).not.toHaveBeenCalled();
    expect(apply.hasChanges).toBe(false);
  });
});

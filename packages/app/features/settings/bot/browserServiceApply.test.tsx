import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EMPTY_VALUES,
  getPendingFields,
  resetBotSettingsDraft,
  useBotSettingsDraftStore,
} from './botSettingsDraftStore';
import {
  useApplyBotSettings,
  useSyncBotSettingsDraft,
} from './useBotSettingsDraft';
import type { BotSettingsQueries } from './useBotSettingsData';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  reload: vi.fn(),
  ready: vi.fn(),
  browserRefetch: vi.fn(),
  chat: vi.fn(),
  model: vi.fn(),
  setQueryData: vi.fn(),
  setProviderConfig: vi.fn(),
}));
vi.mock('@tloncorp/api', () => ({
  setTlawnBrowserService: mocks.save,
  reloadBot: mocks.reload,
  awaitNodeTlonbotReady: mocks.ready,
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

async function mount(supported = true) {
  const queries = {
    ship: 'sampel-palnet',
    browserServiceQuery: {
      data: { browserService: 'steel', supported },
      refetch: mocks.browserRefetch,
    },
    providerConfig,
    providerConfigQuery: {
      refetch: vi
        .fn()
        .mockResolvedValue({ isSuccess: true, data: providerConfig }),
    },
    configQuery: {
      refetch: vi.fn().mockResolvedValue({ isSuccess: true, data: chatConfig }),
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
  mocks.save.mockResolvedValue({ browserService: 'kernel', active: 'steel' });
  mocks.ready.mockResolvedValue(true);
  mocks.browserRefetch.mockResolvedValue({
    isSuccess: true,
    data: { browserService: 'kernel', active: 'kernel', supported: true },
  });
  mocks.reload.mockResolvedValue(undefined);
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

function selectKernel() {
  useBotSettingsDraftStore
    .getState()
    .commitDraft((current) => ({ ...current, browserService: 'kernel' }));
}

describe('browser service settings apply', () => {
  it('keeps selection staged until Apply, then saves before restarting', async () => {
    selectKernel();
    await mount();
    expect(apply.changeLabels).toEqual(['Browser service']);
    expect(mocks.save).not.toHaveBeenCalled();
    await act(async () => {
      await apply.applyChanges();
    });
    expect(mocks.save).toHaveBeenCalledWith('sampel-palnet', 'kernel');
    expect(mocks.reload).toHaveBeenCalledWith('sampel-palnet');
    expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.reload.mock.invocationCallOrder[0]
    );
    expect(mocks.ready).toHaveBeenCalledWith('sampel-palnet');
    expect(mocks.reload.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.ready.mock.invocationCallOrder[0]
    );
    expect(mocks.ready.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.browserRefetch.mock.invocationCallOrder[0]
    );
    expect(mocks.setQueryData).not.toHaveBeenCalled();
    expect(useBotSettingsDraftStore.getState().baseline.browserService).toBe(
      'kernel'
    );
    expect(apply.hasChanges).toBe(false);
  });

  it('waits for readiness before reading the new route', async () => {
    let ready!: (value: boolean) => void;
    mocks.ready.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        ready = resolve;
      })
    );
    selectKernel();
    await mount();
    let pending!: Promise<void>;
    await act(async () => {
      pending = apply.applyChanges();
    });
    expect(mocks.browserRefetch).not.toHaveBeenCalled();
    expect(apply.pending.browserService).toBe(true);
    await act(async () => {
      ready(true);
      await pending;
    });
    expect(mocks.browserRefetch).toHaveBeenCalledOnce();
    expect(apply.hasChanges).toBe(false);
  });

  it('shows a startup fallback and allows selecting Kernel again', async () => {
    mocks.browserRefetch.mockResolvedValueOnce({
      isSuccess: true,
      data: { browserService: 'kernel', active: 'steel', supported: true },
    });
    selectKernel();
    await mount();
    await act(async () => {
      await apply.applyChanges();
    });
    expect(useBotSettingsDraftStore.getState().draft.browserService).toBe(
      'steel'
    );
    expect(apply.hasChanges).toBe(false);
    act(() => selectKernel());
    expect(apply.pending.browserService).toBe(true);
  });

  it('keeps the change pending if readiness times out', async () => {
    mocks.ready.mockResolvedValueOnce(false);
    selectKernel();
    await mount();
    await act(async () => {
      await apply.applyChanges();
    });
    expect(mocks.browserRefetch).not.toHaveBeenCalled();
    expect(apply.pending.browserService).toBe(true);
    expect(apply.applyError).toContain('still restarting');
  });

  it('does not trust cached route data when refreshing fails', async () => {
    mocks.browserRefetch.mockResolvedValueOnce({
      isSuccess: false,
      data: { browserService: 'kernel', active: 'steel' },
    });
    selectKernel();
    await mount();
    await act(async () => {
      await apply.applyChanges();
    });
    expect(apply.pending.browserService).toBe(true);
    expect(apply.applyError).toContain('could not be refreshed');
  });

  it('refuses a staged browser change for an unsupported runtime', async () => {
    selectKernel();
    await mount(false);
    await act(async () => {
      await apply.applyChanges();
    });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(apply.applyError).toContain('available for OpenClaw bots');
  });

  it('does not restart or commit a failed save', async () => {
    mocks.save.mockRejectedValueOnce(new Error('save unavailable'));
    selectKernel();
    await mount();
    await act(async () => {
      await apply.applyChanges();
    });
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(apply.pending.browserService).toBe(true);
    expect(apply.applyError).toBe('save unavailable');
  });

  it('keeps the selection pending if restart fails, and can retry', async () => {
    mocks.reload.mockRejectedValueOnce(new Error('restart unavailable'));
    selectKernel();
    await mount();
    await act(async () => {
      await apply.applyChanges();
    });
    expect(apply.pending.browserService).toBe(true);
    expect(apply.applyError).toBe('restart unavailable');
    await act(async () => {
      await apply.applyChanges();
    });
    expect(apply.hasChanges).toBe(false);
    expect(mocks.reload).toHaveBeenCalledTimes(2);
  });

  it('uses the chat-config restart when both sections change', async () => {
    selectKernel();
    useBotSettingsDraftStore.getState().commitDraft((current) => ({
      ...current,
      chat: { ...current.chat, autoDiscoverChannels: true },
    }));
    await mount();
    await act(async () => {
      await apply.applyChanges();
    });
    expect(mocks.chat).toHaveBeenCalledOnce();
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.chat.mock.invocationCallOrder[0]
    );
    expect(apply.hasChanges).toBe(false);
  });

  it('preserves Kernel selection when changing only chat settings', async () => {
    useBotSettingsDraftStore.getState().syncServerValues('sampel-palnet', {
      ...EMPTY_VALUES,
      browserService: 'kernel',
    });
    useBotSettingsDraftStore.getState().commitDraft((current) => ({
      ...current,
      chat: { ...current.chat, autoDiscoverChannels: true },
    }));
    await mount();
    await act(async () => {
      await apply.applyChanges();
    });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(useBotSettingsDraftStore.getState().baseline.browserService).toBe(
      'kernel'
    );
    expect(apply.hasChanges).toBe(false);
  });

  it('preserves Kernel selection when changing only a model', async () => {
    useBotSettingsDraftStore.getState().syncServerValues('sampel-palnet', {
      ...EMPTY_VALUES,
      browserService: 'kernel',
    });
    useBotSettingsDraftStore.getState().commitDraft((current) => ({
      ...current,
      model: { ...current.model, provider: 'basic' },
    }));
    await mount();
    await act(async () => {
      await apply.applyChanges();
    });
    expect(mocks.model).toHaveBeenCalledOnce();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(useBotSettingsDraftStore.getState().baseline.browserService).toBe(
      'kernel'
    );
  });

  it('hydrates a late browser response without dropping another pending edit', async () => {
    const queries = {
      ship: 'sampel-palnet',
      providerConfig,
      providerConfigQuery: { isSuccess: true },
      configQuery: { isSuccess: true, data: chatConfig },
      nicknameQuery: { isSuccess: true, data: '' },
      browserServiceQuery: {},
    } as unknown as BotSettingsQueries;
    function Sync({ value }: { value: BotSettingsQueries }) {
      useSyncBotSettingsDraft(value);
      return null;
    }
    await act(async () => {
      renderer = create(<Sync value={queries} />);
    });
    act(() =>
      useBotSettingsDraftStore
        .getState()
        .commitDraft((current) => ({ ...current, nickname: 'draft name' }))
    );
    await act(async () => {
      renderer!.update(
        <Sync
          value={
            {
              ...queries,
              browserServiceQuery: { data: { browserService: 'kernel' } },
            } as BotSettingsQueries
          }
        />
      );
    });
    expect(useBotSettingsDraftStore.getState().draft.browserService).toBe(
      'kernel'
    );
    expect(useBotSettingsDraftStore.getState().draft.nickname).toBe(
      'draft name'
    );
  });

  it('shows the active route, so a selection that did not take can be applied again', async () => {
    const queries = {
      ship: 'sampel-palnet',
      providerConfig,
      providerConfigQuery: { isSuccess: true },
      configQuery: { isSuccess: true, data: chatConfig },
      nicknameQuery: { isSuccess: true, data: '' },
      browserServiceQuery: {
        data: { browserService: 'kernel', active: 'steel', supported: true },
      },
    } as unknown as BotSettingsQueries;
    function Sync({ value }: { value: BotSettingsQueries }) {
      useSyncBotSettingsDraft(value);
      return null;
    }
    await act(async () => {
      renderer = create(<Sync value={queries} />);
    });
    const synced = useBotSettingsDraftStore.getState();
    expect(synced.baseline.browserService).toBe('steel');
    expect(synced.draft.browserService).toBe('steel');

    act(() => selectKernel());
    const state = useBotSettingsDraftStore.getState();
    expect(getPendingFields(state.baseline, state.draft).browserService).toBe(
      true
    );
  });

  it('protects a pending selection from background sync, and discards it explicitly', () => {
    selectKernel();
    useBotSettingsDraftStore.getState().syncServerValues('sampel-palnet', {
      ...EMPTY_VALUES,
      nickname: 'server',
    });
    expect(useBotSettingsDraftStore.getState().draft.browserService).toBe(
      'kernel'
    );
    useBotSettingsDraftStore.getState().discardChanges();
    expect(useBotSettingsDraftStore.getState().draft.browserService).toBe(
      'steel'
    );
    selectKernel();
    useBotSettingsDraftStore
      .getState()
      .syncServerValues('another-ship', EMPTY_VALUES);
    expect(useBotSettingsDraftStore.getState().draft.browserService).toBe(
      'steel'
    );
  });
});

import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import {
  DiaryMigrationDiscoveryNotifier,
  notifyDiaryMigrationDiscovery,
} from './diary-migration-discovery.js';
import { MIGRATION_DROP_WARNING } from './migrate-command.js';
import type { ApprovalCommandBridge } from './monitor/command-bridge.js';
import { removeBridge, setBridge } from './monitor/command-bridge.js';

type BlobEntry = {
  messages?: Array<{
    updateComponents?: {
      components?: Array<{
        component?: string;
        action?: {
          event?: {
            context?: {
              text?: string;
            };
          };
        };
      }>;
    };
  }>;
};

function actionCommand(blob: string): string | undefined {
  const [entry] = JSON.parse(blob) as BlobEntry[];
  const components = entry?.messages?.find(
    (message) => message.updateComponents
  )?.updateComponents?.components;
  return components?.find((component) => component.component === 'Button')
    ?.action?.event?.context?.text;
}

function makeNotifier(buildCard?: (command: string) => string) {
  return new DiaryMigrationDiscoveryNotifier({
    buildCard,
    notified: new Map(),
    inFlight: new Map(),
  });
}

function makeBridge(
  ownerShip: string | null,
  sendOwnerNotification: ApprovalCommandBridge['sendOwnerNotification'],
  getChannelTitle: (nest: string) => string | undefined = () => 'Field Notes'
): ApprovalCommandBridge {
  return {
    ownerShip,
    botShip: '~bot',
    botCredentials: {
      url: 'https://bot.example',
      ship: '~bot',
      code: 'code',
    },
    sendOwnerNotification,
    getChannelTitle,
  } as ApprovalCommandBridge;
}

function makeRunnableAccountConfig(...accountIds: string[]): OpenClawConfig {
  return {
    channels: {
      tlon: {
        accounts: Object.fromEntries(
          accountIds.map((accountId, index) => [
            accountId,
            {
              ship: `~discovery-test-${index}`,
              url: `https://discovery-test-${index}.example`,
              code: `code-${index}`,
            },
          ])
        ),
      },
    },
  } as OpenClawConfig;
}

describe('diary migration discovery notification', () => {
  it('sends one owner DM with literal text and a one-button migrate card', async () => {
    const notifier = makeNotifier();
    const send = vi.fn(async () => 'message-id');
    const nest = 'diary/~sampel-palnet/field-notes';

    await notifier.notify(nest, send, 'Field Notes');
    await notifier.notify(nest, send, 'Field Notes');

    expect(send).toHaveBeenCalledTimes(1);
    const [text, blob] = send.mock.calls[0]!;
    expect(text).toContain(`/migrate ${nest}`);
    expect(actionCommand(blob!)).toBe(`/migrate ${nest}`);
  });

  it('includes the migration command and drop warning in the owner DM', async () => {
    const notifier = makeNotifier();
    const send = vi.fn(async () => 'message-id');
    const nest = 'diary/~sampel-palnet/warning-before-action';

    await notifier.notify(nest, send, 'Field Notes');

    const [text] = send.mock.calls[0]!;
    expect(text).toContain(`/migrate ${nest}`);
    expect(text).toContain(MIGRATION_DROP_WARNING);
    expect(text).toContain('comments, reactions, post references');
  });

  it('still sends the literal text when card construction throws', async () => {
    const notifier = makeNotifier(() => {
      throw new Error('bad card');
    });
    const send = vi.fn(async () => 'message-id');
    const nest = 'diary/~zod/log';

    await notifier.notify(nest, send, 'Field Notes');

    expect(send).toHaveBeenCalledWith(
      expect.stringContaining(`/migrate ${nest}`),
      undefined
    );
  });

  it('deduplicates case and sigil variants of the same canonical nest', async () => {
    const notifier = makeNotifier();
    const send = vi.fn(async () => 'message-id');

    await notifier.notify('Diary/ZOD/Field-Notes', send, 'Field Notes');
    await notifier.notify('diary/~zod/Field-Notes', send, 'Field Notes');

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toContain(
      '/migrate diary/~zod/Field-Notes'
    );
  });

  it('silently skips notification when no monitor callback is registered', async () => {
    const notifier = makeNotifier();

    await expect(notifier.notify('diary/~zod/log', undefined)).resolves.toBe(
      false
    );
  });

  it('retries when the real bridge contract resolves undefined', async () => {
    const notifier = makeNotifier();
    const send = vi
      .fn<ApprovalCommandBridge['sendOwnerNotification']>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('message-id');
    const nest = 'diary/~zod/retry-after-send-failure';

    await expect(notifier.notify(nest, send)).resolves.toBe(false);
    await expect(notifier.notify(nest, send)).resolves.toBe(true);

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('matches a sole named bridge only to its bot or owner host', async () => {
    const send = vi.fn(async () => 'message-id');
    const bridge = makeBridge('~owner', send);
    const notifier = makeNotifier();
    setBridge('named-only-account', bridge);
    try {
      await expect(
        notifyDiaryMigrationDiscovery(
          'diary/~unrelated/account-wiring',
          makeRunnableAccountConfig('named-only-account'),
          notifier
        )
      ).resolves.toBe(false);
      await expect(
        notifyDiaryMigrationDiscovery(
          'diary/~bot/bot-hosted',
          makeRunnableAccountConfig('named-only-account'),
          notifier
        )
      ).resolves.toBe(true);
      await expect(
        notifyDiaryMigrationDiscovery(
          'diary/~owner/owner-hosted',
          makeRunnableAccountConfig('named-only-account'),
          notifier
        )
      ).resolves.toBe(true);
    } finally {
      removeBridge('named-only-account', bridge);
    }

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0]).toContain('/migrate diary/~bot/bot-hosted');
    expect(send.mock.calls[1]?.[0]).toContain(
      '/migrate diary/~owner/owner-hosted'
    );
  });

  it('sends a discovery DM with one runnable configured account and one bridge', async () => {
    const send = vi.fn(async () => 'message-id');
    const bridge = makeBridge('~owner', send, () => 'Field Notes');
    const notifier = makeNotifier();
    setBridge('one-account', bridge);
    try {
      await expect(
        notifyDiaryMigrationDiscovery(
          'diary/~bot/one-account',
          makeRunnableAccountConfig('one-account'),
          notifier
        )
      ).resolves.toBe(true);
    } finally {
      removeBridge('one-account', bridge);
    }

    expect(send).toHaveBeenCalledTimes(1);
    const [, blob] = send.mock.calls[0]!;
    expect(actionCommand(blob!)).toBe('/migrate diary/~bot/one-account');
  });

  it('does not re-offer an archived source through the production bridge', async () => {
    const send = vi.fn(async () => 'message-id');
    const bridge = makeBridge('~owner', send, () => 'Field Notes-ARCHIVE');
    const notifier = makeNotifier();
    setBridge('archived-account', bridge);
    try {
      await expect(
        notifyDiaryMigrationDiscovery(
          'diary/~bot/already-migrated',
          makeRunnableAccountConfig('archived-account'),
          notifier
        )
      ).resolves.toBe(true);
    } finally {
      removeBridge('archived-account', bridge);
    }

    expect(send).toHaveBeenCalledTimes(1);
    const [text, blob] = send.mock.calls[0]!;
    expect(text).not.toContain('/migrate');
    expect(blob).toBeUndefined();
  });

  it('does not offer an action when the existing title cache has no entry', async () => {
    const send = vi.fn(async () => 'message-id');
    const bridge = makeBridge('~owner', send, () => undefined);
    const notifier = makeNotifier();
    setBridge('uncached-account', bridge);
    try {
      await expect(
        notifyDiaryMigrationDiscovery(
          'diary/~bot/uncached',
          makeRunnableAccountConfig('uncached-account'),
          notifier
        )
      ).resolves.toBe(true);
    } finally {
      removeBridge('uncached-account', bridge);
    }

    expect(send).toHaveBeenCalledTimes(1);
    const [text, blob] = send.mock.calls[0]!;
    expect(text).not.toContain('/migrate');
    expect(blob).toBeUndefined();
  });

  it('sends no discovery DM with two runnable configured accounts and one bridge', async () => {
    const send = vi.fn(async () => 'message-id');
    const bridge = makeBridge('~owner', send);
    const notifier = makeNotifier();
    setBridge('first-account', bridge);
    try {
      await expect(
        notifyDiaryMigrationDiscovery(
          'diary/~bot/two-configured-accounts',
          makeRunnableAccountConfig('first-account', 'second-account'),
          notifier
        )
      ).resolves.toBe(false);
    } finally {
      removeBridge('first-account', bridge);
    }

    expect(send).not.toHaveBeenCalled();
  });

  it('sends a discovery DM with zero configured accounts and one env-backed bridge', async () => {
    const send = vi.fn(async () => 'message-id');
    const bridge = makeBridge('~owner', send);
    const notifier = makeNotifier();
    setBridge('env-account', bridge);
    try {
      await expect(
        notifyDiaryMigrationDiscovery(
          'diary/~bot/env-credentials',
          {} as OpenClawConfig,
          notifier
        )
      ).resolves.toBe(true);
    } finally {
      removeBridge('env-account', bridge);
    }

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends no discovery DM when multiple bridges have unique host matches', async () => {
    const firstSend = vi.fn(async () => 'first-message-id');
    const secondSend = vi.fn(async () => 'second-message-id');
    const first = makeBridge('~first-owner', firstSend);
    const second = {
      ...makeBridge('~second-owner', secondSend),
      botShip: '~second-bot',
    };
    const notifier = makeNotifier();
    setBridge('first-account', first);
    setBridge('second-account', second);
    try {
      await expect(
        notifyDiaryMigrationDiscovery(
          'diary/~second-bot/bot-hosted',
          makeRunnableAccountConfig('first-account'),
          notifier
        )
      ).resolves.toBe(false);
      await expect(
        notifyDiaryMigrationDiscovery(
          'diary/~first-owner/owner-hosted',
          makeRunnableAccountConfig('first-account'),
          notifier
        )
      ).resolves.toBe(false);
    } finally {
      removeBridge('first-account', first);
      removeBridge('second-account', second);
    }

    expect(firstSend).not.toHaveBeenCalled();
    expect(secondSend).not.toHaveBeenCalled();
  });

  it('skips silently when a multi-bridge host match is absent or ambiguous', async () => {
    const firstSend = vi.fn(async () => 'first-message-id');
    const secondSend = vi.fn(async () => 'second-message-id');
    const first = makeBridge('~shared-owner', firstSend);
    const second = {
      ...makeBridge('~shared-owner', secondSend),
      botShip: '~second-bot',
    };
    const notifier = makeNotifier();
    setBridge('first-ambiguous-account', first);
    setBridge('second-ambiguous-account', second);
    try {
      await expect(
        notifyDiaryMigrationDiscovery(
          'diary/~unmatched/no-account',
          makeRunnableAccountConfig('first-ambiguous-account'),
          notifier
        )
      ).resolves.toBe(false);
      await expect(
        notifyDiaryMigrationDiscovery(
          'diary/~shared-owner/two-accounts',
          makeRunnableAccountConfig('first-ambiguous-account'),
          notifier
        )
      ).resolves.toBe(false);
    } finally {
      removeBridge('first-ambiguous-account', first);
      removeBridge('second-ambiguous-account', second);
    }

    expect(firstSend).not.toHaveBeenCalled();
    expect(secondSend).not.toHaveBeenCalled();
  });

  it('returns silently when the monitor bridge or owner is absent', async () => {
    const notifier = makeNotifier();
    await expect(
      notifyDiaryMigrationDiscovery(
        'diary/~zod/absent-monitor',
        {} as OpenClawConfig,
        notifier
      )
    ).resolves.toBe(false);

    const send = vi.fn(async () => 'message-id');
    const bridge = makeBridge(null, send);
    setBridge('ownerless-account', bridge);
    try {
      await expect(
        notifyDiaryMigrationDiscovery(
          'diary/~zod/ownerless',
          {} as OpenClawConfig,
          notifier
        )
      ).resolves.toBe(false);
    } finally {
      removeBridge('ownerless-account', bridge);
    }
    expect(send).not.toHaveBeenCalled();
  });
});

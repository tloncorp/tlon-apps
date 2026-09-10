import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import {
  DiaryMigrationDiscoveryNotifier,
  notifyDiaryMigrationDiscovery,
} from './diary-migration-discovery.js';
import type { ApprovalCommandBridge } from './monitor/command-bridge.js';
import { removeBridge, setBridge } from './monitor/command-bridge.js';

type BlobEntry = {
  messages?: Array<{
    updateComponents?: {
      components?: Array<{
        id?: string;
        component?: string;
        text?: string;
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

function cardText(blob: string, id: string): string | undefined {
  const [entry] = JSON.parse(blob) as BlobEntry[];
  const components = entry?.messages?.find(
    (message) => message.updateComponents
  )?.updateComponents?.components;
  return components?.find((component) => component.id === id)?.text;
}

function makeNotifier(
  buildCard?: (command: string, opts?: { title?: string }) => string
) {
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
  it('sends one terse owner DM with a titled migrate card', async () => {
    const notifier = makeNotifier();
    const send = vi.fn(async () => 'message-id');
    const nest = 'diary/~sampel-palnet/field-notes';

    await notifier.notify(nest, send, 'Field Notes');
    await notifier.notify(nest, send, 'Field Notes');

    expect(send).toHaveBeenCalledTimes(1);
    const [text, blob] = send.mock.calls[0]!;
    expect({ text, lines: text.split(/\r?\n/) }).toEqual({
      text: 'Diary migration available for "Field Notes"',
      lines: ['Diary migration available for "Field Notes"'],
    });
    expect(actionCommand(blob!)).toBe(`/migrate ${nest}`);
    expect(cardText(blob!, 'title')).toBe('Migrate "Field Notes" to %notes?');
  });

  it('passes the channel title to the card builder', async () => {
    const buildCard = vi.fn(() => 'card');
    const notifier = makeNotifier(buildCard);
    const send = vi.fn(async () => 'message-id');
    const nest = 'diary/~sampel-palnet/title-context';
    const command = `/migrate ${nest}`;

    await notifier.notify(nest, send, 'Field Notes');

    expect(buildCard).toHaveBeenCalledWith(command, { title: 'Field Notes' });
  });

  it('still sends the literal text when card construction throws', async () => {
    const notifier = makeNotifier(() => {
      throw new Error('bad card');
    });
    const send = vi.fn(async () => 'message-id');
    const nest = 'diary/~zod/log';

    await notifier.notify(nest, send, 'Field Notes');

    // The card normally carries the command. With no card, the text must, or
    // the owner gets a dead-end DM and `notified` blocks every retry.
    expect(send).toHaveBeenCalledWith(
      'Diary migration available for "Field Notes" — to migrate, type `/migrate diary/~zod/log`',
      undefined
    );
  });

  it('keeps the terse body when the card builds', async () => {
    const notifier = makeNotifier();
    const send = vi.fn(async () => 'message-id');

    await notifier.notify('diary/~zod/log', send, 'Field Notes');

    expect(send.mock.calls[0]?.[0]).toBe(
      'Diary migration available for "Field Notes"'
    );
    expect(send.mock.calls[0]?.[1]).toBeDefined();
  });

  it('deduplicates case and sigil variants of the same canonical nest', async () => {
    const notifier = makeNotifier();
    const send = vi.fn(async () => 'message-id');

    await notifier.notify('Diary/ZOD/Field-Notes', send, 'Field Notes');
    await notifier.notify('diary/~zod/Field-Notes', send, 'Field Notes');

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toBe(
      'Diary migration available for "Field Notes"'
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

    await expect(notifier.notify(nest, send, 'Field Notes')).resolves.toBe(
      false
    );
    await expect(notifier.notify(nest, send, 'Field Notes')).resolves.toBe(
      true
    );

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
    expect(actionCommand(send.mock.calls[0]?.[1] ?? '')).toBe(
      '/migrate diary/~bot/bot-hosted'
    );
    expect(actionCommand(send.mock.calls[1]?.[1] ?? '')).toBe(
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
    // The remedy is the point of this message: a diary can carry the suffix
    // without having been migrated, and its owner has no terminal. Without
    // this assertion the notice can silently decay back to naming only the
    // problem.
    expect(text).toContain('rename the channel');
  });

  it('stays silent while the title is uncached, then offers the card once it resolves', async () => {
    const send = vi.fn(async () => 'message-id');
    let sourceTitle: string | undefined;
    const bridge = makeBridge('~owner', send, () => sourceTitle);
    const notifier = makeNotifier();
    const nest = 'diary/~bot/uncached';
    setBridge('uncached-account', bridge);
    try {
      const firstResult = await notifyDiaryMigrationDiscovery(
        nest,
        makeRunnableAccountConfig('uncached-account'),
        notifier
      );
      expect.soft(firstResult).toBe(false);
      expect.soft(send).not.toHaveBeenCalled();

      const secondResult = await notifyDiaryMigrationDiscovery(
        nest,
        makeRunnableAccountConfig('uncached-account'),
        notifier
      );
      expect.soft(secondResult).toBe(false);
      expect.soft(send).not.toHaveBeenCalled();

      sourceTitle = 'Field Notes';
      const resolvedResult = await notifyDiaryMigrationDiscovery(
        nest,
        makeRunnableAccountConfig('uncached-account'),
        notifier
      );
      expect.soft(resolvedResult).toBe(true);
      expect.soft(send).toHaveBeenCalledTimes(1);
      const [text, blob] = send.mock.calls[0] ?? [];
      expect.soft(text).toBe('Diary migration available for "Field Notes"');
      expect.soft(blob).toBeDefined();
      expect
        .soft(blob ? actionCommand(blob) : undefined)
        .toBe(`/migrate ${nest}`);

      await expect(
        notifyDiaryMigrationDiscovery(
          nest,
          makeRunnableAccountConfig('uncached-account'),
          notifier
        )
      ).resolves.toBe(false);
      expect.soft(send).toHaveBeenCalledTimes(1);
    } finally {
      removeBridge('uncached-account', bridge);
    }
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

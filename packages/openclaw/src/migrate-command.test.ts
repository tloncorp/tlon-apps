import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MIGRATION_APPLY_TIMEOUT_MS,
  MIGRATION_CLEANUP_TIMEOUT_MS,
  MIGRATION_DROP_WARNING,
  MIGRATION_SINGLE_ACCOUNT_REQUIRED,
  type MigrateCommandDeps,
  createMigrateCommandHandler,
  formatMigrationCommandFailure,
  parseMigrateCommand,
  routeMigrateCommand,
} from './migrate-command.js';
import {
  type ApprovalCommandBridge,
  removeBridge,
  setBridge,
} from './monitor/command-bridge.js';
import {
  type TlonMigrationReportInput,
  setMigrationTelemetryReporter,
} from './telemetry.js';

function makeBridge(
  options: {
    botShip?: string;
    ownerShip?: string;
    botCredentials?: { url: string; ship: string; code: string };
  } = {}
): ApprovalCommandBridge {
  const botShip = options.botShip ?? '~bot';
  return {
    botShip,
    botCredentials: options.botCredentials ?? {
      url: 'https://bot.test',
      ship: botShip,
      code: 'bot-code',
    },
    ownerShip: options.ownerShip ?? '~owner',
    sendOwnerNotification: vi.fn(async () => 'message-id'),
    handleAction: async () => 'ok',
    getPendingApprovalsReply: async () => ({ text: 'none' }),
    getBlockedList: async () => 'none',
    handleUnblock: async () => 'ok',
    isOwnedChannel: () => false,
    getOwnerListenGlobal: () => true,
    setOwnerListenGlobal: async (enabled) => enabled,
    isOwnerListenDisabled: () => false,
    setOwnerListenDisabled: async (_nest, disabled) => !disabled,
    listOwnerListenDisabled: () => [],
  };
}

const registeredBridges: Array<{
  accountId: string;
  bridge: ApprovalCommandBridge;
}> = [];

function registerBridge(
  accountId: string,
  bridge: ApprovalCommandBridge
): void {
  setBridge(accountId, bridge);
  registeredBridges.push({ accountId, bridge });
}

function makeRunnableAccountConfig(...accountIds: string[]): OpenClawConfig {
  return {
    channels: {
      tlon: {
        accounts: Object.fromEntries(
          accountIds.map((accountId, index) => [
            accountId,
            {
              ship: `~migration-test-${index}`,
              url: `https://migration-test-${index}.example`,
              code: `code-${index}`,
            },
          ])
        ),
      },
    },
  } as OpenClawConfig;
}

afterEach(() => {
  for (const { accountId, bridge } of registeredBridges) {
    removeBridge(accountId, bridge);
  }
  registeredBridges.length = 0;
});

function makeHarness(
  outputs: Array<string | Error> = [],
  options: Pick<MigrateCommandDeps, 'buildMigrateCard' | 'logError'> = {}
) {
  const tasks: Array<() => Promise<void>> = [];
  const runCommand = vi.fn(async () => {
    const next = outputs.shift() ?? '';
    if (next instanceof Error) throw next;
    return next;
  });
  const handler = createMigrateCommandHandler({
    runCommand,
    spawnTask: (task) => tasks.push(task),
    applyInFlight: new Map(),
    cleanupInFlight: new Map(),
    ...options,
  });
  return { handler, runCommand, tasks };
}

type SerializedCard = Array<{
  messages: Array<{
    updateComponents?: {
      components: Array<{
        id: string;
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
}>;

function parseMigrateCard(blob: string | undefined): {
  command: string | undefined;
  label: string | undefined;
} {
  if (!blob) throw new Error('expected migration card blob');
  const [entry] = JSON.parse(blob) as SerializedCard;
  const components = entry?.messages.find((message) => message.updateComponents)
    ?.updateComponents?.components;
  return {
    command: components?.find((component) => component.id === 'action')?.action
      ?.event?.context?.text,
    label: components?.find((component) => component.id === 'actionLabel')
      ?.text,
  };
}

function expectDropWarning(text: string): void {
  expect(text).toContain(
    'comments, reactions, post references, and link blocks stay on the archived channel and are not copied'
  );
  expect(text).toContain(
    'Post descriptions, covers, and attachments also stay in the archive and are not copied'
  );
  expect(text).toContain('Group mentions become plain text');
  expect(text).toContain(
    'Every migrated note will show the acting ship as its author'
  );
  expect(text).toContain('Migrated notes are dated at import time');
  expect(text).toContain(
    'Note order follows the import, not the original post dates'
  );
  expect(text).toContain(
    'source channel stays intact, remains writable, and is renamed with an `-ARCHIVE` suffix'
  );
}

describe('parseMigrateCommand', () => {
  it('canonicalizes diary and notes nests', () => {
    expect(parseMigrateCommand('Diary/BOT/Field-Notes')).toEqual({
      kind: 'migrate',
      nest: 'diary/~bot/Field-Notes',
      allowWriteWidening: false,
    });
    expect(parseMigrateCommand('cleanup notes/BOT/Field-Notes')).toEqual({
      kind: 'cleanup',
      nest: 'notes/~bot/Field-Notes',
    });
  });

  it('rejects confirm, unsupported flags, and wrong nest kinds', () => {
    expect(parseMigrateCommand('confirm diary/~bot/log')).toHaveProperty(
      'error'
    );
    expect(parseMigrateCommand('notes/~bot/log')).toHaveProperty('error');
    expect(
      parseMigrateCommand('diary/~bot/log --allow-write-widening --extra')
    ).toHaveProperty('error');
  });
});

describe('OpenClaw migration command', () => {
  it('proceeds through the selected bridge with one runnable account', async () => {
    const h = makeHarness(['Migration complete.\n']);
    const bridge = makeBridge();
    registerBridge('only-account', bridge);

    const reply = await routeMigrateCommand(
      {
        accountId: 'only-account',
        senderId: '~owner',
      },
      'diary/~bot/bulletin',
      h.handler,
      makeRunnableAccountConfig('only-account')
    );

    expect(reply).toContain('Migration started');
    await h.tasks.shift()?.();
    expect(h.runCommand).toHaveBeenCalledTimes(1);
  });

  it('refuses two registered bridges even when config has one runnable account', async () => {
    const runCommand = vi.fn(async () => 'unexpected');
    const handler = createMigrateCommandHandler({
      runCommand,
      spawnTask: (task) => void task(),
      applyInFlight: new Map(),
      cleanupInFlight: new Map(),
    });
    registerBridge('first-account', makeBridge());
    registerBridge('second-account', makeBridge({ botShip: '~other-bot' }));

    const reply = await routeMigrateCommand(
      {
        accountId: 'first-account',
        senderId: '~owner',
      },
      'cleanup notes/~bot/bulletin',
      handler,
      makeRunnableAccountConfig('first-account')
    );

    expect(runCommand).not.toHaveBeenCalled();
    expect(reply).toBe(MIGRATION_SINGLE_ACCOUNT_REQUIRED);
    expect(reply).toContain('single-account configuration');
  });

  it('refuses two runnable configured accounts when only one bridge is registered', async () => {
    const runCommand = vi.fn(async () => 'unexpected');
    const handler = createMigrateCommandHandler({
      runCommand,
      spawnTask: (task) => void task(),
      applyInFlight: new Map(),
      cleanupInFlight: new Map(),
    });
    registerBridge('first-account', makeBridge());

    const reply = await routeMigrateCommand(
      {
        accountId: 'first-account',
        senderId: '~owner',
      },
      'diary/~bot/bulletin',
      handler,
      makeRunnableAccountConfig('first-account', 'second-account')
    );

    expect(runCommand).not.toHaveBeenCalled();
    expect(reply).toBe(MIGRATION_SINGLE_ACCOUNT_REQUIRED);
  });

  it('allows an env-credential deployment with zero configured accounts and one bridge', async () => {
    const h = makeHarness(['Migration complete.\n']);
    const bridge = makeBridge();
    registerBridge('env-account', bridge);

    const reply = await routeMigrateCommand(
      {
        accountId: 'env-account',
        senderId: '~owner',
      },
      'diary/~bot/env-credentials',
      h.handler,
      {} as OpenClawConfig
    );

    expect(reply).toContain('Migration started');
    await h.tasks.shift()?.();
    expect(h.runCommand).toHaveBeenCalledTimes(1);
  });

  it('constructs the drop-warning ack before the queued apply task runs and never plans', async () => {
    const h = makeHarness(['Migration complete.\n']);
    const bridge = makeBridge();

    // The injected queue proves construction order only; delivery ordering is not covered.
    const ack = await h.handler(bridge, 'diary/~bot/bulletin');
    expect(ack).toContain('Migration started');
    expectDropWarning(ack);
    expect(ack).toContain(MIGRATION_DROP_WARNING);
    expect(h.runCommand).not.toHaveBeenCalled();

    await h.tasks.shift()?.();
    expect(h.runCommand).toHaveBeenCalledWith(
      ['notes', 'migrate-apply', 'diary/~bot/bulletin', '--yes'],
      { url: 'https://bot.test', ship: '~bot', code: 'bot-code' },
      MIGRATION_APPLY_TIMEOUT_MS,
      expect.any(Function)
    );
    expect(h.runCommand.mock.calls.flat(2)).not.toContain('migrate-plan');
    expect(bridge.sendOwnerNotification).toHaveBeenCalledWith(
      'Migration complete.\n'
    );
  });

  it('passes widening acceptance straight to migrate-apply', async () => {
    const h = makeHarness(['Migration complete.\n']);
    const bridge = makeBridge();

    await h.handler(bridge, 'diary/~bot/log --allow-write-widening');
    await h.tasks.shift()?.();

    expect(h.runCommand).toHaveBeenCalledWith(
      [
        'notes',
        'migrate-apply',
        'diary/~bot/log',
        '--yes',
        '--allow-write-widening',
      ],
      { url: 'https://bot.test', ship: '~bot', code: 'bot-code' },
      MIGRATION_APPLY_TIMEOUT_MS,
      expect.any(Function)
    );
  });

  it('runs one concurrent apply for the same canonical nest and notifies the second caller', async () => {
    let finish!: (output: string) => void;
    const runCommand = vi.fn(
      () => new Promise<string>((resolve) => (finish = resolve))
    );
    const tasks: Array<() => Promise<void>> = [];
    const handler = createMigrateCommandHandler({
      runCommand,
      spawnTask: (task) => tasks.push(task),
      applyInFlight: new Map(),
      cleanupInFlight: new Map(),
    });
    const bridge = makeBridge({ botShip: '~zod' });

    await handler(bridge, 'DIARY/~Zod/Log');
    const firstTask = tasks.shift()?.();
    const secondReply = await handler(bridge, 'diary/~zod/Log');

    expect(secondReply).toBe(
      'A migration for diary/~zod/Log is already running.'
    );
    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(bridge.sendOwnerNotification).toHaveBeenCalledWith(
      'A migration for diary/~zod/Log is already running.'
    );
    finish('done');
    await firstTask;
  });

  it('refuses cleanup without a card while any migration is running, then allows it after completion', async () => {
    let finishApply!: (output: string) => void;
    const runCommand = vi.fn((args: string[]) => {
      if (args.includes('migrate-apply')) {
        return new Promise<string>((resolve) => {
          finishApply = resolve;
        });
      }
      return Promise.resolve('Cleanup complete.\n');
    });
    const tasks: Array<() => Promise<void>> = [];
    const buildMigrateCard = vi.fn(() => 'unexpected');
    const handler = createMigrateCommandHandler({
      runCommand,
      spawnTask: (task) => tasks.push(task),
      applyInFlight: new Map(),
      cleanupInFlight: new Map(),
      buildMigrateCard,
    });
    const bridge = makeBridge();

    await handler(bridge, 'diary/~bot/unrelated');
    const applyTask = tasks.shift()?.();
    expect(runCommand).toHaveBeenCalledTimes(1);

    const refusal =
      'A migration is currently running. Wait for it to finish, then retry the cleanup.';
    try {
      await expect(handler(bridge, 'cleanup notes/~bot/log')).resolves.toBe(
        refusal
      );
      expect(tasks).toHaveLength(0);
      expect(runCommand).toHaveBeenCalledTimes(1);
      expect(runCommand.mock.calls[0]?.[0]).toEqual([
        'notes',
        'migrate-apply',
        'diary/~bot/unrelated',
        '--yes',
      ]);
      expect(bridge.sendOwnerNotification).toHaveBeenCalledWith(refusal);
      expect(vi.mocked(bridge.sendOwnerNotification).mock.calls[0]).toEqual([
        refusal,
      ]);
      expect(buildMigrateCard).not.toHaveBeenCalled();
    } finally {
      finishApply('Migration complete.\n');
      await applyTask;
    }

    const cleanupReply = await handler(bridge, 'cleanup notes/~bot/log');
    expect(cleanupReply).toBe(
      'Cleanup started for notes/~bot/log. I’ll DM the result.'
    );
    expect(tasks).toHaveLength(1);
    await tasks.shift()?.();
    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(runCommand.mock.calls[1]?.[0]).toEqual([
      'notes',
      'notebook-delete',
      'notes/~bot/log',
      '--yes',
    ]);
  });

  it('refuses migration without a card while any cleanup is running, then allows it after completion', async () => {
    let finishCleanup!: (output: string) => void;
    const runCommand = vi.fn((args: string[]) => {
      if (args.includes('notebook-delete')) {
        return new Promise<string>((resolve) => {
          finishCleanup = resolve;
        });
      }
      return Promise.resolve('Migration complete.\n');
    });
    const tasks: Array<() => Promise<void>> = [];
    const buildMigrateCard = vi.fn(() => 'unexpected');
    const handler = createMigrateCommandHandler({
      runCommand,
      spawnTask: (task) => tasks.push(task),
      applyInFlight: new Map(),
      cleanupInFlight: new Map(),
      buildMigrateCard,
    });
    const bridge = makeBridge();

    await handler(bridge, 'cleanup notes/~bot/unrelated');
    const cleanupTask = tasks.shift()?.();
    expect(runCommand).toHaveBeenCalledTimes(1);

    const refusal =
      'A migration cleanup is currently running. Wait for it to finish, then retry the migration.';
    try {
      await expect(handler(bridge, 'diary/~bot/log')).resolves.toBe(refusal);
      expect(tasks).toHaveLength(0);
      expect(runCommand).toHaveBeenCalledTimes(1);
      expect(runCommand.mock.calls[0]?.[0]).toEqual([
        'notes',
        'notebook-delete',
        'notes/~bot/unrelated',
        '--yes',
      ]);
      expect(bridge.sendOwnerNotification).toHaveBeenCalledWith(refusal);
      expect(vi.mocked(bridge.sendOwnerNotification).mock.calls[0]).toEqual([
        refusal,
      ]);
      expect(buildMigrateCard).not.toHaveBeenCalled();
    } finally {
      finishCleanup('Cleanup complete.\n');
      await cleanupTask;
    }

    const migrationReply = await handler(bridge, 'diary/~bot/log');
    expect(migrationReply).toContain('Migration started');
    expect(tasks).toHaveLength(1);
    await tasks.shift()?.();
    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(runCommand.mock.calls[1]?.[0]).toEqual([
      'notes',
      'migrate-apply',
      'diary/~bot/log',
      '--yes',
    ]);
  });

  it.each([
    {
      keyspace: 'apply',
      first: 'diary/~bot/Field-Notes',
      second: 'diary/~bot/field-notes',
    },
    {
      keyspace: 'cleanup',
      first: 'cleanup notes/~bot/Field-Notes',
      second: 'cleanup notes/~bot/field-notes',
    },
  ])(
    'runs case-distinct channel names concurrently in the $keyspace keyspace',
    async ({ first, second }) => {
      const h = makeHarness(['done', 'done']);
      const bridge = makeBridge();

      await h.handler(bridge, first);
      await h.handler(bridge, second);

      expect(h.tasks).toHaveLength(2);
      await Promise.all(h.tasks.map((task) => task()));
      expect(h.runCommand).toHaveBeenCalledTimes(2);
    }
  );

  it('folds cleanup prefix and host case without folding channel case', async () => {
    let finish!: (output: string) => void;
    const runCommand = vi.fn(
      () => new Promise<string>((resolve) => (finish = resolve))
    );
    const tasks: Array<() => Promise<void>> = [];
    const handler = createMigrateCommandHandler({
      runCommand,
      spawnTask: (task) => tasks.push(task),
      applyInFlight: new Map(),
      cleanupInFlight: new Map(),
    });
    const bridge = makeBridge({ botShip: '~zod' });

    await handler(bridge, 'cleanup NOTES/~Zod/Log');
    const firstTask = tasks.shift()?.();
    const secondReply = await handler(bridge, 'cleanup notes/~zod/Log');

    expect(secondReply).toBe(
      'A migration cleanup for notes/~zod/Log is already running.'
    );
    expect(runCommand).toHaveBeenCalledTimes(1);
    finish('done');
    await firstTask;
  });

  it('runs concurrent applies for different nests', async () => {
    const tasks: Array<() => Promise<void>> = [];
    const runCommand = vi.fn(async () => 'done');
    const handler = createMigrateCommandHandler({
      runCommand,
      spawnTask: (task) => tasks.push(task),
      applyInFlight: new Map(),
      cleanupInFlight: new Map(),
    });
    const bridge = makeBridge();

    await handler(bridge, 'diary/~bot/one');
    await handler(bridge, 'diary/~bot/two');
    expect(tasks).toHaveLength(2);
    await Promise.all(tasks.map((task) => task()));
    expect(runCommand).toHaveBeenCalledTimes(2);
  });

  it('releases a failed apply so it can be retried', async () => {
    const h = makeHarness([new Error('failed'), 'done']);
    const bridge = makeBridge();

    await h.handler(bridge, 'diary/~bot/log');
    await h.tasks.shift()?.();
    await h.handler(bridge, 'diary/~bot/log');
    await h.tasks.shift()?.();

    expect(h.runCommand).toHaveBeenCalledTimes(2);
  });

  it('cards a widening refusal with the exact re-run command and literal fallback', async () => {
    const refusal =
      'Migration would widen write access: readers would gain write access. Refusing without explicit acceptance — pass --allow-write-widening to accept.\n';
    const failure = Object.assign(new Error(refusal.trim()), {
      stderr: refusal,
    });
    const h = makeHarness([failure]);
    const bridge = makeBridge();

    const ack = await h.handler(bridge, 'diary/~bot/log');
    expectDropWarning(ack);
    expect(h.runCommand).not.toHaveBeenCalled();
    await h.tasks.shift()?.();

    const [message, blob] = vi.mocked(bridge.sendOwnerNotification).mock
      .calls[0]!;
    const command = '/migrate diary/~bot/log --allow-write-widening';
    expect(message).toContain(refusal.trim());
    expect(message).toContain(command);
    expect(message).toContain('every reader will become an editor');
    expect(parseMigrateCard(blob)).toEqual({
      command,
      label: 'Accept widening and proceed — every reader becomes an editor',
    });
  });

  it('cards the authoritative created target instead of an earlier nest-shaped title', async () => {
    const failure = Object.assign(new Error('Import failed'), {
      stdout:
        'Creating %notes channel "notes/~bot/victim" in ~bot/group...\n' +
        'Target notebook created: notes/~bot/actual\n',
    });
    const h = makeHarness([failure]);
    const bridge = makeBridge();

    await h.handler(bridge, 'diary/~bot/log');
    await h.tasks.shift()?.();

    const [message, blob] = vi.mocked(bridge.sendOwnerNotification).mock
      .calls[0]!;
    const command = '/migrate cleanup notes/~bot/actual';
    expect(message).toContain(command);
    expect(message).not.toContain('/migrate cleanup notes/~bot/victim');
    expect(parseMigrateCard(blob)).toEqual({
      command,
      label: 'Delete notebook',
    });
  });

  it('cards a target carried only by the CLI notebook-delete recovery instruction', async () => {
    const failure = new Error(
      'Import failed\nThe target notebook exists. run `tlon notes notebook-delete notes/~bot/actual --yes`, then retry with `tlon notes migrate-apply <diary-nest> --yes`.'
    );
    const h = makeHarness([failure]);
    const bridge = makeBridge();

    await h.handler(bridge, 'diary/~bot/log');
    await h.tasks.shift()?.();

    const [message, blob] = vi.mocked(bridge.sendOwnerNotification).mock
      .calls[0]!;
    const command = '/migrate cleanup notes/~bot/actual';
    expect(message).toContain(command);
    expect(parseMigrateCard(blob)).toEqual({
      command,
      label: 'Delete notebook',
    });
  });

  it('sends an uncarded deadline DM and keeps the same-nest guard until completion', async () => {
    let finish!: (output: string) => void;
    let onDeadline: Parameters<MigrateCommandDeps['runCommand']>[3];
    const runCommand = vi.fn(
      (...args: Parameters<MigrateCommandDeps['runCommand']>) => {
        onDeadline = args[3];
        return new Promise<string>((resolve) => {
          finish = resolve;
        });
      }
    );
    const tasks: Array<() => Promise<void>> = [];
    const buildMigrateCard = vi.fn(() => 'unexpected');
    const handler = createMigrateCommandHandler({
      runCommand,
      spawnTask: (task) => tasks.push(task),
      applyInFlight: new Map(),
      cleanupInFlight: new Map(),
      buildMigrateCard,
    });
    const bridge = makeBridge();

    await handler(bridge, 'diary/~bot/log');
    const firstTask = tasks.shift()?.();
    expect(onDeadline).toEqual(expect.any(Function));
    onDeadline?.({
      stdout:
        'Creating %notes channel "notes/~bot/victim" in ~bot/group...\n' +
        'Target notebook created: notes/~bot/field-notes\n',
      stderr: '',
    });

    await vi.waitFor(() =>
      expect(bridge.sendOwnerNotification).toHaveBeenCalledTimes(1)
    );
    const deadlineCall = vi.mocked(bridge.sendOwnerNotification).mock.calls[0]!;
    expect(deadlineCall).toHaveLength(1);
    expect(deadlineCall[0]).toContain('No migration result has arrived yet');
    expect(deadlineCall[0]).toContain('may still be running');
    expect(deadlineCall[0]).toContain('Do not retry');
    expect(deadlineCall[0]).toContain('`notes/~bot/field-notes`');
    expect(deadlineCall[0]).not.toContain('`notes/~bot/victim`');
    expect(deadlineCall[0]).not.toContain('/migrate cleanup');
    expect(deadlineCall[0]).not.toContain('--allow-write-widening');
    expect(buildMigrateCard).not.toHaveBeenCalled();

    await expect(handler(bridge, 'diary/~bot/log')).resolves.toBe(
      'A migration for diary/~bot/log is already running.'
    );
    expect(runCommand).toHaveBeenCalledTimes(1);

    finish('Migration complete.\n');
    await firstTask;
    expect(bridge.sendOwnerNotification).toHaveBeenLastCalledWith(
      'Migration complete.\n'
    );
  });

  it.each([
    {
      path: 'apply',
      command: 'diary/~bot/log',
      completion: 'Migration complete.\n',
    },
    {
      path: 'cleanup',
      command: 'cleanup notes/~bot/log',
      completion: 'Cleanup complete.\n',
    },
  ])(
    'delivers the $path deadline notification before an immediate completion',
    async ({ command, completion }) => {
      const delivered: string[] = [];
      let releaseDeadline!: () => void;
      const deadlineSend = new Promise<string>((resolve) => {
        releaseDeadline = () => {
          delivered.push('deadline');
          resolve('deadline-message-id');
        };
      });
      const bridge = makeBridge();
      vi.mocked(bridge.sendOwnerNotification).mockImplementation((message) => {
        if (message.startsWith('No migration result has arrived yet')) {
          return deadlineSend;
        }
        delivered.push('completion');
        return Promise.resolve('completion-message-id');
      });
      const runCommand = vi.fn(
        async (...args: Parameters<MigrateCommandDeps['runCommand']>) => {
          args[3]?.({ stdout: '', stderr: '' });
          return completion;
        }
      );
      const tasks: Array<() => Promise<void>> = [];
      const handler = createMigrateCommandHandler({
        runCommand,
        spawnTask: (task) => tasks.push(task),
        applyInFlight: new Map(),
        cleanupInFlight: new Map(),
      });

      await handler(bridge, command);
      const runningTask = tasks.shift()?.();
      await vi.waitFor(() =>
        expect(bridge.sendOwnerNotification).toHaveBeenCalled()
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const messagesBeforeDeadlineDelivered = vi
        .mocked(bridge.sendOwnerNotification)
        .mock.calls.map(([message]) => message);

      releaseDeadline();
      await runningTask;

      expect(messagesBeforeDeadlineDelivered).toHaveLength(1);
      expect(delivered).toEqual(['deadline', 'completion']);
      expect(bridge.sendOwnerNotification).toHaveBeenLastCalledWith(completion);
    }
  );

  it('ignores a free-form nest when an unknown create outcome has no target marker', async () => {
    const failureText =
      'Create failed for requested title "notes/~bot/victim"\n' +
      'Notebook creation may or may not have landed.';
    const failure = Object.assign(new Error(failureText), {
      stderr: failureText,
    });
    const buildMigrateCard = vi.fn(() => 'unexpected');
    const h = makeHarness([failure], { buildMigrateCard });
    const bridge = makeBridge();

    await h.handler(bridge, 'diary/~bot/log');
    await h.tasks.shift()?.();

    const call = vi.mocked(bridge.sendOwnerNotification).mock.calls[0]!;
    expect(call).toHaveLength(1);
    expect(call[0]).toContain('requested title in the bot ship’s Notes web UI');
    expect(call[0]).not.toContain('/migrate cleanup notes/~bot/victim');
    expect(buildMigrateCard).not.toHaveBeenCalled();
  });

  it('still delivers widening text when card building throws', async () => {
    const refusal =
      'Migration would widen write access. Pass --allow-write-widening to accept.';
    const failure = Object.assign(new Error(refusal), { stderr: refusal });
    const logError = vi.fn();
    const h = makeHarness([failure], {
      buildMigrateCard: () => {
        throw new Error('card failed');
      },
      logError,
    });
    const bridge = makeBridge();

    await h.handler(bridge, 'diary/~bot/log');
    await h.tasks.shift()?.();

    const call = vi.mocked(bridge.sendOwnerNotification).mock.calls[0]!;
    expect(call).toHaveLength(1);
    expect(call[0]).toContain('/migrate diary/~bot/log --allow-write-widening');
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('card failed')
    );
  });

  it('logs an undelivered failure with the target nest and exact recovery command', async () => {
    const failure = Object.assign(new Error('Import failed'), {
      stdout: 'Target notebook created: notes/~bot/field-notes\n',
    });
    const logError = vi.fn();
    const h = makeHarness([failure], { logError });
    const bridge = makeBridge();
    vi.mocked(bridge.sendOwnerNotification).mockResolvedValue(undefined);

    await h.handler(bridge, 'diary/~bot/log');
    await h.tasks.shift()?.();

    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('target nest: notes/~bot/field-notes')
    );
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining(
        'recovery command: /migrate cleanup notes/~bot/field-notes'
      )
    );
  });

  it('uses the selected account bridge credentials for different bot ships', async () => {
    const h = makeHarness(['done', 'done']);
    const firstBridge = makeBridge({
      botShip: '~bot-one',
      botCredentials: {
        url: 'https://bot-one.test',
        ship: '~bot-one',
        code: 'bot-one-code',
      },
    });
    const secondBridge = makeBridge({
      botShip: '~bot-two',
      botCredentials: {
        url: 'https://bot-two.test',
        ship: '~bot-two',
        code: 'bot-two-code',
      },
    });

    await h.handler(firstBridge, 'diary/~bot-one/log');
    await h.tasks.shift()?.();
    await h.handler(secondBridge, 'diary/~bot-two/log');
    await h.tasks.shift()?.();

    expect(h.runCommand.mock.calls[0]?.[1]).toEqual({
      url: 'https://bot-one.test',
      ship: '~bot-one',
      code: 'bot-one-code',
    });
    expect(h.runCommand.mock.calls[1]?.[1]).toEqual({
      url: 'https://bot-two.test',
      ship: '~bot-two',
      code: 'bot-two-code',
    });
  });

  it('derives owner config from TLON_SKILL_DIR and applies directly', async () => {
    const tasks: Array<() => Promise<void>> = [];
    const runCommand = vi.fn(async () => 'done');
    const handler = createMigrateCommandHandler({
      runCommand,
      env: {
        TLON_SKILL_DIR: '/opt/tlon-skill',
        TLON_OWNER_CONFIG_PATH: '/wrong/owner.json',
      },
      fileExists: (path) => path === '/opt/tlon-skill/ships/owner.json',
      spawnTask: (task) => tasks.push(task),
    });

    await handler(makeBridge(), 'diary/~owner/log');
    await tasks.shift()?.();
    expect(runCommand).toHaveBeenCalledWith(
      [
        '--config',
        '/opt/tlon-skill/ships/owner.json',
        'notes',
        'migrate-apply',
        'diary/~owner/log',
        '--yes',
      ],
      undefined,
      MIGRATION_APPLY_TIMEOUT_MS,
      expect.any(Function)
    );
  });

  it('cards an owner-hosted known-target failure with its cleanup command', async () => {
    const tasks: Array<() => Promise<void>> = [];
    const failure = Object.assign(new Error('Import failed'), {
      stdout: 'Target notebook created: notes/~owner/log\n',
    });
    const runCommand = vi.fn(async () => {
      throw failure;
    });
    const handler = createMigrateCommandHandler({
      runCommand,
      env: { TLON_SKILL_DIR: '/opt/tlon-skill' },
      fileExists: (path) => path === '/opt/tlon-skill/ships/owner.json',
      spawnTask: (task) => tasks.push(task),
    });
    const bridge = makeBridge();

    await handler(bridge, 'diary/~owner/log');
    await tasks.shift()?.();

    const [message, blob] = vi.mocked(bridge.sendOwnerNotification).mock
      .calls[0]!;
    const command = '/migrate cleanup notes/~owner/log';
    expect(message).toContain(command);
    expect(parseMigrateCard(blob)).toEqual({
      command,
      label: 'Delete notebook',
    });
  });

  it('refuses a foreign host and names it', async () => {
    const h = makeHarness();
    const reply = await h.handler(makeBridge(), 'diary/~nec/log');
    expect(reply).toContain('~nec');
    expect(reply).toContain('hosts the diary');
    expect(h.tasks).toHaveLength(0);
  });

  it('runs owner cleanup through notebook-delete without weakening the tool guard', async () => {
    const h = makeHarness(['Deleted notes/~bot/log\n']);
    const bridge = makeBridge();
    const ack = await h.handler(bridge, 'cleanup notes/~bot/log');
    expect(ack).toContain('Cleanup started');
    await h.tasks.shift()?.();
    expect(h.runCommand).toHaveBeenCalledWith(
      ['notes', 'notebook-delete', 'notes/~bot/log', '--yes'],
      { url: 'https://bot.test', ship: '~bot', code: 'bot-code' },
      MIGRATION_CLEANUP_TIMEOUT_MS,
      expect.any(Function)
    );
  });

  it('reports a deleted notebook while its old group listing is still present', async () => {
    const partialCleanup =
      'Notebook deleted; group cleanup unconfirmed for notes/~bot/log: its old group listing is still present. Wait a few seconds before retrying the migration.';
    const failure = Object.assign(new Error('Command failed'), {
      stderr: partialCleanup,
    });
    const buildMigrateCard = vi.fn(() => 'unexpected');
    const h = makeHarness([failure], { buildMigrateCard });
    const bridge = makeBridge();

    await h.handler(bridge, 'cleanup notes/~bot/log');
    await h.tasks.shift()?.();

    const call = vi.mocked(bridge.sendOwnerNotification).mock.calls[0]!;
    expect(call).toHaveLength(1);
    expect(call[0]).toContain(
      'The notebook `notes/~bot/log` was deleted successfully.'
    );
    expect(call[0]).toContain('may still show in your group for a moment');
    expect(call[0]).toContain('retry the migration');
    expect(call[0]).not.toContain('cleanup failed');
    expect(call[0]).not.toContain('Inspect the notebook');
    expect(call[0]).not.toContain('/migrate cleanup');
    expect(buildMigrateCard).not.toHaveBeenCalled();
  });

  it('reports a deleted notebook when its group listing could not be checked', async () => {
    const partialCleanup =
      'Notebook deleted; group cleanup unconfirmed for notes/~bot/log: the group listing could not be checked. Wait a few seconds before retrying the migration.';
    const failure = Object.assign(new Error('Command failed'), {
      stdout: partialCleanup,
    });
    const buildMigrateCard = vi.fn(() => 'unexpected');
    const h = makeHarness([failure], { buildMigrateCard });
    const bridge = makeBridge();

    await h.handler(bridge, 'cleanup notes/~bot/log');
    await h.tasks.shift()?.();

    const call = vi.mocked(bridge.sendOwnerNotification).mock.calls[0]!;
    expect(call).toHaveLength(1);
    expect(call[0]).toContain(
      'The notebook `notes/~bot/log` was deleted successfully.'
    );
    expect(call[0]).toContain('may still show in your group for a moment');
    expect(call[0]).toContain('retry the migration');
    expect(call[0]).not.toContain('cleanup failed');
    expect(call[0]).not.toContain('Inspect the notebook');
    expect(call[0]).not.toContain('/migrate cleanup');
    expect(buildMigrateCard).not.toHaveBeenCalled();
  });

  it('keeps the failure message and retry card for an ordinary cleanup failure', async () => {
    const failure = Object.assign(new Error('Command failed'), {
      stderr:
        'Notebook deletion failed. Retry with tlon notes notebook-delete notes/~bot/log --yes.',
    });
    const buildMigrateCard = vi.fn((command: string) => `card for ${command}`);
    const h = makeHarness([failure], { buildMigrateCard });
    const bridge = makeBridge();

    await h.handler(bridge, 'cleanup notes/~bot/log');
    await h.tasks.shift()?.();

    const call = vi.mocked(bridge.sendOwnerNotification).mock.calls[0]!;
    expect(call).toHaveLength(2);
    expect(call[0]).toContain('Migration cleanup failed');
    expect(buildMigrateCard).toHaveBeenCalledOnce();
    expect(buildMigrateCard).toHaveBeenCalledWith(
      '/migrate cleanup notes/~bot/log'
    );
    expect(call[1]).toBe('card for /migrate cleanup notes/~bot/log');
  });

  it('stops an unmarked-notes cleanup refusal without offering an action card', async () => {
    const refusal =
      'Refusing to delete notes/~bot/log: found 1 unmarked note(s) without a tlon-migrate provenance footer.\n' +
      'Re-run with --yes --force only if deleting those notes is intentional.';
    const failure = Object.assign(new Error(refusal), { stderr: refusal });
    const buildMigrateCard = vi.fn(() => 'unexpected');
    const h = makeHarness([failure], { buildMigrateCard });
    const bridge = makeBridge();

    await h.handler(bridge, 'cleanup notes/~bot/log');
    await h.tasks.shift()?.();

    const call = vi.mocked(bridge.sendOwnerNotification).mock.calls[0]!;
    expect(call).toHaveLength(1);
    expect(call[0]).toContain(
      'contains notes that were added or edited since the migration'
    );
    expect(call[0]).toContain('Notes app');
    expect(call[0]).not.toContain('/migrate cleanup');
    expect(buildMigrateCard).not.toHaveBeenCalled();
  });

  it('gives an owner-hosted unmarked-notes refusal precedence over cleanup cards', async () => {
    const tasks: Array<() => Promise<void>> = [];
    const refusal =
      'Refusing to delete notes/~owner/log: found 2 unmarked note(s) without a tlon-migrate provenance footer.';
    const failure = Object.assign(new Error(refusal), { stderr: refusal });
    const runCommand = vi.fn(async () => {
      throw failure;
    });
    const buildMigrateCard = vi.fn(() => 'unexpected');
    const handler = createMigrateCommandHandler({
      runCommand,
      env: { TLON_SKILL_DIR: '/opt/tlon-skill' },
      fileExists: (path) => path === '/opt/tlon-skill/ships/owner.json',
      spawnTask: (task) => tasks.push(task),
      applyInFlight: new Map(),
      cleanupInFlight: new Map(),
      buildMigrateCard,
    });
    const bridge = makeBridge();

    await handler(bridge, 'cleanup notes/~owner/log');
    await tasks.shift()?.();

    const call = vi.mocked(bridge.sendOwnerNotification).mock.calls[0]!;
    expect(call).toHaveLength(1);
    expect(call[0]).toContain(
      'contains notes that were added or edited since the migration'
    );
    expect(call[0]).toContain('Notes app');
    expect(call[0]).not.toContain('/migrate cleanup');
    expect(buildMigrateCard).not.toHaveBeenCalled();
  });

  it('ignores a free-form target nest in an owner-hosted cleanup failure', async () => {
    const tasks: Array<() => Promise<void>> = [];
    const failure = Object.assign(new Error('Deletion failed'), {
      stderr:
        'Notebook deletion was not confirmed: notes/~owner/log is still present',
    });
    const runCommand = vi.fn(async () => {
      throw failure;
    });
    const buildMigrateCard = vi.fn(() => 'unexpected');
    const handler = createMigrateCommandHandler({
      runCommand,
      env: { TLON_SKILL_DIR: '/opt/tlon-skill' },
      fileExists: (path) => path === '/opt/tlon-skill/ships/owner.json',
      spawnTask: (task) => tasks.push(task),
      applyInFlight: new Map(),
      cleanupInFlight: new Map(),
      buildMigrateCard,
    });
    const bridge = makeBridge();

    await handler(bridge, 'cleanup notes/~owner/log');
    await tasks.shift()?.();

    expect(runCommand).toHaveBeenCalledWith(
      [
        '--config',
        '/opt/tlon-skill/ships/owner.json',
        'notes',
        'notebook-delete',
        'notes/~owner/log',
        '--yes',
      ],
      undefined,
      MIGRATION_CLEANUP_TIMEOUT_MS,
      expect.any(Function)
    );
    const call = vi.mocked(bridge.sendOwnerNotification).mock.calls[0]!;
    expect(call).toHaveLength(1);
    expect(call[0]).toContain('`notes/~owner/log` in the Notes app');
    expect(call[0]).not.toContain('/migrate cleanup');
    expect(buildMigrateCard).not.toHaveBeenCalled();
  });

  it('uses Notes-app cleanup recovery when failure output has no target nest', async () => {
    const buildMigrateCard = vi.fn(() => 'unexpected');
    const h = makeHarness([new Error('Deletion failed')], {
      buildMigrateCard,
    });
    const bridge = makeBridge();

    await h.handler(bridge, 'cleanup notes/~bot/log');
    await h.tasks.shift()?.();

    const call = vi.mocked(bridge.sendOwnerNotification).mock.calls[0]!;
    expect(call).toHaveLength(1);
    expect(call[0]).toContain('`notes/~bot/log` in the Notes app');
    expect(buildMigrateCard).not.toHaveBeenCalled();
  });
});

describe('formatMigrationCommandFailure', () => {
  it('strips unparseable CLI recovery text without stdout or a timeout', () => {
    const error = new Error(
      'Import failed\nThe target notebook exists. Remove it before retrying.  \n'
    );

    expect(formatMigrationCommandFailure(error, 'bot-hosted')).toBe(
      'Import failed'
    );
  });

  it('uses cleanup recovery for a real exit failure with a captured target', () => {
    const error = Object.assign(new Error('Import failed'), {
      stdout: 'Target notebook created: notes/~bot/field-notes\n',
      stderr: '',
    });
    const text = formatMigrationCommandFailure(error, 'bot-hosted');
    expect(text).toContain('Target notebook created: notes/~bot/field-notes');
    expect(text).toContain('/migrate cleanup notes/~bot/field-notes');
  });

  it('uses bot web UI recovery when creation has no known nest', () => {
    const error = Object.assign(
      new Error(
        'Create failed\nNotebook creation may or may not have landed. Look for a notebook with the requested title in the Notes app and remove it before retrying.'
      ),
      {
        stderr:
          'Create failed\nNotebook creation may or may not have landed. Look for a notebook with the requested title in the Notes app and remove it before retrying.',
      }
    );
    const text = formatMigrationCommandFailure(error, 'bot-hosted');
    expect(text).toContain('requested title in the bot ship’s Notes web UI');
    expect(text).not.toMatch(/cleanup notes\//);
  });

  it('uses the owner Notes app when owner-hosted creation has no known nest', () => {
    const error = Object.assign(
      new Error('Create failed\nNotebook creation may or may not have landed.'),
      {
        stderr: 'Create failed\nNotebook creation may or may not have landed.',
      }
    );
    const text = formatMigrationCommandFailure(error, 'owner-hosted');
    expect(text).toContain('requested title in your Notes app');
    expect(text).not.toContain('bot ship');
  });

  it('uses cleanup-command recovery for owner-hosted known targets', () => {
    const error = Object.assign(new Error('Import failed'), {
      stdout: 'Target notebook created: notes/~owner/log\n',
    });
    const text = formatMigrationCommandFailure(error, 'owner-hosted');
    expect(text).toContain('/migrate cleanup notes/~owner/log');
    expect(text).not.toContain('Delete the notebook');
  });
});

describe('migration telemetry emissions', () => {
  const migrationEvents: TlonMigrationReportInput[] = [];

  beforeEach(() => {
    migrationEvents.length = 0;
    setMigrationTelemetryReporter((event) => {
      migrationEvents.push(event);
    });
  });

  afterEach(() => {
    setMigrationTelemetryReporter(null);
  });

  it('reports started and completed under one migrationId with a duration', async () => {
    const h = makeHarness(['Migration complete.\n']);
    const bridge = makeBridge();

    await h.handler(bridge, 'diary/~bot/log');
    await h.tasks.shift()?.();

    expect(migrationEvents.map((event) => event.migrationEvent)).toEqual([
      'started',
      'completed',
    ]);
    const [started, completed] = migrationEvents;
    expect(started).toEqual({
      migrationEvent: 'started',
      action: 'apply',
      migrationId: expect.any(String),
      durationMs: null,
      deadlineExceeded: null,
      errorText: null,
    });
    expect(completed).toEqual({
      migrationEvent: 'completed',
      action: 'apply',
      migrationId: started.migrationId,
      durationMs: expect.any(Number),
      deadlineExceeded: false,
      errorText: null,
    });
  });

  it('reports a failure with error text', async () => {
    const failure = Object.assign(
      new Error('CLI exploded: target unreachable'),
      {
        stdout: '',
        stderr: 'some stderr\n',
      }
    );
    const h = makeHarness([failure]);
    const bridge = makeBridge();

    await h.handler(bridge, 'diary/~bot/log');
    await h.tasks.shift()?.();

    expect(migrationEvents[1]).toMatchObject({
      migrationEvent: 'failed',
      action: 'apply',
      durationMs: expect.any(Number),
      errorText: expect.stringContaining('CLI exploded: target unreachable'),
    });
  });

  it('reports a write-widening refusal as consent_required, not failed', async () => {
    const refusal = Object.assign(
      new Error(
        'Refusing without explicit acceptance — pass --allow-write-widening to accept.'
      ),
      { stdout: '', stderr: '' }
    );
    const h = makeHarness([refusal]);
    const bridge = makeBridge();

    await h.handler(bridge, 'diary/~bot/log');
    await h.tasks.shift()?.();

    expect(migrationEvents[1]).toMatchObject({
      migrationEvent: 'consent_required',
      action: 'apply',
      errorText: null,
    });
  });

  it('reports cleanup lifecycle, counting a partial cleanup as completed', async () => {
    const h = makeHarness(['Deleted notes/~bot/log\n']);
    const bridge = makeBridge();
    await h.handler(bridge, 'cleanup notes/~bot/log');
    await h.tasks.shift()?.();

    expect(migrationEvents.map((event) => event.migrationEvent)).toEqual([
      'started',
      'completed',
    ]);
    expect(migrationEvents[1]).toMatchObject({
      action: 'cleanup',
      durationMs: expect.any(Number),
    });

    migrationEvents.length = 0;
    const partial = Object.assign(
      new Error(
        'Notebook deleted; group cleanup unconfirmed — still present in group listing.'
      ),
      { stdout: '', stderr: '' }
    );
    const h2 = makeHarness([partial]);
    await h2.handler(bridge, 'cleanup notes/~bot/log');
    await h2.tasks.shift()?.();

    expect(migrationEvents[1]).toMatchObject({
      migrationEvent: 'completed',
      action: 'cleanup',
      errorText: null,
    });
  });
  it('emits the terminal before the deadline DM resolves, marked deadlineExceeded', async () => {
    let finishCli!: (output: string) => void;
    let onDeadline: Parameters<MigrateCommandDeps['runCommand']>[3];
    const runCommand = vi.fn(
      (...args: Parameters<MigrateCommandDeps['runCommand']>) => {
        onDeadline = args[3];
        return new Promise<string>((resolve) => {
          finishCli = resolve;
        });
      }
    );
    // First send is the deadline DM: hold it pending so a hung DM cannot
    // delay or lose a terminal the controller already knows.
    let releaseDeadlineDm!: () => void;
    const bridge = makeBridge();
    vi.mocked(bridge.sendOwnerNotification).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseDeadlineDm = () => resolve('message-id');
        })
    );
    const tasks: Array<() => Promise<void>> = [];
    const handler = createMigrateCommandHandler({
      runCommand,
      spawnTask: (task) => tasks.push(task),
      applyInFlight: new Map(),
      cleanupInFlight: new Map(),
    });

    await handler(bridge, 'diary/~bot/log');
    const task = tasks.shift()?.();
    onDeadline?.({ stdout: '', stderr: '' });
    finishCli('Migration complete.\n');

    await vi.waitFor(() =>
      expect(
        migrationEvents.some((event) => event.migrationEvent === 'completed')
      ).toBe(true)
    );
    expect(migrationEvents[1]).toMatchObject({
      migrationEvent: 'completed',
      action: 'apply',
      deadlineExceeded: true,
    });

    releaseDeadlineDm();
    await task;
  });
});

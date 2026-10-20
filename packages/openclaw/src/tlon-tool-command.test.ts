import { readFileSync } from 'node:fs';
import catalog from '@tloncorp/tlon-skill/scripts/command-catalog.json' with { type: 'json' };
import { ALLOWED_TLON_COMMANDS } from './tlon-tool-guard.js';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import {
  DiaryMigrationDiscoveryNotifier,
  notifyDiaryMigrationDiscovery,
} from './diary-migration-discovery.js';
import type { ApprovalCommandBridge } from './monitor/command-bridge.js';
import { removeBridge, setBridge } from './monitor/command-bridge.js';
import {
  checkBlockedTlonOperation,
  createTlonToolExecutor,
  formatTlonToolDescription,
  formatTlonToolHelp,
  isMutatingTlonCommand,
  normalizeTlonCommandArgs,
  redactTlonCommand,
  shellSplitCommand,
  summarizeTlonCommand,
} from './tlon-tool-command.js';

const BLOCKED_MIGRATION_MESSAGE =
  'Blocked: this notes operation requires owner confirmation. ' +
  'Ask the owner to type `/migrate diary/~bot/detached-discovery`.';

function makeDiscoveryBridge(
  sendOwnerNotification: ApprovalCommandBridge['sendOwnerNotification']
): ApprovalCommandBridge {
  return {
    botShip: '~bot',
    ownerShip: '~owner',
    sendOwnerNotification,
    getChannelTitle: () => 'Field Notes',
  } as ApprovalCommandBridge;
}

function beforeImmediate<T>(promise: Promise<T>) {
  return Promise.race([
    promise.then((value) => ({ state: 'resolved' as const, value })),
    new Promise<{ state: 'pending' }>((resolve) => {
      setImmediate(() => resolve({ state: 'pending' }));
    }),
  ]);
}

describe('tlon tool execution', () => {
  it.each(['--help', '-h', '', '--version', '-v'])(
    'classifies discovery as a known utility: %s',
    (command) => {
      expect(summarizeTlonCommand(command)).toMatchObject({
        isKnownSubcommand: true,
        intent: 'utility',
      });
    }
  );

  it('keeps reviewed tool policy aligned with the discoverable command catalog', () => {
    // A catalog addition must be explicitly reviewed in the policy list.
    expect(
      ALLOWED_TLON_COMMANDS.filter(
        (name) => !['help', 'version', 'notebook'].includes(name)
      ).sort()
    ).toEqual(Object.keys(catalog).sort());
  });

  it.each(['help', '--help', '-h', ''])(
    'answers top-level discovery locally: %s',
    async (command) => {
      const runCommand = vi.fn();
      const execute = createTlonToolExecutor({
        runCommand,
        notifyDiaryMigrationDiscovery: vi.fn(),
      });
      const result = await execute('help', { command });
      expect(result.details).toBeUndefined();
      expect(result.content[0].text).toContain('help notes note-create');
      expect(result.content[0].text).toContain('stdin is shell-only');
      expect(runCommand).not.toHaveBeenCalled();
    }
  );

  it.each([
    'notes note-create notes/~zod/blog root "Title" --stdin',
    'notes note-update notes/~zod/blog 1 --stdin',
    '--self notes note-update notes/~zod/blog 1 --stdin',
    'upload --stdin -t image/png',
  ])('rejects unsupported input before spawning: %s', async (command) => {
    const runCommand = vi.fn();
    const execute = createTlonToolExecutor({
      runCommand,
      notifyDiaryMigrationDiscovery: vi.fn(),
    });
    const result = await execute('stdin', { command });
    expect(runCommand).not.toHaveBeenCalled();
    expect(result.details).toMatchObject({ status: 'error' });
    expect(result.content[0].text).toContain('cannot supply stdin');
    expect(result.content[0].text).toContain('--body <file>');
  });

  it.each([
    'notes note-create notes/~zod/blog root "--stdin" --body post.md',
    'notes note-update notes/~zod/blog 1 --stdin --help',
    'upload --help',
  ])('preserves literal titles and CLI help: %s', async (command) => {
    const runCommand = vi.fn().mockResolvedValue('ok');
    const execute = createTlonToolExecutor({
      runCommand,
      notifyDiaryMigrationDiscovery: vi.fn(),
    });
    expect((await execute('help', { command })).details).toBeUndefined();
    expect(runCommand).toHaveBeenCalledOnce();
  });

  it('returns a local diary refusal before discovery delivery settles and preserves notifier deduplication', async () => {
    let settleSend!: (messageId: string | undefined) => void;
    const send = vi.fn(
      () =>
        new Promise<string | undefined>((resolve) => {
          settleSend = resolve;
        })
    );
    const inFlight = new Map<string, Promise<boolean>>();
    const notifier = new DiaryMigrationDiscoveryNotifier({
      notified: new Map(),
      inFlight,
    });
    const bridge = makeDiscoveryBridge(send);
    setBridge('detached-discovery-account', bridge);
    const execute = createTlonToolExecutor({
      runCommand: vi.fn(async () => 'unexpected CLI invocation'),
      notifyDiaryMigrationDiscovery: (nest) =>
        notifyDiaryMigrationDiscovery(nest, {} as OpenClawConfig, notifier),
    });
    const params = {
      command: 'notes migrate-apply diary/~bot/detached-discovery --yes',
    };
    const firstCall = execute('first', params);

    try {
      await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      const secondCall = execute('second', params);
      const outcomes = await Promise.all([
        beforeImmediate(firstCall),
        beforeImmediate(secondCall),
      ]);

      expect(outcomes).toEqual([
        {
          state: 'resolved',
          value: {
            content: [{ type: 'text', text: BLOCKED_MIGRATION_MESSAGE }],
            details: {
              status: 'blocked',
              blocked: true,
              reason: 'migration_operation',
            },
          },
        },
        {
          state: 'resolved',
          value: {
            content: [{ type: 'text', text: BLOCKED_MIGRATION_MESSAGE }],
            details: {
              status: 'blocked',
              blocked: true,
              reason: 'migration_operation',
            },
          },
        },
      ]);
      expect(send).toHaveBeenCalledTimes(1);
      expect(inFlight.has('diary/~bot/detached-discovery')).toBe(true);
    } finally {
      settleSend('message-id');
      await vi.waitFor(() => expect(inFlight.size).toBe(0));
      expect(send).toHaveBeenCalledTimes(1);
      removeBridge('detached-discovery-account', bridge);
    }
  });

  it('logs every blocked operation, without echoing the raw command', async () => {
    // The owner gate logs its denials; this one used to be silent, so an
    // operator could not see a model repeatedly attempting a destructive
    // migration. The raw command is deliberately excluded — it can carry
    // message text and other arguments.
    const logError = vi.fn();
    const execute = createTlonToolExecutor({
      runCommand: vi.fn(async () => 'unexpected CLI invocation'),
      notifyDiaryMigrationDiscovery: vi.fn(async () => true),
      logError,
    });

    await execute('blocked-logging', {
      command:
        'notes migrate-apply diary/~bot/logged-block --yes sampel-ticlyt-migfun-falmel',
    });

    const logged = logError.mock.calls.map((call) => String(call[0]));
    const blockedLine = logged.find((line) =>
      line.startsWith('Blocked tlon tool operation:')
    );
    expect(blockedLine).toBe(
      'Blocked tlon tool operation: reason=migration_operation subcommand=notes nest=diary/~bot/logged-block'
    );
    expect(logged.join('\n')).not.toContain('sampel-ticlyt-migfun-falmel');
  });

  it('keeps a local diary refusal and logs context when detached discovery rejects', async () => {
    const logError = vi.fn();
    const execute = createTlonToolExecutor({
      runCommand: vi.fn(async () => 'unexpected CLI invocation'),
      notifyDiaryMigrationDiscovery: vi.fn(async () => {
        throw new Error('unexpected bridge failure');
      }),
      logError,
    });

    const result = await execute('rejecting-discovery', {
      command: 'notes migrate-apply diary/~bot/detached-discovery --yes',
    });

    expect(result).toEqual({
      content: [{ type: 'text', text: BLOCKED_MIGRATION_MESSAGE }],
      details: {
        status: 'blocked',
        blocked: true,
        reason: 'migration_operation',
      },
    });
    await vi.waitFor(() =>
      expect(logError).toHaveBeenCalledWith(
        'Failed to notify owner about diary migration discovery for diary/~bot/detached-discovery: Error: unexpected bridge failure'
      )
    );
  });

  it('marks failed command results as tool errors for core classification', async () => {
    const execute = createTlonToolExecutor({
      runCommand: vi.fn(async () => {
        throw new Error('TimeoutError: active');
      }),
      notifyDiaryMigrationDiscovery: vi.fn(async () => true),
    });

    const result = await execute('failed-command', {
      command: 'groups update chat/~host/lobby --icon moon.png',
    });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: TimeoutError: active' }],
      details: { status: 'error', error: 'TimeoutError: active' },
    });
  });

  it('marks unknown subcommand results as tool errors', async () => {
    const execute = createTlonToolExecutor({
      runCommand: vi.fn(async () => 'unexpected CLI invocation'),
      notifyDiaryMigrationDiscovery: vi.fn(async () => true),
    });

    const result = await execute('unknown-subcommand', {
      command: 'frobnicate now',
    });

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: expect.stringContaining("Unknown tlon subcommand 'frobnicate'"),
        },
      ],
      details: {
        status: 'error',
        error: expect.stringContaining("Unknown tlon subcommand 'frobnicate'"),
      },
    });
  });

  it('keeps blocked results distinct from tool errors', async () => {
    const execute = createTlonToolExecutor({
      runCommand: vi.fn(async () => 'unexpected CLI invocation'),
      notifyDiaryMigrationDiscovery: vi.fn(async () => true),
    });

    const result = await execute('blocked-shape', {
      command: 'notes migrate-apply diary/~bot/shape-check --yes',
    });

    expect(result.details).toEqual({
      status: 'blocked',
      blocked: true,
      reason: 'migration_operation',
    });
  });

  it.each([
    { id: 'auto-provision', component: 'Button' },
    { id: 'another-button', component: 'Button' },
    { id: 'topic-choice', component: 'SmallChoice' },
  ])(
    'reserves $component provisioning blobs for the typed task-plan tool',
    async (component) => {
      const runCommand = vi.fn(async () => 'unexpected CLI invocation');
      const execute = createTlonToolExecutor({
        runCommand,
        notifyDiaryMigrationDiscovery: vi.fn(async () => true),
      });
      const blob = JSON.stringify([
        {
          type: 'a2ui',
          messages: [
            {
              updateComponents: {
                components: [
                  {
                    ...component,
                    action: {
                      event: { name: 'tlon.provisionAgent', context: {} },
                    },
                  },
                ],
              },
            },
          ],
        },
      ]);

      const result = await execute('reserved-auto-provision', {
        command: `posts send chat/~zod/home plan --blob '${blob}'`,
      });

      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: expect.stringContaining('tlon_agent_task_plan'),
          },
        ],
        details: {
          status: 'blocked',
          blocked: true,
          reason: 'reserved_automatic_provision',
        },
      });
      expect(runCommand).not.toHaveBeenCalled();
    }
  );

  it('blocks model-authored provider configuration actions in post blobs', async () => {
    const runCommand = vi.fn(async () => 'unexpected CLI invocation');
    const execute = createTlonToolExecutor({
      runCommand,
      notifyDiaryMigrationDiscovery: vi.fn(async () => true),
    });
    const blob = JSON.stringify([
      {
        type: 'a2ui',
        messages: [
          {
            updateComponents: {
              components: [
                {
                  id: 'connected-services',
                  component: 'McpConnect',
                  configureAction: {
                    event: {
                      name: 'tlon.configureAgentProviders',
                      context: {},
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    ]);

    const result = await execute('forged-provider-access', {
      command: `posts send chat/~zod/home connect --blob '${blob}'`,
    });

    expect(result.details).toMatchObject({
      status: 'blocked',
      reason: 'reserved_provider_configuration',
    });
    expect(runCommand).not.toHaveBeenCalled();
  });
});

describe('owner-by-default identity selection', () => {
  const SKILL_DIR = '/srv/tlon-skill';
  const OWNER_CONFIG = '/srv/tlon-skill/ships/owner.json';
  const UNPROVISIONED_FILE = `Error: owner credentials for ~owner are not provisioned (expected ${OWNER_CONFIG}); nothing was run. Add --self only if the bot's own account is what was asked for.`;
  const UNPROVISIONED_DIR =
    "Error: owner credentials for ~owner are not provisioned (TLON_SKILL_DIR is not set); nothing was run. Add --self only if the bot's own account is what was asked for.";

  function makeExecutor(
    overrides: Partial<Parameters<typeof createTlonToolExecutor>[0]> = {},
    output = 'ok'
  ) {
    const runCommand = vi.fn(async (_args: string[]) => output);
    const logError = vi.fn();
    const execute = createTlonToolExecutor({
      runCommand,
      logError,
      notifyDiaryMigrationDiscovery: vi.fn(async () => true),
      ownerShip: '~owner',
      ownerDefault: true,
      botShip: '~bot',
      env: { TLON_SKILL_DIR: SKILL_DIR } as NodeJS.ProcessEnv,
      fileExists: (path: string) => path === OWNER_CONFIG,
      ...overrides,
    });
    return { execute, runCommand, logError };
  }

  const unprovisioned = {
    file: { fileExists: () => false },
    dir: { env: {} as NodeJS.ProcessEnv },
  };

  function ranWith(runCommand: ReturnType<typeof makeExecutor>['runCommand']) {
    expect(runCommand).toHaveBeenCalledTimes(1);
    return runCommand.mock.calls[0][0];
  }

  describe('injection', () => {
    // One valid command per runnable family.
    const FAMILY_COMMANDS: Record<string, string> = {
      activity: 'activity mentions --limit 5',
      browser: 'browser share sess_abc',
      buckets: 'buckets list ~h/g',
      channels: 'channels groups',
      contacts: 'contacts self',
      dms: 'dms react ~alice 170.1 👍',
      expose: 'expose list',
      groups: 'groups list',
      hooks: 'hooks list',
      messages: 'messages dm ~alice',
      notes: 'notes list',
      posts: 'posts react chat/~h/c 170.1 👍',
      settings: 'settings get',
      upload: 'upload https://example.com/a.png',
    };

    it('covers every runnable family', () => {
      expect(Object.keys(FAMILY_COMMANDS).sort()).toEqual(
        ALLOWED_TLON_COMMANDS.filter(
          (name) => !['help', 'version', 'notebook'].includes(name)
        ).sort()
      );
    });

    it.each(Object.entries(FAMILY_COMMANDS))(
      'selects the identity for %s',
      async (family, command) => {
        const { execute, runCommand } = makeExecutor();
        await execute('family', { command });
        const args = shellSplitCommand(command);
        expect(ranWith(runCommand)).toEqual(
          family === 'settings' || family === 'browser' || family === 'hooks'
            ? args
            : ['--ship', '~owner', ...args]
        );
      }
    );

    it('keeps the notebook command blocked', async () => {
      const { execute, runCommand } = makeExecutor();
      const result = await execute('notebook', { command: 'notebook ~h/g' });
      expect(result.details).toMatchObject({ reason: 'diary_operation' });
      expect(runCommand).not.toHaveBeenCalled();
    });

    it.each([
      '--self contacts self',
      'tlon --self contacts self',
      '--self tlon contacts self',
    ])(
      'runs `%s` as the bot with neither --self nor tlon reaching argv',
      async (command) => {
        const { execute, runCommand } = makeExecutor();
        await execute('self', { command });
        expect(ranWith(runCommand)).toEqual(['contacts', 'self']);
      }
    );

    it.each([
      [
        'contacts update-profile --bio "--self" --status ok',
        ['contacts', 'update-profile', '--bio', '--self', '--status', 'ok'],
      ],
      ['contacts self --self', ['contacts', 'self', '--self']],
      ['posts send chat/~h/c --self', ['posts', 'send', 'chat/~h/c', '--self']],
    ])(
      'keeps a --self after the command as a literal argument: `%s`',
      async (command, expected) => {
        const { execute, runCommand } = makeExecutor();
        await execute('literal', { command });
        expect(ranWith(runCommand)).toEqual(['--ship', '~owner', ...expected]);
      }
    );

    it("reads a legacy command's own trailing --self as a bot request", async () => {
      const { execute, runCommand } = makeExecutor();
      await execute('legacy', { command: 'groups invite-link ~h/g --self' });
      expect(ranWith(runCommand)).toEqual([
        'groups',
        'invite-link',
        '~h/g',
        '--self',
      ]);
    });

    it('accepts a leading tlon token for owner commands', async () => {
      const { execute, runCommand } = makeExecutor();
      await execute('tlon', { command: 'tlon contacts self' });
      expect(ranWith(runCommand)).toEqual([
        '--ship',
        '~owner',
        'contacts',
        'self',
      ]);
    });

    it.each([
      ['no-config-file', unprovisioned.file, UNPROVISIONED_FILE],
      ['no-skill-dir', unprovisioned.dir, UNPROVISIONED_DIR],
    ] as const)(
      'refuses owner reads and writes when the owner is unprovisioned (%s)',
      async (_label, overrides, text) => {
        for (const command of [
          'contacts self',
          'contacts update-profile --nickname x',
        ]) {
          const { execute, runCommand } = makeExecutor(overrides);
          const result = await execute('unprovisioned', { command });
          expect(result.content[0].text).toBe(text);
          expect(result.details).toEqual({
            status: 'error',
            error: text.replace(/^Error: /, ''),
          });
          expect(runCommand).not.toHaveBeenCalled();
        }
      }
    );

    it.each([
      ['help notes', ['notes', '--help']],
      ['version', ['--version']],
      ['settings get', ['settings', 'get']],
      ['browser share sess_abc', ['browser', 'share', 'sess_abc']],
      ['--self contacts self', ['contacts', 'self']],
    ])(
      'still runs `%s` as the bot when the owner is unprovisioned',
      async (command, expected) => {
        const { execute, runCommand } = makeExecutor(unprovisioned.file);
        const result = await execute('bot', { command });
        expect(result.details).toBeUndefined();
        expect(ranWith(runCommand)).toEqual(expected);
      }
    );

    it('runs as the bot when no owner is configured', async () => {
      const { execute, runCommand } = makeExecutor({ ownerShip: undefined });
      const result = await execute('no-owner', {
        command: 'contacts update-profile --nickname x',
      });
      expect(ranWith(runCommand)).toEqual([
        'contacts',
        'update-profile',
        '--nickname',
        'x',
      ]);
      expect(result.content[0].text).toBe('ok\nRan as ~bot (bot).');
    });
  });

  describe('help classification', () => {
    it.each([
      ['help notes', ['notes', '--help']],
      ['help posts send', ['posts', 'send', '--help']],
      ['help upload', ['upload', '--help']],
      ['notes --help', ['notes', '--help']],
      [
        'contacts update-profile --help',
        ['contacts', 'update-profile', '--help'],
      ],
      ['channels create -h', ['channels', 'create', '-h']],
      ['hooks add --help', ['hooks', 'add', '--help']],
      ['groups create --help', ['groups', 'create', '--help']],
      ['groups invite-link ~h/g -h', ['groups', 'invite-link', '~h/g', '-h']],
      ['activity mute ~h/g --help', ['activity', 'mute', '~h/g', '--help']],
      [
        'buckets upload ~h/g a.png --help',
        ['buckets', 'upload', '~h/g', 'a.png', '--help'],
      ],
      ['upload a.png --help', ['upload', 'a.png', '--help']],
      [
        'expose show chat/~h/c --help',
        ['expose', 'show', 'chat/~h/c', '--help'],
      ],
      [
        'posts send ~alice hi --bot --help',
        ['posts', 'send', '~alice', 'hi', '--bot', '--help'],
      ],
      ...(['--file', '--video', '--link'] as const).map(
        (flag): [string, string[]] => [
          `posts send heap/~h/g ${flag} https://x/a --help`,
          ['posts', 'send', 'heap/~h/g', flag, 'https://x/a', '--help'],
        ]
      ),
      ['messages dm ~alice --help', ['messages', 'dm', '~alice', '--help']],
    ])(
      '`%s` is help: bot, no preflight, no echo',
      async (command, expected) => {
        const { execute, runCommand } = makeExecutor(
          unprovisioned.file,
          'Usage'
        );
        const result = await execute('help', { command });
        expect(result.details).toBeUndefined();
        expect(result.content[0].text).toBe('Usage');
        expect(ranWith(runCommand)).toEqual(expected);
      }
    );

    // The CLI shows these families' operation help only for exactly
    // `<op> <help>`; anything longer runs the operation.
    it.each([
      'contacts update-profile --nickname x --help',
      'channels rename chat/~h/c "New" --help',
      'groups leave ~h/g --help',
    ])('`%s` is a write, not help', async (command) => {
      const { execute, runCommand } = makeExecutor();
      const result = await execute('write', { command });
      expect(ranWith(runCommand).slice(0, 2)).toEqual(['--ship', '~owner']);
      expect(result.content[0].text).toBe('ok\nRan as ~owner (owner).');

      const blocked = makeExecutor(unprovisioned.file);
      const refused = await blocked.execute('write', { command });
      expect(refused.content[0].text).toBe(UNPROVISIONED_FILE);
      expect(blocked.runCommand).not.toHaveBeenCalled();
    });

    it.each([
      'posts send ~alice --help',
      'posts reply chat/~h/c 170.1 -h',
      'posts edit chat/~h/c 170.1 --help',
      'posts send chat/~h/c --help --quote chat/~h/d 170.1',
      'posts send chat/~h/c --help --file https://x/f.pdf',
      'posts send chat/~h/c --help --video https://x/v.mp4',
      'posts send heap/~h/g --help --link https://x.com',
      'posts reply chat/~h/c 170.1 -h --quote chat/~h/d 170.2 --quote-parent 170.1',
      'dms send 0v1.abc --help',
      'dms reply 0v1.abc 170.1 -h',
    ])('treats message text in `%s` as content', async (command) => {
      const { execute, runCommand } = makeExecutor();
      const result = await execute('content', { command });
      expect(ranWith(runCommand)).toEqual([
        '--ship',
        '~owner',
        ...shellSplitCommand(command),
      ]);
      expect(result.content[0].text).toBe('ok\nRan as ~owner (owner).');
    });

    it.each([
      'posts send chat/~h/c caption --file https://x/f.pdf --sent-at 1700000000000',
      'posts send chat/~h/c --video https://x/v.mp4 --bot',
      'posts send heap/~h/g --link https://x.com --title Site',
    ])(
      'runs the attachment send `%s` as the owner, args intact',
      async (command) => {
        const { execute, runCommand } = makeExecutor();
        const result = await execute('attach', { command });
        expect(ranWith(runCommand)).toEqual([
          '--ship',
          '~owner',
          ...shellSplitCommand(command),
        ]);
        expect(result.content[0].text).toBe('ok\nRan as ~owner (owner).');
      }
    );

    it('treats a literal search query as a read, not help', async () => {
      const { execute, runCommand } = makeExecutor();
      const result = await execute('search', {
        command: 'messages search --help --channel chat/~h/c',
      });
      expect(ranWith(runCommand).slice(0, 2)).toEqual(['--ship', '~owner']);
      expect(result.content[0].text).toBe('ok');
    });

    it.each([
      'help posts send ~alice hi',
      'help posts bogus',
      'help frobnicate',
      'help upload now',
      'help --help',
    ])('rejects invalid discovery `%s`', async (command) => {
      const { execute, runCommand } = makeExecutor();
      const result = await execute('discovery', { command });
      expect(result.content[0].text).toBe(
        'Error: help takes a command and an optional operation, for example help posts send.'
      );
      expect(result.details).toMatchObject({ status: 'error' });
      expect(runCommand).not.toHaveBeenCalled();
    });
  });

  it.each([
    '--config /owner.json help posts send ~bot hi',
    '--config /owner.json --help',
  ])('rejects credential-prefixed discovery `%s`', async (command) => {
    const { execute, runCommand } = makeExecutor();
    const result = await execute('discovery', { command });
    expect(result.details).toMatchObject({ reason: 'credential_override' });
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('keeps the owner-default wording for --config x settings get', async () => {
    const { execute, runCommand } = makeExecutor();
    const result = await execute('bot-only', {
      command: '--config x settings get',
    });
    expect(result.content[0].text).toBe(
      'Error: credential flags (--config, --ship, --url, --code, --cookie) are not accepted. Commands run as the owner by default; add --self to run as this bot.'
    );
    expect(runCommand).not.toHaveBeenCalled();
  });

  describe('credential flag rejection', () => {
    const FLAGS = ['--config', '--ship', '--url', '--code', '--cookie'];
    const COMMANDS = [
      'contacts self',
      'contacts update-profile --nickname x',
      'browser share sess_abc',
    ];
    const cases = FLAGS.flatMap((flag) =>
      [`${flag} private-value`, `${flag}=private-value`].flatMap((option) =>
        // Only the global prefix carries credentials, as in the CLI.
        COMMANDS.flatMap((command) => [
          `${option} ${command}`,
          `tlon ${option} ${command}`,
        ])
      )
    );

    it.each([
      [
        'contacts update-profile --bio "--ship" --status ok',
        ['contacts', 'update-profile', '--bio', '--ship', '--status', 'ok'],
      ],
      ['contacts self --config=x', ['contacts', 'self', '--config=x']],
    ])(
      'passes a credential spelling after the command through as a literal: `%s`',
      async (command, expected) => {
        const { execute, runCommand } = makeExecutor();
        const result = await execute('literal', { command });
        expect(result.details).not.toMatchObject({
          reason: 'credential_override',
        });
        expect(runCommand.mock.calls[0][0]).toEqual([
          '--ship',
          '~owner',
          ...expected,
        ]);
        expect(redactTlonCommand(command)).toBe(command);
      }
    );

    it.each(cases)('rejects `%s`', async (command) => {
      const { execute, runCommand, logError } = makeExecutor();
      const result = await execute('credential', { command });
      expect(runCommand).not.toHaveBeenCalled();
      expect(result.content[0].text).toBe(
        'Error: credential flags (--config, --ship, --url, --code, --cookie) are not accepted. Commands run as the owner by default; add --self to run as this bot.'
      );
      expect(result.details).toEqual({
        status: 'blocked',
        blocked: true,
        reason: 'credential_override',
      });
      expect(JSON.stringify([result, logError.mock.calls])).not.toContain(
        'private-value'
      );
      expect(logError.mock.calls.map(([line]) => line)).toEqual([
        `Blocked tlon tool operation: reason=credential_override subcommand=${command.includes('browser') ? 'browser' : 'contacts'}`,
      ]);
    });
  });

  describe('redaction', () => {
    it.each([
      ['--code private-value contacts self', '--code [REDACTED] contacts self'],
      ['TLON browser handoff sess_private', 'browser handoff [REDACTED]'],
      [
        'Tlon --code private-value browser share sess_private',
        'browser share [REDACTED]',
      ],
      [
        'tlon --config private-value contacts self',
        'tlon --config [REDACTED] contacts self',
      ],
      [
        '--code --cookie secret-cookie-value contacts self',
        '--code --cookie [REDACTED] contacts self',
      ],
      [
        '--code --ship=~x --url secret-url-value contacts self',
        '--code --ship=[REDACTED] --url [REDACTED] contacts self',
      ],
      ['--code=private-value contacts self', '--code=[REDACTED] contacts self'],
      [
        '--cookie "urbauth=private-value" contacts self',
        '--cookie [REDACTED] contacts self',
      ],
      [
        '--cookie=private-value contacts self',
        '--cookie=[REDACTED] contacts self',
      ],
      ['browser --self share sess_private', 'browser share [REDACTED]'],
      ['tlon browser share sess_private', 'browser share [REDACTED]'],
      [
        '--self tlon browser handoff sess_private',
        'browser handoff [REDACTED]',
      ],
      [
        '--code private-value browser share sess_private',
        'browser share [REDACTED]',
      ],
      ['--self contacts self', '--self contacts self'],
      [
        '--verbose --code private-value contacts self',
        '--verbose --code [REDACTED] contacts self',
      ],
      [
        '--code private-value --verbose --ship ~private contacts self',
        '--code [REDACTED] --verbose --ship [REDACTED] contacts self',
      ],
    ])('redacts `%s`', (command, expected) => {
      const redacted = redactTlonCommand(command);
      expect(redacted).toBe(expected);
      expect(redacted).not.toContain('private');
    });

    it('keeps a --verbose after the command family literal', () => {
      const command = 'posts send chat/~zod/x --verbose --code abc';
      expect(redactTlonCommand(command)).toBe(command);
    });
  });

  describe('summaries', () => {
    it.each([
      ['--self contacts self', 'contacts.self', 'read'],
      [
        '--self contacts update-profile --nickname x',
        'contacts.update-profile',
        'write',
      ],
      ['--self tlon --help', 'help.show', 'utility'],
      ['tlon --self contacts self', 'contacts.self', 'read'],
      ['contacts sync ~zod', 'contacts.sync', 'write'],
      ['settings get', 'settings.get', 'read'],
      ['settings set showModelSig true', 'settings.set', 'config'],
      ['hooks init my-hook', 'hooks.init', 'utility'],
    ])('summarizes `%s` as %s (%s)', (command, summaryKey, intent) => {
      expect(summarizeTlonCommand(command)).toMatchObject({
        summaryKey,
        intent,
      });
    });
  });

  describe('owner self-DM guard', () => {
    const SELF_DM_OPERATIONS = [
      'posts send ~bot hi',
      'posts reply ~bot 170.1 hi',
      'posts react ~bot 170.1 👍',
      'posts unreact ~bot 170.1 👍',
      'posts edit ~bot 170.1 hi',
      'posts delete ~bot 170.1',
      'posts pin ~bot 170.1',
      'posts unpin ~bot 170.1',
      'posts forward chat/~h/c 170.1 ~bot',
      // Ship-targeted dms send/reply are redirected to message first.
      'dms react ~bot 170.1 👍',
      'dms unreact ~bot 170.1 👍',
      'dms delete ~bot 170.1',
      'dms accept ~bot',
      'dms decline ~BOT',
    ];

    it.each(SELF_DM_OPERATIONS)('blocks owner `%s`', async (command) => {
      const { execute, runCommand } = makeExecutor();
      const result = await execute('self-dm', { command });
      expect(result.content[0].text).toBe(
        "Blocked: commands run as the owner cannot act in the owner's DM with this bot (~bot). Reply to the owner with the message tool."
      );
      expect(result.details).toMatchObject({ reason: 'owner_self_dm' });
      expect(runCommand).not.toHaveBeenCalled();
    });

    it.each(
      SELF_DM_OPERATIONS.filter((command) =>
        command.startsWith('posts')
      ).concat([
        'dms react ~bot 170.1 👍',
        'dms unreact ~bot 170.1 👍',
        'dms delete ~bot 170.1',
        'dms accept ~bot',
        'dms decline ~bot',
      ])
    )('runs `%s` with --self', async (command) => {
      const { execute, runCommand } = makeExecutor();
      await execute('self-dm', { command: `--self ${command}` });
      expect(ranWith(runCommand)).toEqual(shellSplitCommand(command));
    });

    it.each(['dms send ~alice hi', 'dms reply ~alice 170.1 hi'])(
      'keeps redirecting `%s` to message, with or without --self',
      async (command) => {
        for (const prefix of ['', '--self ']) {
          const { execute, runCommand } = makeExecutor();
          const result = await execute('redirect', {
            command: prefix + command,
          });
          expect(result.details).toMatchObject({ reason: 'send_operation' });
          expect(runCommand).not.toHaveBeenCalled();
        }
      }
    );

    it.each([
      'posts send ~alice hi',
      'posts send chat/~bot/general hi',
      'posts forward chat/~h/c 170.1 ~alice',
    ])('runs owner `%s`', async (command) => {
      const { execute, runCommand } = makeExecutor();
      await execute('post', { command });
      expect(ranWith(runCommand).slice(0, 2)).toEqual(['--ship', '~owner']);
    });

    it('refuses owner posts/dms when the bot ship is unknown', async () => {
      for (const command of [
        'posts send ~alice hi',
        'dms react 0v1.abc 170.1 👍',
      ]) {
        const { execute, runCommand } = makeExecutor({ botShip: undefined });
        const result = await execute('unknown-bot', { command });
        expect(result.content[0].text).toBe(
          "Blocked: this bot's own ship could not be determined, so owner posts/dms commands are refused. Add --self to act as the bot."
        );
        expect(result.details).toMatchObject({ reason: 'bot_ship_unknown' });
        expect(runCommand).not.toHaveBeenCalled();
      }
      for (const command of ['--self posts send ~alice hi', 'contacts self']) {
        const { execute, runCommand } = makeExecutor({ botShip: undefined });
        await execute('unknown-bot', { command });
        expect(runCommand).toHaveBeenCalledOnce();
      }
    });
  });

  describe('runtime-owned settings keys', () => {
    const TAILS: Record<string, string> = {
      dmAllowlist: ' Use settings allow-dm or remove-dm.',
      defaultAuthorizedShips:
        ' Use settings authorize-ship or deauthorize-ship.',
      groupChannels: ' Use settings allow-channel or remove-channel.',
      channelRules: ' Use settings open-channel, restrict-channel or set-rule.',
      ownerShip: " It is set in the bot's configuration by its operator.",
      pendingApprovals:
        ' Approvals are answered by the owner, by reaction or /allow.',
    };

    it.each(
      Object.entries(TAILS).flatMap(([key, tail]) =>
        ['set', 'delete', 'del'].map(
          (operation) =>
            [
              `settings ${operation} ${key}${operation === 'set' ? ' []' : ''}`,
              key,
              tail,
            ] as const
        )
      )
    )('blocks `%s`', async (command, key, tail) => {
      const { execute, runCommand } = makeExecutor();
      const result = await execute('settings', { command });
      expect(result.content[0].text).toBe(
        `Blocked: settings key '${key}' controls who can reach this bot and cannot be set or deleted through the tlon tool.${tail}`
      );
      expect(result.details).toMatchObject({ reason: 'runtime_settings_key' });
      expect(runCommand).not.toHaveBeenCalled();
    });

    it.each([
      'settings set groupInviteAllowlist ["~zod"]',
      'settings set bootstrapComplete true',
      'settings allow-dm ~zod',
      'settings set ownerShip --help',
    ])('runs `%s`', async (command) => {
      const { execute, runCommand } = makeExecutor();
      await execute('settings', { command });
      expect(runCommand).toHaveBeenCalledOnce();
    });
  });

  describe('Ran as echo', () => {
    // One mutating op per owner write family; settings, browser and hooks are
    // bot-only and covered below.
    it.each([
      'activity mute ~h/g',
      'buckets mkdir ~h/g docs',
      'channels join chat/~h/c',
      'contacts update-profile --nickname x',
      'dms react 0v1.abc 170.1 👍',
      'expose show chat/~h/c/170.1',
      'groups invite-link ~h/g',
      'notes note-publish notes/~h/b 12',
      'posts react chat/~h/c 170.1 👍',
      'posts forward chat/~h/c 170.1 chat/~h/d',
      'upload https://example.com/a.png',
    ])('ends owner `%s` with the owner line', async (command) => {
      const { execute } = makeExecutor({}, 'done\n');
      const result = await execute('echo', { command });
      expect(result.content[0].text).toBe('done\nRan as ~owner (owner).');
    });

    it.each([
      '--self contacts update-profile --nickname x',
      'settings set showModelSig true',
      'browser share sess_abc',
      'hooks add ~h/g hook.hoon',
    ])('ends `%s` with the bot line', async (command) => {
      const { execute } = makeExecutor({}, 'done');
      const result = await execute('echo', { command });
      expect(result.content[0].text).toBe('done\nRan as ~bot (bot).');
    });

    it('falls back when the bot ship is unknown', async () => {
      const { execute } = makeExecutor({ botShip: undefined }, 'done');
      const result = await execute('echo', {
        command: '--self contacts update-profile --nickname x',
      });
      expect(result.content[0].text).toBe('done\nRan as this bot.');
    });

    it.each([
      'activity unreads',
      'contacts list',
      'settings get',
      'messages dm ~a',
    ])('does not echo the read `%s`', async (command) => {
      const { execute } = makeExecutor({}, 'data');
      const result = await execute('read', { command });
      expect(result.content[0].text).toBe('data');
    });

    it('does not echo usage output or a failed run', async () => {
      const usage = makeExecutor({}, 'Usage: tlon contacts update-profile');
      const result = await usage.execute('usage', {
        command: 'contacts update-profile',
      });
      expect(result.content[0].text).toBe(
        'Usage: tlon contacts update-profile'
      );

      const failing = makeExecutor({
        runCommand: vi.fn(async () => {
          throw new Error('poke failed');
        }),
      });
      const failed = await failing.execute('failed', {
        command: 'contacts update-profile --nickname x',
      });
      expect(failed.content[0].text).toBe('Error: poke failed');
    });
  });

  it('keeps the per-command owner plumbing deleted', () => {
    const source = readFileSync(
      new URL('./tlon-tool-command.ts', import.meta.url),
      'utf8'
    );
    expect(source).not.toMatch(/OWNER_CREDENTIAL_(COMMANDS|WORDING)|selfHint/);
  });
});
describe('model-facing identity guidance', () => {
  const ON = 'Commands act as your owner by default';
  const OFF = 'Commands act as this bot.';

  it.each([
    [true, ON, OFF],
    [false, OFF, ON],
  ])(
    'describes the identity for ownerDefault=%s',
    async (ownerDefault, expected, absent) => {
      const description = formatTlonToolDescription(ownerDefault);
      const help = formatTlonToolHelp(ownerDefault);
      for (const text of [description, help]) {
        expect(text).toContain(expected);
        expect(text).not.toContain(absent);
      }
      expect(description).toContain(
        'use groups commands and groups create-owned'
      );
      for (const marker of [
        'groups create-owned "Name" --admin <your ship>',
        '--self groups create-owned "Name" --admin <owner>',
      ]) {
        if (ownerDefault) expect(description).toContain(marker);
        else expect(description).not.toContain(marker);
      }
      expect(description).toContain('mark-read');
      expect(help).toContain('mark-read');
      for (const marker of ['Owner or bot:', 'Put --self before the command']) {
        if (ownerDefault) expect(help).toContain(marker);
        else expect(help).not.toContain(marker);
      }
      const execute = createTlonToolExecutor({
        runCommand: vi.fn(),
        notifyDiaryMigrationDiscovery: vi.fn(),
        ownerDefault,
      });
      expect((await execute('help', { command: 'help' })).content[0].text).toBe(
        help
      );
    }
  );

  it('limits catalog identity claims to the always-bot families', () => {
    const identityClaim =
      /act(s)? as the (owner|bot)|runs? as the (owner|bot)|owner's (DMs|groups|activity)|--self/;
    for (const [name, entry] of Object.entries(catalog)) {
      if (name === 'settings' || name === 'browser' || name === 'hooks') {
        expect(entry.toolGuidance, name).toMatch(/runs? as the bot/);
        expect(entry.toolGuidance, name).not.toMatch(/owner|--self/);
      } else {
        expect(entry.toolGuidance, name).not.toMatch(identityClaim);
      }
    }
  });
});

describe('owner default off (staged rollout)', () => {
  const OWNER_CONFIG = '/srv/tlon-skill/ships/owner.json';

  function makeExecutor(
    overrides: Partial<Parameters<typeof createTlonToolExecutor>[0]> = {}
  ) {
    const runCommand = vi.fn(async (_args: string[]) => 'ok');
    const execute = createTlonToolExecutor({
      runCommand,
      notifyDiaryMigrationDiscovery: vi.fn(async () => true),
      ownerShip: '~owner',
      botShip: '~bot',
      env: { TLON_SKILL_DIR: '/srv/tlon-skill' } as NodeJS.ProcessEnv,
      fileExists: (path: string) => path === OWNER_CONFIG,
      ...overrides,
    });
    return { execute, runCommand };
  }

  it('runs a bare write as the bot, without an echo', async () => {
    const { execute, runCommand } = makeExecutor();
    const result = await execute('off', {
      command: 'contacts update-profile --nickname x',
    });
    expect(runCommand).toHaveBeenCalledWith([
      'contacts',
      'update-profile',
      '--nickname',
      'x',
    ]);
    expect(result.content[0].text).toBe('ok');
  });

  it('strips --self as a no-op', async () => {
    const { execute, runCommand } = makeExecutor();
    await execute('off', { command: '--self contacts self' });
    expect(runCommand).toHaveBeenCalledWith(['contacts', 'self']);
  });

  it.each([
    ['--config /tmp/x.json contacts self'],
    ['contacts self --ship=~zod'],
  ])('passes credential flags through unchanged: %s', async (command) => {
    const { execute, runCommand } = makeExecutor();
    const result = await execute('off', { command });
    expect(result.details).toBeUndefined();
    expect(runCommand).toHaveBeenCalledWith(shellSplitCommand(command));
  });

  const LEGACY = [
    'groups invite-link ~host/book-club',
    'notes note-publish notes/~h/b 12',
    'notes note-unpublish notes/~h/b 12',
    'activity mute ~zod/book-club',
    'activity unmute chat/~nec/general 170.141',
    'activity volume ~ten hush',
    'activity mark-read ~zod/book-club',
    'activity mark-read ~ten',
    'activity mark-read --all',
    'activity volume base soft',
    'activity volume base',
  ];

  it.each(LEGACY)(
    'runs the legacy owner operation `%s` as the owner',
    async (command) => {
      const { execute, runCommand } = makeExecutor();
      const result = await execute('legacy', { command });
      expect(runCommand).toHaveBeenCalledWith([
        '--ship',
        '~owner',
        ...command.split(' '),
      ]);
      expect(result.content[0].text).toBe('ok');
    }
  );

  it.each(LEGACY)(
    'honors --self and credential flags on `%s`',
    async (command) => {
      for (const variant of [
        `${command} --self`,
        `--config /tmp/x.json ${command}`,
      ]) {
        const { execute, runCommand } = makeExecutor();
        await execute('legacy', { command: variant });
        // The legacy commands' own parsers accept a trailing --self.
        expect(runCommand).toHaveBeenCalledWith(shellSplitCommand(variant));
      }
    }
  );

  const PROVISIONING_FAILURES: Array<
    [Parameters<typeof makeExecutor>[0], string]
  > = [
    [
      { ownerShip: undefined },
      'the owner are not provisioned (no owner ship is configured)',
    ],
    [
      { env: {} as NodeJS.ProcessEnv },
      '~owner are not provisioned (TLON_SKILL_DIR is not set)',
    ],
    [
      { fileExists: () => false },
      `~owner are not provisioned (expected ${OWNER_CONFIG})`,
    ],
  ];

  it.each([
    'groups invite-link ~host/book-club',
    'activity mark-read ~ten',
    'activity mark-read --all',
  ])(
    'errors on the legacy operation `%s` when the owner is unprovisioned',
    async (command) => {
      for (const [overrides, detail] of PROVISIONING_FAILURES) {
        const { execute, runCommand } = makeExecutor(overrides);
        const result = await execute('legacy', { command });
        expect(result.content[0].text).toBe(
          `Error: owner credentials for ${detail}; nothing was run. Add --self only if the bot's own account is what was asked for.`
        );
        expect(result.details).toMatchObject({ status: 'error' });
        expect(runCommand).not.toHaveBeenCalled();
      }
    }
  );

  // An opt-out short-circuits before provisioning is consulted.
  it.each([
    'activity mute ~zod/book-club --self',
    'activity mark-read ~ten --self',
    'activity mark-read --all --self',
    '--ship=~other notes note-publish notes/~h/b 12',
  ])(
    'honors the opt-out in `%s` despite missing provisioning',
    async (command) => {
      for (const [overrides] of PROVISIONING_FAILURES) {
        const { execute, runCommand } = makeExecutor(overrides);
        const result = await execute('opt-out', { command });
        expect(result.details).toBeUndefined();
        expect(runCommand).toHaveBeenCalledWith(shellSplitCommand(command));
        expect(runCommand).toHaveBeenCalledTimes(1);
      }
    }
  );

  it('keeps the self-DM guard for model-supplied credentials', async () => {
    const { execute, runCommand } = makeExecutor();
    const result = await execute('guard', {
      command: '--config /tmp/owner.json posts send ~bot hi',
    });
    expect(result.details).toMatchObject({ reason: 'owner_self_dm' });
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('finds discovery after credential flags, so the guards still apply', async () => {
    const { execute, runCommand } = makeExecutor();
    const blocked = await execute('discovery', {
      command: '--config /owner.json help posts send ~bot hi',
    });
    expect(blocked.content[0].text).toBe(
      'Error: help takes a command and an optional operation, for example help posts send.'
    );
    expect(runCommand).not.toHaveBeenCalled();

    const literal = await execute('discovery', {
      command: '--config /owner.json posts send ~bot hi --help',
    });
    expect(literal.details).toMatchObject({ reason: 'owner_self_dm' });
    expect(runCommand).not.toHaveBeenCalled();

    const help = await execute('discovery', {
      command: '--config /owner.json --help',
    });
    expect(help.content[0].text).toContain('Tlon tool — command discovery');
    expect(runCommand).not.toHaveBeenCalled();

    await execute('discovery', { command: '--config /owner.json help notes' });
    expect(runCommand).toHaveBeenCalledWith([
      '--config',
      '/owner.json',
      'notes',
      '--help',
    ]);
  });

  it.each([
    '--config x settings get',
    '--ship=~o browser share sess_1',
    '--config x help settings',
    '--ship ~owner hooks add ~h/g hook.hoon',
  ])(
    'rejects credential flags on the always-bot family in `%s`',
    async (command) => {
      const { execute, runCommand } = makeExecutor();
      const result = await execute('bot-only', { command });
      expect(result.content[0].text).toBe(
        'Error: credential flags (--config, --ship, --url, --code, --cookie) are not accepted on settings, browser or hooks; these commands always run as this bot.'
      );
      expect(result.details).toMatchObject({ reason: 'credential_override' });
      expect(runCommand).not.toHaveBeenCalled();
    }
  );

  it('still runs plain settings get as the bot', async () => {
    const { execute, runCommand } = makeExecutor();
    await execute('bot-only', { command: 'settings get' });
    expect(runCommand).toHaveBeenCalledWith(['settings', 'get']);
  });

  it('keeps the runtime settings-key guard', async () => {
    const { execute, runCommand } = makeExecutor();
    const result = await execute('guard', {
      command: 'settings set pendingApprovals []',
    });
    expect(result.details).toMatchObject({ reason: 'runtime_settings_key' });
    expect(runCommand).not.toHaveBeenCalled();
  });
});

describe('owner-hosted workspaces for groups create-owned', () => {
  const SKILL_DIR = '/srv/tlon-skill';
  const OWNER_CONFIG = '/srv/tlon-skill/ships/owner.json';
  const HELP_WITH_ADMIN =
    'Usage: tlon groups create-owned "Group Name" --admin <ship> [--description "..."]';
  const HELP_WITHOUT_ADMIN =
    'Usage: tlon groups create-owned "Group Name" --owner <ship> [--description "..."]';

  function makeExecutor(
    overrides: {
      ownerShip?: string;
      botShip?: string;
      env?: NodeJS.ProcessEnv;
      fileExists?: (path: string) => boolean;
      help?: string;
    } = {}
  ) {
    const { help = HELP_WITH_ADMIN, ...deps } = overrides;
    const runCommand = vi.fn(async (args: string[]) =>
      args.includes('--help') ? help : 'Owned group created successfully!'
    );
    const logError = vi.fn();
    const execute = createTlonToolExecutor({
      runCommand,
      notifyDiaryMigrationDiscovery: vi.fn(async () => true),
      logError,
      ownerShip: '~owner',
      botShip: '~pinser-botter-owner',
      env: { TLON_SKILL_DIR: SKILL_DIR } as NodeJS.ProcessEnv,
      fileExists: (path: string) => path === OWNER_CONFIG,
      ...deps,
    });
    return { execute, runCommand, logError };
  }

  it.each([
    [
      'a description of --admin',
      'groups create-owned Projects --description --admin --owner owner',
      '--admin',
    ],
    [
      'the legacy description --owner form',
      'groups create-owned Projects --description --owner owner',
      '--owner',
    ],
  ])(
    'rebuilds the owner run with the bot as admin, past %s',
    async (_label, command, description) => {
      const { execute, runCommand } = makeExecutor();

      await execute('description', { command });

      expect(runCommand).toHaveBeenLastCalledWith([
        '--ship',
        '~owner',
        'groups',
        'create-owned',
        'Projects',
        '--admin',
        '~pinser-botter-owner',
        '--description',
        description,
      ]);
    }
  );

  it.each([
    [
      '--owner',
      'groups create-owned Projects --owner owner --description Work',
    ],
    [
      '--admin',
      'groups create-owned Projects --admin ~owner --description Work',
    ],
  ])(
    'runs a create-owned naming the owner as %s as the owner, with the bot as admin',
    async (_label, command) => {
      const { execute, runCommand } = makeExecutor();

      const result = await execute('workspace', { command });

      expect(runCommand).toHaveBeenCalledWith([
        'groups',
        'create-owned',
        '--help',
      ]);
      expect(runCommand).toHaveBeenLastCalledWith([
        '--ship',
        '~owner',
        'groups',
        'create-owned',
        'Projects',
        '--admin',
        '~pinser-botter-owner',
        '--description',
        'Work',
      ]);
      expect(result.content[0]?.text).not.toContain('Note:');
    }
  );

  it('names the bot as admin ahead of an empty description, so it cannot become one', async () => {
    const { execute, runCommand } = makeExecutor();

    await execute('empty', {
      command: 'groups create-owned Projects --owner ~owner --description ""',
    });

    const [args] = runCommand.mock.lastCall as unknown as [string[]];
    expect(args.slice(0, 7)).toEqual([
      '--ship',
      '~owner',
      'groups',
      'create-owned',
      'Projects',
      '--admin',
      '~pinser-botter-owner',
    ]);
    expect(args.slice(7)).not.toContain('~pinser-botter-owner');
  });

  it('keeps the bot-hosted workspace, and says so, when the CLI predates --admin', async () => {
    const { execute, runCommand, logError } = makeExecutor({
      help: HELP_WITHOUT_ADMIN,
    });

    const result = await execute('old-cli', {
      command: 'groups create-owned Projects --admin ~owner',
    });

    expect(runCommand).toHaveBeenLastCalledWith([
      'groups',
      'create-owned',
      'Projects',
      '--owner',
      '~owner',
    ]);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('does not take --admin')
    );
    expect(result.content[0]?.text).toContain('Note:');
    expect(result.content[0]?.text).toContain('you host the workspace');
  });

  it('adds no hosting note when the command fails', async () => {
    const { execute, runCommand } = makeExecutor({ fileExists: () => false });
    runCommand.mockRejectedValueOnce(new Error('ship unreachable'));

    const result = await execute('failed', {
      command: 'groups create-owned Projects --owner ~owner',
    });

    expect(result.content[0]?.text).toBe('Error: ship unreachable');
  });

  it('keeps the bot-hosted workspace, and says so, without owner credentials', async () => {
    for (const overrides of [
      { env: {} as NodeJS.ProcessEnv },
      { fileExists: () => false },
    ]) {
      const { execute, runCommand } = makeExecutor(overrides);

      const result = await execute('no-creds', {
        command: 'groups create-owned Projects --admin ~owner',
      });

      expect(runCommand).toHaveBeenLastCalledWith([
        'groups',
        'create-owned',
        'Projects',
        '--owner',
        '~owner',
      ]);
      expect(result.content[0]?.text).toContain(
        "Your owner's credentials aren't available here"
      );
    }
  });

  it.each([
    ['another requester', 'groups create-owned Projects --owner ~someone'],
    ['--self', 'groups create-owned Projects --owner ~owner --self'],
    ['-h', 'groups create-owned -h'],
    ['--help', 'groups create-owned P --owner ~owner --help'],
    [
      'separate-value --ship',
      '--ship ~bot groups create-owned P --owner ~owner',
    ],
    [
      '=-form --config',
      '--config=/x.json groups create-owned P --owner ~owner',
    ],
    ['plain create', 'groups create P --owner ~owner'],
  ])('leaves the command untouched for %s', async (_label, command) => {
    const { execute, runCommand } = makeExecutor();

    const result = await execute('skip', { command });

    const [args] = runCommand.mock.calls[0] as unknown as [string[]];
    expect(args).toEqual(command.split(' '));
    expect(result.content[0]?.text).not.toContain('Note:');
  });

  it('spells the admin --owner for any create-owned run as written', async () => {
    for (const command of [
      'groups create-owned Projects --admin ~someone',
      'groups create-owned Projects --admin ~owner --self',
    ]) {
      const { execute, runCommand } = makeExecutor();

      await execute('legacy', { command });

      const [args] = runCommand.mock.lastCall as unknown as [string[]];
      expect(args).toEqual(command.replace('--admin', '--owner').split(' '));
    }
  });

  it('keeps a description that a superseded owner pair swallowed', async () => {
    const { execute, runCommand } = makeExecutor();

    await execute('hidden-description', {
      command:
        'groups create-owned Projects --owner --description --admin ~someone',
    });

    expect(runCommand).toHaveBeenLastCalledWith([
      'groups',
      'create-owned',
      'Projects',
      '--owner',
      '~someone',
      '--description',
      '--admin',
    ]);
  });

  it('keeps the admin the CLI would choose when both spellings appear', async () => {
    const { execute, runCommand } = makeExecutor();

    await execute('both', {
      command:
        'groups create-owned Projects --owner ~alice --admin ~bob --description Work',
    });

    expect(runCommand).toHaveBeenLastCalledWith([
      'groups',
      'create-owned',
      'Projects',
      '--owner',
      '~bob',
      '--description',
      'Work',
    ]);
  });

  it.each([
    ['', 'groups create-owned Projects --admin ~owner --description Work'],
    [
      ' with --self',
      'groups create-owned Projects --admin ~owner --description Work --self',
    ],
  ])(
    'makes a plain group when the bot is its own owner%s',
    async (_label, command) => {
      const { execute, runCommand } = makeExecutor({ botShip: '~owner' });

      await execute('self', { command });

      expect(runCommand).toHaveBeenLastCalledWith([
        'groups',
        'create',
        'Projects',
        '--description',
        'Work',
      ]);
    }
  );

  it.each([
    ['URBIT_SHIP', { URBIT_SHIP: 'owner' }],
    ['TLON_SHIP', { TLON_SHIP: '~owner' }],
  ])(
    'makes a plain group when the bot is its own owner by %s',
    async (_label, shipEnv) => {
      const { execute, runCommand } = makeExecutor({
        botShip: undefined,
        env: { TLON_SKILL_DIR: SKILL_DIR, ...shipEnv } as NodeJS.ProcessEnv,
      });

      await execute('env-self', {
        command: 'groups create-owned Projects --admin ~owner',
      });

      expect(runCommand).toHaveBeenLastCalledWith([
        'groups',
        'create',
        'Projects',
      ]);
    }
  );

  it('runs as the owner with the bot named by the environment as admin', async () => {
    const { execute, runCommand } = makeExecutor({
      botShip: undefined,
      env: {
        TLON_SKILL_DIR: SKILL_DIR,
        URBIT_SHIP: '~pinser-botter-owner',
      } as NodeJS.ProcessEnv,
    });

    await execute('env-bot', {
      command: 'groups create-owned Projects --admin ~owner',
    });

    expect(runCommand).toHaveBeenLastCalledWith([
      '--ship',
      '~owner',
      'groups',
      'create-owned',
      'Projects',
      '--admin',
      '~pinser-botter-owner',
    ]);
  });

  it.each([
    ['nothing names it', { TLON_SKILL_DIR: SKILL_DIR }],
    [
      'TLON_CONFIG_FILE outranks URBIT_SHIP',
      {
        TLON_SKILL_DIR: SKILL_DIR,
        TLON_CONFIG_FILE: '/srv/bot.json',
        URBIT_SHIP: '~owner',
      },
    ],
  ])(
    'runs as written, and says so, when the bot ship is unknown: %s',
    async (_label, env) => {
      const { execute, runCommand } = makeExecutor({
        botShip: undefined,
        env: env as NodeJS.ProcessEnv,
      });

      const result = await execute('unknown', {
        command: 'groups create-owned Projects --owner ~owner',
      });

      expect(runCommand).toHaveBeenLastCalledWith([
        'groups',
        'create-owned',
        'Projects',
        '--owner',
        '~owner',
      ]);
      expect(result.content[0]?.text).toContain(
        "This bot's ship isn't configured here"
      );
    }
  );

  it.each([
    [
      '--admin',
      'groups create-owned Projects --description "--owner" --admin ~someone',
    ],
    [
      '--owner',
      'groups create-owned Projects --description "--owner" --owner ~someone',
    ],
  ])(
    'puts the admin ahead of a description of --owner when run as written with %s',
    async (_label, command) => {
      const { execute, runCommand } = makeExecutor();

      await execute('legacy-order', { command });

      expect(runCommand).toHaveBeenLastCalledWith([
        'groups',
        'create-owned',
        'Projects',
        '--owner',
        '~someone',
        '--description',
        '--owner',
      ]);
    }
  );
});

describe("owner-hosted channels in the owner's groups", () => {
  const SKILL_DIR = '/srv/tlon-skill';
  const OWNER_CONFIG = '/srv/tlon-skill/ships/owner.json';

  function makeExecutor(
    overrides: {
      ownerShip?: string;
      botShip?: string;
      env?: NodeJS.ProcessEnv;
      fileExists?: (path: string) => boolean;
    } = {}
  ) {
    const runCommand = vi.fn(async () => 'Channel created!');
    const logError = vi.fn();
    const execute = createTlonToolExecutor({
      runCommand,
      notifyDiaryMigrationDiscovery: vi.fn(async () => true),
      logError,
      ownerShip: '~owner',
      botShip: '~pinser-botter-owner',
      env: { TLON_SKILL_DIR: SKILL_DIR } as NodeJS.ProcessEnv,
      fileExists: (path: string) => path === OWNER_CONFIG,
      ...overrides,
    });
    return { execute, runCommand, logError };
  }

  it.each([
    ['channels create', 'channels create ~owner/team Discussion --kind chat'],
    [
      'groups add-channel',
      'groups add-channel owner/team Research --kind notes',
    ],
  ])(
    'runs %s in an owner-hosted group as the owner',
    async (_label, command) => {
      const { execute, runCommand } = makeExecutor();

      const result = await execute('channel', { command });

      expect(runCommand).toHaveBeenCalledWith([
        '--ship',
        '~owner',
        ...command.split(' '),
      ]);
      expect(result.content[0]?.text).not.toContain('Note:');
    }
  );

  it.each([
    ['another host', 'channels create ~someone/team Discussion'],
    [
      "the bot's own group",
      'channels create ~pinser-botter-owner/team Discussion',
    ],
    ['--self', 'channels create ~owner/team Discussion --self'],
    ['--help', 'channels create ~owner/team Discussion --help'],
    [
      'separate-value --ship',
      '--ship ~bot channels create ~owner/team Discussion',
    ],
    [
      '=-form --config',
      '--config=/x.json channels create ~owner/team Discussion',
    ],
    [
      'another channels operation',
      'channels update chat/~owner/abc --title New',
    ],
  ])('leaves the command untouched for %s', async (_label, command) => {
    const { execute, runCommand } = makeExecutor();

    await execute('skip', { command });

    const [args] = runCommand.mock.calls[0] as unknown as [string[]];
    expect(args).toEqual(command.split(' '));
  });

  it("creates the channel on the bot's ship, and says so, without owner credentials", async () => {
    const { execute, runCommand, logError } = makeExecutor({
      fileExists: () => false,
    });

    const result = await execute('no-file', {
      command: 'channels create ~owner/team Discussion',
    });

    expect(runCommand).toHaveBeenCalledWith([
      'channels',
      'create',
      '~owner/team',
      'Discussion',
    ]);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining("Creating the channel on the bot's ship")
    );
    expect(result.content[0]?.text).toContain(
      'this channel is hosted on your own ship'
    );
  });

  it.each([
    ['configured', { botShip: '~owner' }],
    [
      'read from the environment',
      {
        botShip: undefined,
        env: {
          TLON_SKILL_DIR: SKILL_DIR,
          URBIT_SHIP: 'owner',
        } as NodeJS.ProcessEnv,
      },
    ],
  ])(
    'runs as written when the bot is its own owner, %s',
    async (_label, overrides) => {
      const { execute, runCommand } = makeExecutor(overrides);

      await execute('self', {
        command: 'channels create ~owner/team Discussion',
      });

      expect(runCommand).toHaveBeenCalledWith([
        'channels',
        'create',
        '~owner/team',
        'Discussion',
      ]);
    }
  );
});

describe('owner-hosted workspaces and channels with ownerDefault', () => {
  const SKILL_DIR = '/srv/tlon-skill';
  const OWNER_CONFIG = '/srv/tlon-skill/ships/owner.json';
  const HELP_WITH_ADMIN =
    'Usage: tlon groups create-owned "Group Name" --admin <ship> [--description "..."]';
  const HELP_WITHOUT_ADMIN =
    'Usage: tlon groups create-owned "Group Name" --owner <ship> [--description "..."]';
  const BOT = '~pinser-botter-owner';

  function makeExecutor(
    overrides: {
      ownerDefault?: boolean;
      botShip?: string;
      env?: NodeJS.ProcessEnv;
      fileExists?: (path: string) => boolean;
      help?: string;
    } = {}
  ) {
    const { help = HELP_WITH_ADMIN, ...deps } = overrides;
    const runCommand = vi.fn(async (args: string[]) =>
      args.includes('--help') ? help : 'Created.'
    );
    const execute = createTlonToolExecutor({
      runCommand,
      notifyDiaryMigrationDiscovery: vi.fn(async () => true),
      ownerShip: '~owner',
      botShip: BOT,
      ownerDefault: true,
      env: { TLON_SKILL_DIR: SKILL_DIR } as NodeJS.ProcessEnv,
      fileExists: (path: string) => path === OWNER_CONFIG,
      ...deps,
    });
    const ran = () =>
      (runCommand.mock.lastCall as unknown as [string[]] | undefined)?.[0];
    return { execute, runCommand, ran };
  }

  describe('a trailing --self', () => {
    it.each([
      'groups create-owned X --admin ~owner --self',
      'channels create ~owner/team Talk --self',
      'groups add-channel ~owner/team Talk --self',
      'groups join --invite https://invite.tlon.io/0v1.abcde --self',
      'groups join ~zod/team --self',
      'activity mark-read ~ten --self',
    ])('is a bot request on `%s`', (command) => {
      expect(
        normalizeTlonCommandArgs(shellSplitCommand(command)).selfRequested
      ).toBe(true);
    });

    it('leaves a plain groups join to the default identity', async () => {
      for (const [ownerDefault, expected] of [
        [true, ['--ship', '~owner', 'groups', 'join', '~zod/team']],
        [false, ['groups', 'join', '~zod/team']],
      ] as const) {
        const { execute, ran } = makeExecutor({ ownerDefault });
        await execute('join', { command: 'groups join ~zod/team' });
        expect(ran(), String(ownerDefault)).toEqual(expected);
      }
    });

    it('echoes the owner for activity mark-read with the flag on', async () => {
      const { execute, ran } = makeExecutor();
      const result = await execute('mark-read', {
        command: 'activity mark-read ~ten',
      });
      expect(ran()).toEqual([
        '--ship',
        '~owner',
        'activity',
        'mark-read',
        '~ten',
      ]);
      expect(result.content[0].text).toBe('Created.\nRan as ~owner (owner).');
    });

    it('stays literal on other group operations', () => {
      expect(
        normalizeTlonCommandArgs(
          shellSplitCommand('groups create X --description --self')
        ).selfRequested
      ).toBe(false);
    });

    it.each([
      // create-owned: the title, and each option's value.
      ['groups create-owned "--self" --admin ~owner', false],
      ['groups create-owned X --description "--self" --admin ~owner', false],
      ['groups create-owned X --admin --self', false],
      ['groups create-owned X --owner --self', false],
      ['groups create-owned X --description Work --self --admin ~owner', true],
      // channel creates: the group, the title, and each option's value.
      ['channels create ~owner/team "--self"', false],
      ['channels create "--self" Talk', false],
      ['channels create ~owner/team Talk --description "--self"', false],
      ['channels create ~owner/team Talk --kind --self', false],
      ['channels create ~owner/team Talk --kind chat --self', true],
      ['groups add-channel ~owner/team "--self"', false],
      ['groups add-channel ~owner/team Talk --description "--self"', false],
      ['groups add-channel ~owner/team Talk --self --kind chat', true],
      // The legacy operations' parsers read --self anywhere as the flag.
      ['activity volume --self ~zod/g soft', true],
      ['notes note-publish notes/~h/b --self 12', true],
      ['groups invite-link ~h/g --self', true],
      ['activity mark-read --self --all', true],
      // groups join: the optional group flag, and --invite's value.
      ['groups join --invite "--self"', false],
      ['groups join ~zod/team', false],
      ['groups join --self', true],
    ])('reads `%s` as a bot request: %s', (command, expected) => {
      expect(
        normalizeTlonCommandArgs(shellSplitCommand(command)).selfRequested
      ).toBe(expected);
    });

    it.each([
      [
        'groups create-owned "--self" --admin ~owner',
        [
          '--ship',
          '~owner',
          'groups',
          'create-owned',
          '--self',
          '--admin',
          BOT,
        ],
        // Flag off routes it to the owner the same way.
        [
          '--ship',
          '~owner',
          'groups',
          'create-owned',
          '--self',
          '--admin',
          BOT,
        ],
      ],
      [
        'groups create-owned Projects --description "--self" --admin ~owner',
        [
          '--ship',
          '~owner',
          'groups',
          'create-owned',
          'Projects',
          '--admin',
          BOT,
          '--description',
          '--self',
        ],
        // Flag off routes it to the owner the same way.
        [
          '--ship',
          '~owner',
          'groups',
          'create-owned',
          'Projects',
          '--admin',
          BOT,
          '--description',
          '--self',
        ],
      ],
      [
        'channels create ~owner/team "--self"',
        ['--ship', '~owner', 'channels', 'create', '~owner/team', '--self'],
        ['--ship', '~owner', 'channels', 'create', '~owner/team', '--self'],
      ],
      [
        'groups add-channel ~owner/team Talk --description "--self"',
        [
          '--ship',
          '~owner',
          'groups',
          'add-channel',
          '~owner/team',
          'Talk',
          '--description',
          '--self',
        ],
        [
          '--ship',
          '~owner',
          'groups',
          'add-channel',
          '~owner/team',
          'Talk',
          '--description',
          '--self',
        ],
      ],
    ])(
      'keeps a literal --self from switching identity: `%s`',
      async (command, flagOn, flagOff) => {
        for (const [ownerDefault, expected] of [
          [true, flagOn],
          [false, flagOff],
        ] as const) {
          const { execute, ran } = makeExecutor({ ownerDefault });
          await execute('literal', { command });
          expect(ran(), String(ownerDefault)).toEqual(expected);
        }
      }
    );

    it.each([
      [
        'groups create-owned X --admin ~owner --self',
        ['groups', 'create-owned', 'X', '--owner', '~owner', '--self'],
      ],
      [
        'channels create ~owner/team Talk --self',
        ['channels', 'create', '~owner/team', 'Talk', '--self'],
      ],
      [
        'groups add-channel ~owner/team Talk --self',
        ['groups', 'add-channel', '~owner/team', 'Talk', '--self'],
      ],
      [
        'groups join --invite https://invite.tlon.io/0v1.abcde --self',
        [
          'groups',
          'join',
          '--invite',
          'https://invite.tlon.io/0v1.abcde',
          '--self',
        ],
      ],
      [
        'activity mark-read ~ten --self',
        ['activity', 'mark-read', '~ten', '--self'],
      ],
    ])(
      'runs `%s` as the bot in both flag states',
      async (command, expected) => {
        for (const ownerDefault of [true, false]) {
          const { execute, ran } = makeExecutor({ ownerDefault });
          const result = await execute('self', { command });
          expect(ran(), String(ownerDefault)).toEqual(expected);
          expect(result.content[0].text).not.toContain('Note:');
          if (ownerDefault) {
            expect(result.content[0].text).toContain(`Ran as ${BOT} (bot).`);
          }
        }
      }
    );

    it.each([
      [
        '--self groups create-owned X --admin ~owner',
        ['groups', 'create-owned', 'X', '--owner', '~owner'],
      ],
      [
        '--self channels create ~owner/team Talk',
        ['channels', 'create', '~owner/team', 'Talk'],
      ],
    ])(
      'opts out of owner routing with a leading --self, flag off: `%s`',
      async (command, expected) => {
        const { execute, ran } = makeExecutor({ ownerDefault: false });
        await execute('self', { command });
        expect(ran()).toEqual(expected);
      }
    );
  });

  describe('groups create-owned', () => {
    it.each([
      [
        '--admin',
        'groups create-owned Projects --admin ~owner --description Work',
      ],
      [
        '--owner',
        'groups create-owned Projects --owner owner --description Work',
      ],
    ])(
      'rebuilds a workspace naming the owner with %s, the bot as admin',
      async (_label, command) => {
        const { execute, ran } = makeExecutor();
        const result = await execute('owner', { command });
        expect(ran()).toEqual([
          '--ship',
          '~owner',
          'groups',
          'create-owned',
          'Projects',
          '--admin',
          BOT,
          '--description',
          'Work',
        ]);
        expect(result.content[0].text).toBe('Created.\nRan as ~owner (owner).');
      }
    );

    it('runs a workspace for someone else as the owner, as written', async () => {
      const { execute, ran } = makeExecutor();
      await execute('other', {
        command: 'groups create-owned Projects --admin ~someone',
      });
      expect(ran()).toEqual([
        '--ship',
        '~owner',
        'groups',
        'create-owned',
        'Projects',
        '--owner',
        '~someone',
      ]);
    });

    it('runs the bot named as admin as the owner, as written', async () => {
      const { execute, ran, runCommand } = makeExecutor();
      await execute('bot-admin', {
        command: `groups create-owned Projects --admin ${BOT}`,
      });
      expect(ran()).toEqual([
        '--ship',
        '~owner',
        'groups',
        'create-owned',
        'Projects',
        '--owner',
        BOT,
      ]);
      // No rebuild, so no --admin probe.
      expect(runCommand).toHaveBeenCalledTimes(1);
    });

    it.each([
      [
        'the CLI predates --admin',
        { help: HELP_WITHOUT_ADMIN },
        "Blocked: the installed tlon CLI cannot host this workspace on the owner's ship (create-owned has no --admin); nothing was run. Add --self to create a bot-hosted group instead.",
      ],
      [
        "the bot's ship is unknown",
        { botShip: undefined },
        "Blocked: this bot's own ship could not be determined, so the workspace cannot be hosted on the owner's ship; nothing was run. Add --self to create a bot-hosted group instead.",
      ],
    ])(
      'refuses, with no fallback to the bot, when %s',
      async (_label, overrides, message) => {
        const { execute, runCommand } = makeExecutor(overrides);
        const result = await execute('unsupported', {
          command: 'groups create-owned Projects --admin ~owner',
        });
        expect(result.content[0].text).toBe(message);
        expect(result.details).toEqual({
          status: 'blocked',
          blocked: true,
          reason: 'owner_workspace_unsupported',
        });
        // At most the --admin probe ran; never the create.
        for (const [args] of runCommand.mock.calls as unknown as [string[]][]) {
          expect(args).toContain('--help');
        }
      }
    );

    it('still lets --self make the bot-hosted group in those cases', async () => {
      const { execute, ran } = makeExecutor({
        help: HELP_WITHOUT_ADMIN,
        botShip: undefined,
      });
      await execute('self', {
        command: '--self groups create-owned Projects --admin ~owner',
      });
      expect(ran()).toEqual([
        'groups',
        'create-owned',
        'Projects',
        '--owner',
        '~owner',
      ]);
    });

    it('fails closed, with no fallback, when the owner is unprovisioned', async () => {
      const { execute, runCommand } = makeExecutor({ fileExists: () => false });
      const result = await execute('unprovisioned', {
        command: 'groups create-owned Projects --admin ~owner',
      });
      expect(result.content[0].text).toContain(
        'owner credentials for ~owner are not provisioned'
      );
      expect(runCommand).not.toHaveBeenCalled();
    });

    it.each([
      [
        'as the owner',
        'groups create-owned Projects --admin ~owner --description Work',
        ['--ship', '~owner'],
      ],
      [
        'with --self',
        '--self groups create-owned Projects --admin ~owner --description Work',
        [],
      ],
    ])(
      'makes a plain group when the bot is its own owner, %s',
      async (_label, command, prefix) => {
        const { execute, ran } = makeExecutor({ botShip: '~owner' });
        await execute('self-owned', { command });
        expect(ran()).toEqual([
          ...prefix,
          'groups',
          'create',
          'Projects',
          '--description',
          'Work',
        ]);
      }
    );
  });

  describe('channel creates', () => {
    it.each([
      'channels create ~owner/team Talk --kind chat',
      'groups add-channel ~owner/team Talk --kind notes',
    ])('run as the owner by identity alone: `%s`', async (command) => {
      const { execute, runCommand } = makeExecutor();
      const result = await execute('channel', { command });
      expect(runCommand).toHaveBeenCalledTimes(1);
      expect(runCommand).toHaveBeenCalledWith([
        '--ship',
        '~owner',
        ...command.split(' '),
      ]);
      expect(result.content[0].text).not.toContain('Note:');
    });

    it('fail closed, with no fallback note, when the owner is unprovisioned', async () => {
      const { execute, runCommand } = makeExecutor({ fileExists: () => false });
      const result = await execute('channel', {
        command: 'channels create ~owner/team Talk',
      });
      expect(result.content[0].text).toContain('are not provisioned');
      expect(result.content[0].text).not.toContain('Note:');
      expect(runCommand).not.toHaveBeenCalled();
    });

    it('add no --ship of their own when the bot is its own owner', async () => {
      const { execute, ran } = makeExecutor({ botShip: '~owner' });
      await execute('channel', { command: 'channels create ~owner/team Talk' });
      expect(ran()).toEqual([
        '--ship',
        '~owner',
        'channels',
        'create',
        '~owner/team',
        'Talk',
      ]);
    });
  });
});

describe('hooks always act as the bot', () => {
  const OWNER_CONFIG = '/srv/tlon-skill/ships/owner.json';
  const BOT_ONLY_MESSAGE =
    'Error: credential flags (--config, --ship, --url, --code, --cookie) are not accepted on settings, browser or hooks; these commands always run as this bot.';
  const CREDENTIAL_MESSAGE =
    'Error: credential flags (--config, --ship, --url, --code, --cookie) are not accepted. Commands run as the owner by default; add --self to run as this bot.';

  function makeExecutor(ownerDefault: boolean) {
    const runCommand = vi.fn(async (_args: string[]) => 'ok');
    const execute = createTlonToolExecutor({
      runCommand,
      notifyDiaryMigrationDiscovery: vi.fn(async () => true),
      ownerShip: '~owner',
      botShip: '~bot',
      ownerDefault,
      env: { TLON_SKILL_DIR: '/srv/tlon-skill' } as NodeJS.ProcessEnv,
      fileExists: (path: string) => path === OWNER_CONFIG,
    });
    return { execute, runCommand };
  }

  it.each([
    ['hooks add ~h/g hook.hoon', ['hooks', 'add', '~h/g', 'hook.hoon']],
    ['--self hooks add ~h/g hook.hoon', ['hooks', 'add', '~h/g', 'hook.hoon']],
    ['hooks delete hook-1 --help', ['hooks', 'delete', 'hook-1', '--help']],
  ])('runs `%s` as the bot in both flag states', async (command, expected) => {
    for (const ownerDefault of [true, false]) {
      const { execute, runCommand } = makeExecutor(ownerDefault);
      await execute('hooks', { command });
      expect(runCommand, String(ownerDefault)).toHaveBeenCalledWith(expected);
    }
  });

  it('refuses credential flags on hooks in both flag states', async () => {
    // As for settings and browser: with the flag on, every credential flag
    // gets the owner-default wording.
    for (const [ownerDefault, message] of [
      [true, CREDENTIAL_MESSAGE],
      [false, BOT_ONLY_MESSAGE],
    ] as const) {
      const { execute, runCommand } = makeExecutor(ownerDefault);
      const result = await execute('hooks', {
        command: '--ship ~owner hooks add ~h/g hook.hoon',
      });
      expect(result.content[0].text).toBe(message);
      expect(result.details).toMatchObject({ reason: 'credential_override' });
      expect(runCommand).not.toHaveBeenCalled();
    }
  });

  it('says so in the identity guidance', () => {
    expect(formatTlonToolDescription(true)).toContain(
      'settings, browser and hooks always act as the bot'
    );
    expect(formatTlonToolHelp(true)).toContain('hooks: always this bot');
  });
});

describe('checkBlockedTlonOperation', () => {
  it('does not block channels leave or join on chat and heap nests', () => {
    expect(
      checkBlockedTlonOperation(['channels', 'leave', 'chat/~zod/x'])
    ).toBeNull();
    expect(
      checkBlockedTlonOperation(['channels', 'join', 'heap/~zod/x'])
    ).toBeNull();
  });

  it('blocks migration writes after a separate --config prefix', () => {
    expect(
      checkBlockedTlonOperation([
        '--config',
        '/tmp/owner.json',
        'notes',
        'migrate-apply',
        'diary/~zod/log',
        '--yes',
      ])
    ).toMatchObject({
      reason: 'migration_operation',
      diaryNest: 'diary/~zod/log',
      message: expect.stringContaining('/migrate diary/~zod/log'),
    });
  });

  it('carries an option-before-nest migration source into discovery metadata', () => {
    expect(
      checkBlockedTlonOperation([
        'notes',
        'migrate-apply',
        '--yes',
        'Diary/ZOD/log',
      ])
    ).toMatchObject({
      reason: 'migration_operation',
      diaryNest: 'diary/~zod/log',
      message: expect.stringContaining('/migrate diary/~zod/log'),
    });
  });

  it('blocks a targeted notebook call with its canonical diary nest', () => {
    expect(
      checkBlockedTlonOperation(['notebook', 'Diary/ZOD/Field-Notes', 'Title'])
    ).toMatchObject({
      reason: 'diary_operation',
      diaryNest: 'diary/~zod/Field-Notes',
      message: expect.stringContaining('/migrate diary/~zod/Field-Notes'),
    });
  });

  it('keeps the honest placeholder for a bare notebook call', () => {
    const blocked = checkBlockedTlonOperation(['notebook']);

    expect(blocked).toMatchObject({
      reason: 'diary_operation',
      message: expect.stringContaining('/migrate <diary-nest>'),
    });
    expect(blocked?.diaryNest).toBeUndefined();
  });

  it('interpolates diary targets refused by the packaged CLI surface', () => {
    expect(
      checkBlockedTlonOperation([
        'messages',
        'channel',
        'diary/~sampel-palnet/field-notes',
      ])
    ).toMatchObject({
      reason: 'diary_operation',
      diaryNest: 'diary/~sampel-palnet/field-notes',
      message: expect.stringContaining(
        '/migrate diary/~sampel-palnet/field-notes'
      ),
    });
  });

  it.each([
    ['messages', 'channel', 'diary/~zod/log', '--help'],
    ['expose', 'check', 'diary/~zod/log/170.141', '--help'],
    ['posts', 'react', 'diary/~zod/log', '170.141', '--help'],
  ])('allows packaged CLI help precedence for %s', (...args) => {
    expect(checkBlockedTlonOperation(args)).toBeNull();
  });

  it.each([
    ['messages', 'search', '--help', '--channel', 'diary/~zod/log'],
    ['posts', 'send', 'diary/~zod/log', '--help'],
    ['posts', 'reply', 'diary/~zod/log', '170.141', '--help'],
    ['posts', 'edit', 'diary/~zod/log', '170.141', '--help'],
  ])('preserves packaged CLI help-literal precedence for %s %s', (...args) => {
    expect(checkBlockedTlonOperation(args)).toMatchObject({
      reason: 'diary_operation',
      diaryNest: 'diary/~zod/log',
    });
  });

  it('blocks migration writes after an equals-style credential prefix', () => {
    const blocked = checkBlockedTlonOperation([
      '--url=https://example.test',
      '--ship',
      '~zod',
      '--code',
      'secret',
      'notes',
      'notebook-delete',
      'Notes/ZOD/log',
      '--yes',
    ]);

    expect(blocked).toMatchObject({
      reason: 'migration_operation',
      message: expect.stringContaining('/migrate cleanup notes/~zod/log'),
    });
    expect(blocked?.message).not.toContain('<notes-nest>');
    expect(blocked?.message).not.toContain('<diary-nest>');
  });

  it('blocks notes channel deletion with the owner cleanup command', () => {
    expect(
      checkBlockedTlonOperation([
        'channels',
        'delete',
        'Notes/SAMPEL-PALNET/field-notes',
      ])
    ).toMatchObject({
      reason: 'migration_operation',
      message: expect.stringContaining(
        '/migrate cleanup notes/~sampel-palnet/field-notes'
      ),
    });
  });

  it('preserves non-notes channel deletion behavior', () => {
    for (const kind of ['chat', 'heap']) {
      expect(
        checkBlockedTlonOperation(['channels', 'delete', `${kind}/~zod/log`])
      ).toBeNull();
    }
    expect(
      checkBlockedTlonOperation(['channels', 'delete', 'diary/~zod/log'])
    ).toMatchObject({
      reason: 'diary_operation',
      diaryNest: 'diary/~zod/log',
      message: expect.stringContaining('/migrate diary/~zod/log'),
    });
  });

  it('blocks notes channel deletion after a credential prefix', () => {
    expect(
      checkBlockedTlonOperation([
        '--config',
        '/tmp/owner.json',
        'channels',
        'delete',
        'notes/~zod/log',
      ])
    ).toMatchObject({
      reason: 'migration_operation',
      message: expect.stringContaining('/migrate cleanup notes/~zod/log'),
    });
  });

  it('finds an option-before-nest notes channel deletion target', () => {
    expect(
      checkBlockedTlonOperation([
        'channels',
        'delete',
        '--yes',
        'Notes/ZOD/log',
      ])
    ).toMatchObject({
      reason: 'migration_operation',
      message: expect.stringContaining('/migrate cleanup notes/~zod/log'),
    });
  });

  it('allows the exact read-only migration plan', () => {
    expect(
      checkBlockedTlonOperation([
        '--config',
        '/tmp/owner.json',
        'notes',
        'migrate-plan',
        'diary/~zod/log',
      ])
    ).toBeNull();
  });
});

const documentedActionOperations = {
  activity: [
    'mentions',
    'replies',
    'all',
    'unreads',
    'mute',
    'unmute',
    'volume',
  ],
  browser: ['handoff', 'share'],
  buckets: [
    'list',
    'show',
    'files',
    'search',
    'create',
    'mkdir',
    'upload',
    'read',
    'rename',
    'move',
    'delete',
    'set-writers',
  ],
  channels: [
    'dms',
    'group-dms',
    'groups',
    'all',
    'info',
    'create',
    'update',
    'rename',
    'delete',
    'leave',
    'join',
    'add-writers',
    'del-writers',
    'add-readers',
    'del-readers',
  ],
  contacts: [
    'list',
    'self',
    'get',
    'sync',
    'add',
    'remove',
    'del',
    'update',
    'update-profile',
  ],
  dms: ['send', 'reply', 'react', 'unreact', 'delete', 'accept', 'decline'],
  expose: ['list', 'show', 'hide', 'check', 'url'],
  groups: [
    'list',
    'create',
    'create-owned',
    'invite',
    'info',
    'invite-link',
    'leave',
    'join',
    'request-invite',
    'accept-invite',
    'reject-invite',
    'cancel-join',
    'rescind-request',
    'revoke-invite',
    'delete',
    'update',
    'kick',
    'ban',
    'unban',
    'add-role',
    'delete-role',
    'update-role',
    'assign-role',
    'remove-role',
    'set-privacy',
    'accept-join',
    'reject-join',
    'promote',
    'demote',
    'add-channel',
    'add-section',
    'rename-section',
    'delete-section',
    'move-channel',
    'order-sections',
  ],
  hooks: [
    'init',
    'list',
    'get',
    'add',
    'edit',
    'delete',
    'del',
    'order',
    'config',
    'cron',
    'rest',
  ],
  messages: ['dm', 'channel', 'history', 'search', 'context', 'post'],
  notes: [
    'status',
    'request',
    'list',
    'show',
    'notes',
    'note',
    'create',
    'note-create',
    'note-update',
    'note-rename',
    'note-move',
    'note-delete',
    'note-publish',
    'note-unpublish',
    'history',
    'folders',
    'folder',
    'folder-create',
    'folder-rename',
    'folder-move',
    'folder-delete',
    'members',
    'join',
    'leave',
    'migrate-plan',
    'migrate-apply',
    'notebook-delete',
  ],
  posts: [
    'send',
    'reply',
    'forward',
    'react',
    'unreact',
    'edit',
    'delete',
    'pin',
    'unpin',
  ],
  settings: [
    'get',
    'set',
    'delete',
    'del',
    'allow-dm',
    'add-dm',
    'remove-dm',
    'allow-channel',
    'add-channel',
    'remove-channel',
    'open-channel',
    'restrict-channel',
    'set-rule',
    'authorize-ship',
    'add-auth',
    'deauthorize-ship',
    'remove-auth',
  ],
} as const;

describe('tlon tool telemetry summarizer', () => {
  it('classifies Bucket reads, uploads, and destructive operations without leaking paths', () => {
    const read = summarizeTlonCommand(
      'buckets read buckets/~zod/private-files 12'
    );
    expect(read).toMatchObject({
      channelKind: 'buckets',
      intent: 'read',
      operation: 'read',
      subcommand: 'buckets',
    });

    const upload = summarizeTlonCommand(
      'buckets upload buckets/~zod/private-files ./secret-plan.md -t text/markdown'
    );
    expect(upload).toMatchObject({
      channelKind: 'buckets',
      contentTypeProvided: true,
      intent: 'write',
      operation: 'upload',
      uploadSource: 'local',
    });
    expect(JSON.stringify(upload)).not.toContain('secret-plan.md');
    expect(JSON.stringify(upload)).not.toContain('private-files');

    const deletion = summarizeTlonCommand(
      'buckets delete buckets/~zod/private-files 12'
    );
    expect(deletion).toMatchObject({
      channelKind: 'buckets',
      intent: 'admin',
      operation: 'delete',
    });
  });

  it('accounts for documented tlon action operations', () => {
    for (const [subcommand, operations] of Object.entries(
      documentedActionOperations
    )) {
      for (const operation of operations) {
        const summary = summarizeTlonCommand(`${subcommand} ${operation}`);
        expect(summary).toMatchObject({
          summaryKey: `${subcommand}.${operation}`,
          subcommand,
          operation,
          isKnownSubcommand: true,
        });
        expect(summary.operation).not.toBe('invalid');
      }
    }

    expect(summarizeTlonCommand('upload ./avatar.png')).toMatchObject({
      summaryKey: 'upload.upload',
      subcommand: 'upload',
      operation: 'upload',
      isKnownSubcommand: true,
    });
  });

  it('classifies group creation without leaking the group name', () => {
    const summary = summarizeTlonCommand(
      'groups create "Launch Planning" --description "Highly confidential"'
    );

    expect(summary).toMatchObject({
      kind: 'tlonCommand',
      summaryKey: 'groups.create',
      subcommand: 'groups',
      operation: 'create',
      intent: 'write',
      hasDescription: true,
    });

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('Launch Planning');
    expect(serialized).not.toContain('Highly confidential');
  });

  it('captures invite counts without leaking group flags or invitees', () => {
    const summary = summarizeTlonCommand(
      'groups invite ~zod/quiet-launch ~sampel-palnet ~marzod-marnec'
    );

    expect(summary).toMatchObject({
      summaryKey: 'groups.invite',
      intent: 'admin',
      inviteeCount: 2,
    });

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('~zod/quiet-launch');
    expect(serialized).not.toContain('~sampel-palnet');
    expect(serialized).not.toContain('~marzod-marnec');
  });

  it('normalizes unknown operations without leaking the attempted argument', () => {
    const summary = summarizeTlonCommand('groups "Launch Planning"');

    expect(summary).toMatchObject({
      summaryKey: 'groups.invalid',
      subcommand: 'groups',
      operation: 'invalid',
      intent: 'utility',
      isKnownSubcommand: true,
    });

    expect(JSON.stringify(summary)).not.toContain('Launch Planning');
  });

  it('normalizes missing operations on action command families', () => {
    const summary = summarizeTlonCommand('groups');

    expect(summary).toMatchObject({
      summaryKey: 'groups.invalid',
      subcommand: 'groups',
      operation: 'invalid',
      intent: 'utility',
      isKnownSubcommand: true,
    });
  });

  it('normalizes unknown subcommands without leaking the attempted command', () => {
    const summary = summarizeTlonCommand(
      'run-private-export "Launch Planning"'
    );

    expect(summary).toMatchObject({
      summaryKey: 'unknown.invalid',
      subcommand: 'unknown',
      operation: 'invalid',
      intent: 'utility',
      isKnownSubcommand: false,
    });

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('run-private-export');
    expect(serialized).not.toContain('Launch Planning');
  });

  it('tracks profile fields updated without leaking field values or asset URLs', () => {
    const summary = summarizeTlonCommand(
      'contacts update-profile --nickname "PM Bot" --avatar https://assets.example.com/private.png --bio "hello"'
    );

    expect(summary).toMatchObject({
      summaryKey: 'contacts.update-profile',
      intent: 'write',
      updateFields: ['nickname', 'bio', 'avatar'],
    });

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('PM Bot');
    expect(serialized).not.toContain('https://assets.example.com/private.png');
    expect(serialized).not.toContain('hello');
  });

  it('classifies contact metadata updates without leaking ships or values', () => {
    const summary = summarizeTlonCommand(
      'contacts update ~sampel-palnet --nickname "Private Label" --avatar https://assets.example.com/contact.png'
    );

    expect(summary).toMatchObject({
      summaryKey: 'contacts.update',
      intent: 'write',
      contactCount: 1,
      updateFields: ['nickname', 'avatar'],
    });

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('~sampel-palnet');
    expect(serialized).not.toContain('Private Label');
    expect(serialized).not.toContain('https://assets.example.com/contact.png');
  });

  it('classifies contact deletion aliases as writes', () => {
    const summary = summarizeTlonCommand('contacts del ~sampel-palnet');

    expect(summary).toMatchObject({
      summaryKey: 'contacts.del',
      intent: 'write',
      contactCount: 1,
    });

    expect(JSON.stringify(summary)).not.toContain('~sampel-palnet');
  });

  it('classifies owned group creation without leaking title or owner', () => {
    const summary = summarizeTlonCommand(
      'groups create-owned "Launch Planning" --owner ~sampel-palnet --description "Highly confidential"'
    );

    expect(summary).toMatchObject({
      summaryKey: 'groups.create-owned',
      intent: 'write',
      hasDescription: true,
    });

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('Launch Planning');
    expect(serialized).not.toContain('~sampel-palnet');
    expect(serialized).not.toContain('Highly confidential');
  });

  it('captures upload source without storing the original path', () => {
    const summary = summarizeTlonCommand(
      'upload https://cdn.example.com/private-assets/avatar.png --type image/png'
    );

    expect(summary).toMatchObject({
      summaryKey: 'upload.upload',
      intent: 'write',
      uploadSource: 'url',
      contentTypeProvided: true,
    });

    expect(JSON.stringify(summary)).not.toContain(
      'https://cdn.example.com/private-assets/avatar.png'
    );
  });

  it('summarizes browser handoff without storing its signed capability', () => {
    const summary = summarizeTlonCommand(
      'browser handoff https://browser-session-ovh1.tlon.network/s/private.signature'
    );

    expect(summary).toMatchObject({
      summaryKey: 'browser.handoff',
      subcommand: 'browser',
      operation: 'handoff',
      intent: 'write',
      isKnownSubcommand: true,
    });
    expect(JSON.stringify(summary)).not.toContain('private.signature');
  });

  it('marks wrong-path DM sends as blocked without storing the target ship', () => {
    const summary = summarizeTlonCommand(
      'dms send ~sampel-palnet "hello there"'
    );

    expect(summary).toMatchObject({
      summaryKey: 'dms.send',
      intent: 'write',
      dmTargetKind: 'ship',
      blockedSendOperation: true,
    });

    expect(JSON.stringify(summary)).not.toContain('~sampel-palnet');
    expect(JSON.stringify(summary)).not.toContain('hello there');
  });

  it('summarizes notes commands that are allowed by the tlon gate', () => {
    const summary = summarizeTlonCommand(
      'notes note-create notes/~zod/private root "Launch Plan" --markdown ./launch.md'
    );

    expect(summary).toMatchObject({
      summaryKey: 'notes.note-create',
      subcommand: 'notes',
      operation: 'note-create',
      intent: 'write',
      isKnownSubcommand: true,
      hasTitle: true,
      hasContent: true,
    });

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('notes/~zod/private');
    expect(serialized).not.toContain('Launch Plan');
    expect(serialized).not.toContain('./launch.md');
  });

  it('summarizes notes request status checks without leaking request ids', () => {
    const summary = summarizeTlonCommand('notes request 0vprivate-request-id');

    expect(summary).toMatchObject({
      summaryKey: 'notes.request',
      subcommand: 'notes',
      operation: 'request',
      intent: 'read',
      isKnownSubcommand: true,
    });

    expect(JSON.stringify(summary)).not.toContain('0vprivate-request-id');
  });

  it('captures notes channel kinds from group channel creation', () => {
    const summary = summarizeTlonCommand(
      'groups add-channel ~zod/quiet-launch "Project Notes" --kind notes'
    );

    expect(summary).toMatchObject({
      summaryKey: 'groups.add-channel',
      channelKind: 'notes',
    });

    expect(JSON.stringify(summary)).not.toContain('Project Notes');
  });

  it('classifies notification changes as writes without leaking targets', () => {
    for (const operation of ['mute', 'unmute', 'volume']) {
      const summary = summarizeTlonCommand(
        `activity ${operation} ~zod/secret-group --self`
      );

      expect(summary).toMatchObject({
        summaryKey: `activity.${operation}`,
        operation,
        intent: 'write',
        isKnownSubcommand: true,
      });
      expect(JSON.stringify(summary)).not.toContain('secret-group');
    }
    expect(summarizeTlonCommand('activity unreads')).toMatchObject({
      summaryKey: 'activity.unreads',
      intent: 'read',
    });
    expect(summarizeTlonCommand('activity volume base')).toMatchObject({
      summaryKey: 'activity.volume',
      intent: 'read',
    });
    expect(summarizeTlonCommand('activity volume base soft')).toMatchObject({
      summaryKey: 'activity.volume',
      intent: 'write',
    });
  });

  it('classifies mark-read as a write without leaking targets', () => {
    const summary = summarizeTlonCommand(
      'activity mark-read ~zod/secret-group --self'
    );

    expect(summary).toMatchObject({
      summaryKey: 'activity.mark-read',
      operation: 'mark-read',
      intent: 'write',
      isKnownSubcommand: true,
    });
    expect(JSON.stringify(summary)).not.toContain('secret-group');
    expect(summarizeTlonCommand('activity mark-read --all')).toMatchObject({
      summaryKey: 'activity.mark-read',
      intent: 'write',
    });
  });

  it('classifies post pins as channel admin operations', () => {
    for (const operation of ['pin', 'unpin']) {
      const summary = summarizeTlonCommand(
        `posts ${operation} chat/~zod/quiet-launch 170.141`
      );

      expect(summary).toMatchObject({
        summaryKey: `posts.${operation}`,
        operation,
        intent: 'admin',
        channelKind: 'chat',
        isKnownSubcommand: true,
      });
      expect(JSON.stringify(summary)).not.toContain('quiet-launch');
      expect(JSON.stringify(summary)).not.toContain('170.141');
    }
  });

  it('classifies attachment sends by their channel, never echoing the URL', () => {
    for (const [command, channelKind] of [
      [
        'posts send heap/~zod/quiet-launch --file https://cdn.example.com/s.pdf',
        'heap',
      ],
      [
        'posts send chat/~zod/quiet-launch hi --video https://cdn.example.com/s.mp4',
        'chat',
      ],
      [
        'posts send heap/~zod/quiet-launch --link https://cdn.example.com/s',
        'heap',
      ],
    ] as const) {
      const summary = summarizeTlonCommand(command);

      expect(summary).toMatchObject({
        summaryKey: 'posts.send',
        operation: 'send',
        intent: 'write',
        channelKind,
        isKnownSubcommand: true,
      });
      expect(JSON.stringify(summary)).not.toContain('quiet-launch');
      expect(JSON.stringify(summary)).not.toContain('cdn.example.com');
    }
  });

  it('classifies posts forward as a mutating write in its target channel', () => {
    for (const [command, channelKind] of [
      ['posts forward chat/~zod/quiet-launch 170.141 heap/~zod/d', 'heap'],
      ['posts forward heap/~zod/quiet-launch 170.141 chat/~zod/d', 'chat'],
    ] as const) {
      const summary = summarizeTlonCommand(command);

      expect(summary).toMatchObject({
        summaryKey: 'posts.forward',
        operation: 'forward',
        intent: 'write',
        channelKind,
        isKnownSubcommand: true,
      });
      expect(isMutatingTlonCommand(summary)).toBe(true);
      expect(JSON.stringify(summary)).not.toContain('quiet-launch');
      expect(JSON.stringify(summary)).not.toContain('170.141');
    }
  });

  it('classifies section commands as group admin operations', () => {
    const summary = summarizeTlonCommand(
      'groups move-channel ~zod/quiet-launch chat/~zod/general --section Archive --index 0'
    );

    expect(summary).toMatchObject({
      summaryKey: 'groups.move-channel',
      operation: 'move-channel',
      intent: 'admin',
      isKnownSubcommand: true,
    });

    expect(JSON.stringify(summary)).not.toContain('Archive');
  });

  it('matches the default chat kind for group channel creation', () => {
    const summary = summarizeTlonCommand(
      'groups add-channel ~zod/quiet-launch "General"'
    );

    expect(summary).toMatchObject({
      summaryKey: 'groups.add-channel',
      channelKind: 'chat',
    });

    expect(JSON.stringify(summary)).not.toContain('General');
  });

  it.each(['note-publish', 'note-unpublish'])(
    'classifies notes %s as admin without leaking the nest',
    (operation) => {
      const summary = summarizeTlonCommand(
        `notes ${operation} notes/~zod/secret-launch 12 --self`
      );

      expect(summary).toMatchObject({
        summaryKey: `notes.${operation}`,
        intent: 'admin',
        operation,
      });
      expect(JSON.stringify(summary)).not.toContain('secret-launch');
    }
  );

  it('captures notes channel kinds from channel creation', () => {
    const summary = summarizeTlonCommand(
      'channels create ~zod/quiet-launch "Project Notes" --kind notes --description "private notes"'
    );

    expect(summary).toMatchObject({
      summaryKey: 'channels.create',
      intent: 'write',
      channelKind: 'notes',
      hasTitle: true,
      hasDescription: true,
    });

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('~zod/quiet-launch');
    expect(serialized).not.toContain('Project Notes');
    expect(serialized).not.toContain('private notes');
  });

  it('matches the default chat kind for channel creation', () => {
    const summary = summarizeTlonCommand(
      'channels create ~zod/quiet-launch "General"'
    );

    expect(summary).toMatchObject({
      summaryKey: 'channels.create',
      intent: 'write',
      channelKind: 'chat',
      hasTitle: true,
    });

    expect(JSON.stringify(summary)).not.toContain('General');
  });

  it('classifies channels leave as a write with its channel kind', () => {
    expect(summarizeTlonCommand('channels leave chat/~zod/x')).toMatchObject({
      summaryKey: 'channels.leave',
      intent: 'write',
      channelKind: 'chat',
    });
  });

  it('captures notes channel kinds from notes nests', () => {
    const summary = summarizeTlonCommand(
      'channels info notes/~zod/quiet-launch'
    );

    expect(summary).toMatchObject({
      summaryKey: 'channels.info',
      channelKind: 'notes',
    });
  });

  it('does not report deprecated diary channels as a CLI-managed channel kind', () => {
    const summary = summarizeTlonCommand(
      'channels info diary/~zod/quiet-launch'
    );

    expect(summary).toMatchObject({
      summaryKey: 'channels.info',
    });
    expect(summary.channelKind).toBeUndefined();
  });

  it('captures channel kinds from message history aliases', () => {
    const summary = summarizeTlonCommand(
      'messages history chat/~zod/quiet-launch --limit 5 --resolve-cites'
    );

    expect(summary).toMatchObject({
      summaryKey: 'messages.history',
      intent: 'read',
      channelKind: 'chat',
      limit: 5,
      resolveCites: true,
    });

    expect(JSON.stringify(summary)).not.toContain('chat/~zod/quiet-launch');
  });

  it('captures channel kinds from full expose cite paths', () => {
    const summary = summarizeTlonCommand(
      'expose show /1/chan/heap/~zod/quiet-launch/curio/170.141'
    );

    expect(summary).toMatchObject({
      summaryKey: 'expose.show',
      intent: 'admin',
      channelKind: 'heap',
    });

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('/1/chan/heap');
    expect(serialized).not.toContain('~zod/quiet-launch');
    expect(serialized).not.toContain('170.141');
  });

  it('does not report deprecated diary cite paths as a CLI-managed channel kind', () => {
    const summary = summarizeTlonCommand(
      'expose check /1/chan/diary/~zod/quiet-launch/note/170.141'
    );

    expect(summary).toMatchObject({
      summaryKey: 'expose.check',
      intent: 'read',
    });
    expect(summary.channelKind).toBeUndefined();
  });

  it('classifies channel renames as writes without leaking the new title', () => {
    const summary = summarizeTlonCommand(
      'channels rename notes/~zod/quiet-launch "Private Roadmap"'
    );

    expect(summary).toMatchObject({
      summaryKey: 'channels.rename',
      intent: 'write',
      channelKind: 'notes',
      hasTitle: true,
    });

    expect(JSON.stringify(summary)).not.toContain('Private Roadmap');
  });

  // The three migration operations are recognized as known `notes` actions, so
  // without explicit cases they fall through to `utility` and telemetry cannot
  // distinguish the read-only plan from the two destructive operations.
  it.each([
    ['notes migrate-plan diary/~zod/log', 'notes.migrate-plan', 'read'],
    [
      'notes migrate-apply diary/~zod/log --yes',
      'notes.migrate-apply',
      'write',
    ],
    [
      'notes notebook-delete notes/~zod/log --yes',
      'notes.notebook-delete',
      'admin',
    ],
  ])('classifies %s by intent', (command, summaryKey, intent) => {
    expect(summarizeTlonCommand(command)).toMatchObject({
      subcommand: 'notes',
      summaryKey,
      intent,
    });
  });
});

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
            details: { blocked: true, reason: 'migration_operation' },
          },
        },
        {
          state: 'resolved',
          value: {
            content: [{ type: 'text', text: BLOCKED_MIGRATION_MESSAGE }],
            details: { blocked: true, reason: 'migration_operation' },
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
    // --config/--code credential flags.
    const logError = vi.fn();
    const execute = createTlonToolExecutor({
      runCommand: vi.fn(async () => 'unexpected CLI invocation'),
      notifyDiaryMigrationDiscovery: vi.fn(async () => true),
      logError,
    });

    await execute('blocked-logging', {
      command:
        'notes migrate-apply diary/~bot/logged-block --yes --code sampel-ticlyt-migfun-falmel',
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
      details: { blocked: true, reason: 'migration_operation' },
    });
    await vi.waitFor(() =>
      expect(logError).toHaveBeenCalledWith(
        'Failed to notify owner about diary migration discovery for diary/~bot/detached-discovery: Error: unexpected bridge failure'
      )
    );
  });
});

describe('checkBlockedTlonOperation', () => {
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
  activity: ['mentions', 'replies', 'all', 'unreads'],
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
  posts: ['send', 'reply', 'react', 'unreact', 'edit', 'delete'],
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

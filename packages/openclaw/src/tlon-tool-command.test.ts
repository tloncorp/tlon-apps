import { describe, expect, it } from 'vitest';

import {
  findTlonSubcommandIndex,
  stripTlonBinaryPrefix,
  summarizeTlonCommand,
} from './tlon-tool-command.js';

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

  it('does not report removed diary channels as a live channel kind', () => {
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

  it('does not report removed diary full cite paths as a live channel kind', () => {
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
});

describe('findTlonSubcommandIndex', () => {
  it('skips a leading binary name, however it is spelled', () => {
    // Every piece of documentation — ours and the CLI's own --help —
    // writes commands as `tlon groups update ...`, so a model obeying the
    // prose literally passes the binary through. Without this the whole
    // command was rejected as an unknown `tlon` subcommand, and the config
    // write it carried never ran.
    for (const argv of [
      ['tlon', 'groups', 'update'],
      ['/usr/local/bin/tlon', 'groups', 'update'],
      ['tlon.js', 'groups', 'update'],
    ]) {
      const index = findTlonSubcommandIndex(argv);
      expect(argv[index]).toBe('groups');
    }
  });

  it('still finds the subcommand with no binary name, and past credentials', () => {
    expect(findTlonSubcommandIndex(['groups', 'update'])).toBe(0);
    const withCreds = ['--url', 'http://x', 'groups', 'update'];
    expect(withCreds[findTlonSubcommandIndex(withCreds)]).toBe('groups');
  });

  it('only strips the binary in front — a later "tlon" is a value', () => {
    // `tlon` as an argument (a group name, a search term) must survive.
    const argv = ['msg', 'send', 'chat/~zod/x', 'tlon'];
    expect(argv[findTlonSubcommandIndex(argv)]).toBe('msg');
    const doubled = ['tlon', 'tlon'];
    expect(doubled[findTlonSubcommandIndex(doubled)]).toBe('tlon');
  });
});

describe('stripTlonBinaryPrefix', () => {
  it('removes the binary the CLI would read as its command', () => {
    // Recognizing the prefix during validation is only half the job: the
    // CLI takes args[0] as its command, so spawning the untouched argv
    // turns a command that just passed the guard into
    // `Unknown command: tlon`.
    expect(stripTlonBinaryPrefix(['tlon', 'groups', 'update'])).toEqual([
      'groups',
      'update',
    ]);
    expect(
      stripTlonBinaryPrefix(['/usr/local/bin/tlon', 'groups', 'list'])
    ).toEqual(['groups', 'list']);
    // Credential flags stay in front of the subcommand where they belong.
    expect(
      stripTlonBinaryPrefix(['--url', 'http://x', 'tlon', 'groups', 'list'])
    ).toEqual(['--url', 'http://x', 'groups', 'list']);
  });

  it('leaves argv alone when there is no prefix, and keeps later values', () => {
    const plain = ['groups', 'update', '~zod/g'];
    expect(stripTlonBinaryPrefix(plain)).toEqual(plain);
    // `tlon` as an argument value must survive — only the front one goes.
    expect(
      stripTlonBinaryPrefix(['msg', 'send', 'chat/~zod/x', 'tlon'])
    ).toEqual(['msg', 'send', 'chat/~zod/x', 'tlon']);
    expect(stripTlonBinaryPrefix([])).toEqual([]);
  });
});

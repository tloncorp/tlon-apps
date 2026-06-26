import { describe, expect, it } from 'vitest';

import { summarizeTlonCommand } from './tlon-tool-command.js';

describe('tlon tool telemetry summarizer', () => {
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
});

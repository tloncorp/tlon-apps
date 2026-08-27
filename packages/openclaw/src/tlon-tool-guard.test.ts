import { describe, expect, it } from 'vitest';

import {
  checkBlockedDiaryOperation,
  checkBlockedMigrationOperation,
  checkBlockedSendOperation,
  checkBlockedStandaloneNotebookCreation,
  formatAllowedTlonSubcommands,
  isAllowedTlonSubcommand,
  notebookNavigationNotice,
  refusedDiaryNest,
} from './tlon-tool-guard.js';

describe('tlon tool guard', () => {
  describe('allowed subcommands', () => {
    it('allows notes commands through the tlon tool gate', () => {
      expect(isAllowedTlonSubcommand('notes')).toBe(true);
      expect(formatAllowedTlonSubcommands()).toContain('notes');
    });

    it('keeps notebook allowed for skill-level removal guidance', () => {
      expect(isAllowedTlonSubcommand('notebook')).toBe(true);
    });
  });

  describe('blocks non-club dms send/reply', () => {
    it('blocks dms send with a ship target', () => {
      const result = checkBlockedSendOperation([
        'dms',
        'send',
        '~zod',
        'hello',
      ]);
      expect(result).toContain('message');
      expect(result).toContain('Blocked');
      expect(result).toContain('target=~zod');
    });

    it('dms send redirect does NOT mention replyTo', () => {
      const result = checkBlockedSendOperation([
        'dms',
        'send',
        '~zod',
        'hello',
      ]);
      expect(result).not.toContain('replyTo');
    });

    it('blocks dms reply with a ship target', () => {
      const result = checkBlockedSendOperation([
        'dms',
        'reply',
        '~sampel-palnet',
        '170.141.184.507',
        'reply text',
      ]);
      expect(result).toContain('message');
      expect(result).toContain('Blocked');
      expect(result).toContain('target=~sampel-palnet');
    });

    it('dms reply redirect includes replyTo with the messageId', () => {
      const result = checkBlockedSendOperation([
        'dms',
        'reply',
        '~sampel-palnet',
        '170.141.184.507',
        'reply text',
      ]);
      expect(result).toContain('replyTo=170.141.184.507');
    });
  });

  describe('blocks migration mutations', () => {
    it.each([
      ['notes', 'migrate'],
      ['notes', 'migrate-apply'],
      ['notes', 'migrate-anything'],
    ])('blocks %s %s', (...args) => {
      expect(checkBlockedMigrationOperation(args)).toContain(
        '/migrate <diary-nest>'
      );
    });

    it('blocks notebook deletion with the cleanup placeholder', () => {
      expect(
        checkBlockedMigrationOperation(['notes', 'notebook-delete'])
      ).toContain('/migrate cleanup <notes-nest>');
    });

    it('allows only the exact migrate-plan operation', () => {
      expect(
        checkBlockedMigrationOperation([
          'notes',
          'migrate-plan',
          'diary/~zod/log',
        ])
      ).toBeNull();
      expect(
        checkBlockedMigrationOperation(['notes', 'migrate-plan-extra'])
      ).toContain('/migrate <diary-nest>');
    });

    it('interpolates a real migration source nest', () => {
      const result = checkBlockedMigrationOperation([
        'notes',
        'migrate-apply',
        'Diary/SAMPEL-PALNET/field-notes',
        '--yes',
      ]);

      expect(result).toContain('/migrate diary/~sampel-palnet/field-notes');
      expect(result).not.toContain('<diary-nest>');
    });

    it('finds an option-before-nest migration source for refusal and discovery', () => {
      const args = [
        'notes',
        'migrate-apply',
        '--yes',
        'Diary/SAMPEL-PALNET/field-notes',
      ];

      const result = checkBlockedMigrationOperation(args);
      expect(result).toContain('/migrate diary/~sampel-palnet/field-notes');
      expect(result).not.toContain('<diary-nest>');
      expect(refusedDiaryNest(args)).toBe('diary/~sampel-palnet/field-notes');
    });

    it('finds an option-before-nest notebook deletion target', () => {
      const args = [
        'notes',
        'notebook-delete',
        '--yes',
        'Notes/SAMPEL-PALNET/field-notes',
      ];

      const result = checkBlockedMigrationOperation(args);
      expect(result).toContain(
        '/migrate cleanup notes/~sampel-palnet/field-notes'
      );
      expect(result).not.toContain('<notes-nest>');
    });

    it('does not block unrelated operations', () => {
      expect(
        checkBlockedMigrationOperation(['notes', 'note-create'])
      ).toBeNull();
      expect(checkBlockedMigrationOperation(['posts', 'migrate-apply'])).toBe(
        null
      );
    });
  });

  describe('blocks app-invisible standalone notebook creation', () => {
    it('blocks an actual standalone create and points to a visible channel', () => {
      const result = checkBlockedStandaloneNotebookCreation([
        'notes',
        'create',
        'Weekly Report',
      ]);

      expect(result).toContain('not listed in Tlon Messenger');
      expect(result).toContain(
        'channels create ~host/group-slug "Title" --kind notes'
      );
      expect(result).toContain('requesting conversation');
      expect(result).toContain('explicitly asked to save durable');
      expect(result).toContain('existing `Updates` Notebook');
      expect(result).toContain('Prefer the current group');
      expect(result).toContain('from a DM, confirm the destination');
      expect(result).toContain('verify the owner is a member');
      expect(result).toContain('groups info <group-id>');
      expect(result).toContain('only when the owner explicitly asks');
      expect(result).toContain('Never silently choose an ambiguous group');
    });

    it('allows help, malformed calls, and non-create notes operations', () => {
      expect(
        checkBlockedStandaloneNotebookCreation(['notes', 'create', '--help'])
      ).toBeNull();
      expect(
        checkBlockedStandaloneNotebookCreation(['notes', 'create'])
      ).toBeNull();
      expect(
        checkBlockedStandaloneNotebookCreation(['notes', 'note-create'])
      ).toBeNull();
    });
  });

  describe('annotates backend notebook path reads with app navigation truth', () => {
    it.each([
      ['notes', 'show', 'notes/~zod/private'],
      ['notes', 'notes', 'notes/zod/private'],
      ['notes', 'note', 'notes/~zod/private', '3'],
    ])('recognizes %j', (...args) => {
      const result = notebookNavigationNotice(args);
      expect(result).toContain('backend identifier');
      expect(result).toContain('not a Tlon Messenger route');
      expect(result).toContain('Notebook channel inside a group');
      expect(result).toContain('channels info <notes-nest>');
    });

    it('ignores unrelated and malformed commands', () => {
      expect(notebookNavigationNotice(['notes', 'list'])).toBeNull();
      expect(
        notebookNavigationNotice(['notes', 'note', 'bad', '3'])
      ).toBeNull();
      expect(
        notebookNavigationNotice(['channels', 'info', 'notes/~zod/private'])
      ).toBeNull();
    });
  });

  describe('blocks removed diary CLI operations', () => {
    it.each([
      [
        ['channels', 'info', 'diary/~sampel-palnet/field-notes'],
        'diary/~sampel-palnet/field-notes',
      ],
      [
        [
          'messages',
          'search',
          'query',
          '--channel',
          'Diary/SAMPEL-PALNET/Field-Notes',
        ],
        'diary/~sampel-palnet/Field-Notes',
      ],
      [
        [
          'expose',
          'check',
          '/1/chan/diary/~sampel-palnet/field-notes/note/170.141',
        ],
        'diary/~sampel-palnet/field-notes',
      ],
    ])('interpolates the target for %j', (args, expectedNest) => {
      const blocked = checkBlockedDiaryOperation(args as string[]);

      expect(blocked).toMatchObject({ nest: expectedNest });
      expect(blocked?.message).toContain(`/migrate ${expectedNest}`);
      expect(blocked?.message).not.toContain('<diary-nest>');
    });

    it.each([
      {
        name: 'valid posts action',
        args: ['posts', 'send', 'diary/~zod/log', 'hello'],
        cliRefusesDiary: true,
      },
      {
        name: 'channels rename missing its new title',
        args: ['channels', 'rename', 'diary/~zod/log'],
        validArgs: ['channels', 'rename', 'diary/~zod/log', 'Archived title'],
        cliRefusesDiary: false,
      },
      {
        name: 'channels add-writers missing its roles',
        args: ['channels', 'add-writers', 'diary/~zod/log'],
        validArgs: ['channels', 'add-writers', 'diary/~zod/log', 'admin'],
        cliRefusesDiary: false,
      },
      {
        name: 'channels del-writers missing its roles',
        args: ['channels', 'del-writers', 'diary/~zod/log'],
        validArgs: ['channels', 'del-writers', 'diary/~zod/log', 'admin'],
        cliRefusesDiary: false,
      },
      {
        name: 'channels add-readers missing its roles',
        args: ['channels', 'add-readers', '~zod/group', 'diary/~zod/log'],
        validArgs: [
          'channels',
          'add-readers',
          '~zod/group',
          'diary/~zod/log',
          'admin',
        ],
        cliRefusesDiary: false,
      },
      {
        name: 'channels del-readers missing its roles',
        args: ['channels', 'del-readers', '~zod/group', 'diary/~zod/log'],
        validArgs: [
          'channels',
          'del-readers',
          '~zod/group',
          'diary/~zod/log',
          'admin',
        ],
        cliRefusesDiary: false,
      },
      {
        name: 'known posts action with incidental missing argument',
        args: ['posts', 'react', 'diary/~zod/log', '170.141'],
        cliRefusesDiary: true,
      },
      {
        name: 'unknown posts action',
        args: ['posts', 'bogus', 'diary/~zod/log'],
        cliRefusesDiary: false,
      },
      {
        name: 'mis-cased posts action',
        args: ['posts', 'Send', 'diary/~zod/log', 'hello'],
        cliRefusesDiary: false,
      },
      {
        name: 'valid expose action',
        args: ['expose', 'check', 'diary/~zod/log/170.141'],
        cliRefusesDiary: true,
      },
      {
        name: 'unknown expose action',
        args: ['expose', 'bogus', 'diary/~zod/log/170.141'],
        cliRefusesDiary: false,
      },
      {
        name: 'mis-cased expose action',
        args: ['expose', 'Check', 'diary/~zod/log/170.141'],
        cliRefusesDiary: false,
      },
      {
        name: 'valid messages search',
        args: ['messages', 'search', 'query', '--channel', 'diary/~zod/log'],
        cliRefusesDiary: true,
      },
      {
        name: 'channel flag in the query position',
        args: ['messages', 'search', '--channel', 'diary/~zod/log'],
        cliRefusesDiary: false,
      },
      {
        name: 'messages context missing its post id',
        args: ['messages', 'context', 'diary/~zod/log'],
        cliRefusesDiary: false,
      },
      {
        name: 'mis-cased messages action',
        args: ['messages', 'Search', 'query', '--channel', 'diary/~zod/log'],
        cliRefusesDiary: false,
      },
    ])(
      'matches CLI validation order for $name',
      ({ args, validArgs, cliRefusesDiary }) => {
        expect(checkBlockedDiaryOperation(args) !== null).toBe(cliRefusesDiary);
        expect(refusedDiaryNest(args) !== null).toBe(cliRefusesDiary);
        if (validArgs) {
          expect(checkBlockedDiaryOperation(validArgs)).not.toBeNull();
          expect(refusedDiaryNest(validArgs)).toBe('diary/~zod/log');
        }
      }
    );
  });

  describe('allows legacy club targets', () => {
    it('allows dms send with a club ID', () => {
      const result = checkBlockedSendOperation([
        'dms',
        'send',
        '0v4.00000.fake1',
        'hello',
      ]);
      expect(result).toBeNull();
    });

    it('allows dms reply with a club ID', () => {
      const result = checkBlockedSendOperation([
        'dms',
        'reply',
        '0v4.00000.fake1',
        '170.141.184.507',
        'reply text',
      ]);
      expect(result).toBeNull();
    });
  });

  describe('allows non-send dms operations', () => {
    it('allows dms react', () => {
      expect(
        checkBlockedSendOperation([
          'dms',
          'react',
          '~zod',
          '170.141.184.507',
          '👍',
        ])
      ).toBeNull();
    });

    it('allows dms accept', () => {
      expect(checkBlockedSendOperation(['dms', 'accept', '~zod'])).toBeNull();
    });

    it('allows dms decline', () => {
      expect(checkBlockedSendOperation(['dms', 'decline', '~zod'])).toBeNull();
    });

    it('allows dms unreact', () => {
      expect(
        checkBlockedSendOperation(['dms', 'unreact', '~zod', '170.141.184.507'])
      ).toBeNull();
    });

    it('allows dms delete', () => {
      expect(
        checkBlockedSendOperation(['dms', 'delete', '~zod', '170.141.184.507'])
      ).toBeNull();
    });
  });

  describe('allows other subcommands', () => {
    it('allows notes', () => {
      expect(
        checkBlockedSendOperation(['notes', 'list', 'notes/~host/slug'])
      ).toBeNull();
    });

    it('allows notebook', () => {
      expect(
        checkBlockedSendOperation(['notebook', 'diary/~host/slug', 'Title'])
      ).toBeNull();
    });

    it('allows posts react', () => {
      expect(
        checkBlockedSendOperation([
          'posts',
          'react',
          'chat/~host/slug',
          '170.141',
          '👍',
        ])
      ).toBeNull();
    });

    it('allows channels groups', () => {
      expect(checkBlockedSendOperation(['channels', 'groups'])).toBeNull();
    });

    it('allows upload', () => {
      expect(
        checkBlockedSendOperation(['upload', 'https://example.com/img.png'])
      ).toBeNull();
    });

    it('allows activity mentions', () => {
      expect(
        checkBlockedSendOperation(['activity', 'mentions', '--limit', '10'])
      ).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('allows empty args', () => {
      expect(checkBlockedSendOperation([])).toBeNull();
    });

    it('allows single arg', () => {
      expect(checkBlockedSendOperation(['dms'])).toBeNull();
    });

    it('leaves a mis-cased send action for the CLI usage error', () => {
      expect(
        checkBlockedSendOperation(['dms', 'Send', '~zod', 'hello'])
      ).toBeNull();
    });

    it('allows dms send with no target', () => {
      expect(checkBlockedSendOperation(['dms', 'send'])).toBeNull();
    });
  });
});

import { A2UI } from '@tloncorp/api';

import { makeA2UIBlob, serializeBlobField } from '../urbit/blob.js';

export type MigrateCardOptions = { title?: string };
export type BuildMigrateCard = (
  command: string,
  opts?: MigrateCardOptions
) => string;

type CardCopy = {
  eyebrow: string;
  title: string;
  context: string[];
  allowNote: string;
  actionLabel: string;
};

const MIGRATION_CARD_WARNING =
  'Migration copies the diary into a new %notes notebook and archives the intact source, but comments, reactions, references, metadata, original authorship, dates, and ordering are not preserved.';

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

function subjectTitle(opts?: MigrateCardOptions): string | undefined {
  const title = opts?.title?.trim();
  return title ? `"${truncate(title, 60)}"` : undefined;
}

function commandContext(command: string): string {
  return `Command: ${truncate(command, 991)}`;
}

function cardCopy(command: string, opts?: MigrateCardOptions): CardCopy {
  const subject = subjectTitle(opts);
  if (command.startsWith('/migrate cleanup ')) {
    return {
      eyebrow: 'Migration cleanup',
      title: subject
        ? `Delete migrated notebook ${subject}?`
        : 'Delete this migrated notebook?',
      context: [
        'Use this after a failed migration leaves a partial %notes notebook.',
        commandContext(command),
      ],
      allowNote:
        'The migrated notebook will be deleted; the archived diary will not be changed.',
      actionLabel: 'Delete notebook',
    };
  }
  if (command.includes(' --allow-write-widening')) {
    return {
      eyebrow: 'Write access',
      title: subject
        ? `Migrate ${subject} to %notes with wider write access?`
        : 'Migrate this diary to %notes with wider write access?',
      context: [
        'The diary permissions cannot be preserved without widening write access.',
        commandContext(command),
      ],
      allowNote:
        'Every reader will become an editor and will be able to edit every note in the migrated notebook.',
      actionLabel:
        'Accept widening and proceed — every reader becomes an editor',
    };
  }
  return {
    eyebrow: 'Diary migration',
    title: subject
      ? `Migrate ${subject} to %notes?`
      : 'Migrate this diary to %notes?',
    context: [
      '%diary is deprecated; migrating lets the bot read and post in this channel.',
      commandContext(command),
    ],
    allowNote: MIGRATION_CARD_WARNING,
    actionLabel: 'Migrate diary',
  };
}

export const buildMigrateCard: BuildMigrateCard = (command, opts) => {
  const copy = cardCopy(command, opts);
  const contextIds = copy.context.map((_, index) => `context${index}`);
  const contextComponents: A2UI.Component[] = copy.context.map(
    (text, index) => ({
      id: `context${index}`,
      component: 'Text',
      variant: 'caption',
      text,
    })
  );
  const components: A2UI.Component[] = [
    { id: 'root', component: 'Card', child: 'body' },
    {
      id: 'body',
      component: 'Column',
      children: [
        'eyebrow',
        'title',
        'titleDivider',
        ...contextIds,
        'divider',
        'details',
        'actions',
      ],
    },
    {
      id: 'eyebrow',
      component: 'Text',
      variant: 'caption',
      text: copy.eyebrow,
    },
    {
      id: 'title',
      component: 'Text',
      variant: 'h3',
      text: copy.title,
    },
    { id: 'titleDivider', component: 'Divider' },
    ...contextComponents,
    { id: 'divider', component: 'Divider' },
    {
      id: 'details',
      component: 'Column',
      children: ['allowNote'],
    },
    {
      id: 'allowNote',
      component: 'Text',
      variant: 'caption',
      text: copy.allowNote,
    },
    {
      id: 'actions',
      component: 'Row',
      children: ['action'],
    },
    {
      id: 'action',
      component: 'Button',
      variant: 'primary',
      child: 'actionLabel',
      action: {
        event: {
          name: A2UI.action.sendMessage,
          context: { text: command },
        },
      },
    },
    { id: 'actionLabel', component: 'Text', text: copy.actionLabel },
  ];

  return serializeBlobField(makeA2UIBlob('migrate-action', 'root', components));
};

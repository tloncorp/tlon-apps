import { A2UI } from '@tloncorp/api';
import { describe, expect, it } from 'vitest';

import { buildMigrateCard } from './migrate-card.js';

function cardComponents(
  command: string,
  opts?: { title?: string }
): Map<string, A2UI.Component> {
  const [entry] = JSON.parse(buildMigrateCard(command, opts)) as unknown[];
  expect(A2UI.validateBlobEntry(entry)).toBe(true);
  if (!A2UI.validateBlobEntry(entry)) {
    throw new Error('Expected a valid A2UI blob entry');
  }
  const update = A2UI.getUpdateMessage(entry);
  if (!update) {
    throw new Error('Expected an A2UI update message');
  }
  return new Map(
    update.updateComponents.components.map((component) => [
      component.id,
      component,
    ])
  );
}

function textSnapshot(component: A2UI.Component | undefined) {
  if (component?.component !== 'Text') {
    return undefined;
  }
  return {
    id: component.id,
    variant: component.variant,
    text: component.text,
  };
}

describe('buildMigrateCard', () => {
  it.each([
    {
      command: '/migrate diary/~bot/log',
      eyebrow: 'Diary migration',
      title: 'Migrate "Notebook" to %notes?',
      context:
        '%diary is deprecated; migrating lets the bot read and post in this channel.',
      allowNote:
        'Migration copies the diary into a new %notes notebook and archives the intact source, but comments, reactions, references, metadata, original authorship, dates, and ordering are not preserved.',
      actionLabel: 'Migrate diary',
    },
    {
      command: '/migrate cleanup notes/~bot/log',
      eyebrow: 'Migration cleanup',
      title: 'Delete migrated notebook "Notebook"?',
      context:
        'Use this after a failed migration leaves a partial %notes notebook.',
      allowNote:
        'The migrated notebook will be deleted; the archived diary will not be changed.',
      actionLabel: 'Delete notebook',
    },
    {
      command: '/migrate diary/~bot/log --allow-write-widening',
      eyebrow: 'Write access',
      title: 'Migrate "Notebook" to %notes with wider write access?',
      context:
        'The diary permissions cannot be preserved without widening write access.',
      allowNote:
        'Every reader will become an editor and will be able to edit every note in the migrated notebook.',
      actionLabel:
        'Accept widening and proceed — every reader becomes an editor',
    },
  ])(
    'builds the approval-card structure for $command',
    ({ command, eyebrow, title, context, allowNote, actionLabel }) => {
      const components = cardComponents(command, { title: 'Notebook' });

      expect(components.get('body')).toMatchObject({
        component: 'Column',
        children: [
          'eyebrow',
          'title',
          'titleDivider',
          'context0',
          'context1',
          'divider',
          'details',
          'actions',
        ],
      });
      expect([
        textSnapshot(components.get('eyebrow')),
        textSnapshot(components.get('title')),
        textSnapshot(components.get('context0')),
        textSnapshot(components.get('context1')),
        textSnapshot(components.get('allowNote')),
      ]).toEqual([
        { id: 'eyebrow', variant: 'caption', text: eyebrow },
        { id: 'title', variant: 'h3', text: title },
        { id: 'context0', variant: 'caption', text: context },
        {
          id: 'context1',
          variant: 'caption',
          text: `Command: ${command}`,
        },
        { id: 'allowNote', variant: 'caption', text: allowNote },
      ]);
      expect([
        components.get('titleDivider')?.component,
        components.get('divider')?.component,
      ]).toEqual(['Divider', 'Divider']);
      expect(components.get('details')).toMatchObject({
        component: 'Column',
        children: ['allowNote'],
      });
      expect(components.get('actions')).toMatchObject({
        component: 'Row',
        children: ['action'],
      });
      expect(
        [...components.values()].filter(
          (component) => component.component === 'Button'
        )
      ).toHaveLength(1);

      const action = components.get('action');
      expect(action).toMatchObject({
        component: 'Button',
        variant: 'primary',
        child: 'actionLabel',
        action: {
          event: {
            context: { text: command },
          },
        },
      });
      expect(textSnapshot(components.get('actionLabel'))?.text).toBe(
        actionLabel
      );
    }
  );

  it.each([
    ['/migrate diary/~bot/log', 'Migrate this diary to %notes?'],
    [
      '/migrate diary/~bot/log --allow-write-widening',
      'Migrate this diary to %notes with wider write access?',
    ],
    ['/migrate cleanup notes/~bot/log', 'Delete this migrated notebook?'],
  ])('uses a generic question without a title for %s', (command, title) => {
    const components = cardComponents(command);
    expect(textSnapshot(components.get('title'))).toEqual({
      id: 'title',
      variant: 'h3',
      text: title,
    });
  });
});

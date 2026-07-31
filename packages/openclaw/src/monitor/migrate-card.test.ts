import { A2UI } from '@tloncorp/api';
import { describe, expect, it } from 'vitest';

import { buildMigrateCard } from './migrate-card.js';

type SerializedCard = Array<{
  messages: Array<{
    updateComponents?: {
      components: Array<{
        id: string;
        component: string;
        text?: string;
        child?: string;
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

describe('buildMigrateCard', () => {
  it.each([
    [
      '/migrate diary/~bot/log --allow-write-widening',
      'Accept widening and proceed — every reader becomes an editor',
    ],
    ['/migrate diary/~bot/log', 'Migrate diary'],
    ['/migrate cleanup notes/~bot/log', 'Delete notebook'],
  ])('builds one exact action for %s', (command, expectedLabel) => {
    const [entry] = JSON.parse(buildMigrateCard(command)) as SerializedCard;
    expect(A2UI.validateBlobEntry(entry as A2UI.BlobEntry)).toBe(true);
    const components = entry?.messages.find(
      (message) => message.updateComponents
    )?.updateComponents?.components;
    const [button] =
      components?.filter((component) => component.component === 'Button') ?? [];

    expect(
      components?.filter((component) => component.component === 'Button')
    ).toHaveLength(1);
    expect(button?.action?.event?.context?.text).toBe(command);
    expect(
      components?.find((component) => component.id === button?.child)?.text
    ).toBe(expectedLabel);
  });
});

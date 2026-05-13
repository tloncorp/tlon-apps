import { describe, expect, test } from 'vitest';

import { A2UI } from '../client/a2ui';
import { appendToPostBlob, parsePostBlob } from '../client/content-helpers';

const a2uiBlobEntry: A2UI.BlobEntry = {
  type: 'a2ui',
  version: 1,
  messages: [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'weather-card',
        catalogId: 'tlon.a2ui.basic.v1',
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'weather-card',
        root: 'root',
        components: [
          { id: 'root', component: 'Card', child: 'body' },
          {
            id: 'body',
            component: 'Column',
            children: ['title', 'summary', 'refreshButton'],
          },
          { id: 'title', component: 'Text', text: 'Weather' },
          { id: 'summary', component: 'Text', text: '72F and clear' },
          {
            id: 'refreshButton',
            component: 'Button',
            child: 'refreshLabel',
            action: {
              event: {
                name: 'tlon.sendMessage',
                context: { text: 'refresh weather' },
              },
            },
          },
          { id: 'refreshLabel', component: 'Text', text: 'Refresh' },
        ],
      },
    },
  ],
};

describe('a2ui blob entries', () => {
  test('validates supported a2ui payloads', () => {
    expect(A2UI.validateBlobEntry(a2uiBlobEntry)).toBe(true);
  });

  test('parsePostBlob parses supported a2ui entries', () => {
    const blob = appendToPostBlob(undefined, a2uiBlobEntry);

    expect(parsePostBlob(blob)).toEqual([a2uiBlobEntry]);
  });

  test('rejects unsupported a2ui components and actions', () => {
    expect(
      parsePostBlob(
        JSON.stringify([
          {
            ...a2uiBlobEntry,
            messages: [
              a2uiBlobEntry.messages[0],
              {
                version: 'v0.9',
                updateComponents: {
                  surfaceId: 'weather-card',
                  components: [
                    { id: 'root', component: 'Badge', text: 'unsupported' },
                  ],
                },
              },
            ],
          },
          {
            ...a2uiBlobEntry,
            messages: [
              a2uiBlobEntry.messages[0],
              {
                version: 'v0.9',
                updateComponents: {
                  surfaceId: 'weather-card',
                  components: [
                    { id: 'root', component: 'Button', child: 'label' },
                    { id: 'label', component: 'Text', text: 'Call function' },
                  ],
                },
              },
            ],
          },
        ])
      )
    ).toEqual([{ type: 'unknown' }, { type: 'unknown' }]);
  });
});

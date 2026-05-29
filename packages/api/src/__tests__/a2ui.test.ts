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

  test('rejects malformed a2ui button optional fields', () => {
    expect(
      A2UI.validateBlobEntry({
        ...a2uiBlobEntry,
        messages: [
          a2uiBlobEntry.messages[0],
          {
            version: 'v0.9',
            updateComponents: {
              surfaceId: 'weather-card',
              root: 'root',
              components: [
                {
                  id: 'root',
                  component: 'Button',
                  child: 'label',
                  disabled: 'false',
                  action: {
                    event: {
                      name: 'tlon.sendMessage',
                      context: { text: 'refresh weather' },
                    },
                  },
                },
                { id: 'label', component: 'Text', text: 'Refresh' },
              ],
            },
          },
        ],
      })
    ).toBe(false);

    expect(
      A2UI.validateBlobEntry({
        ...a2uiBlobEntry,
        messages: [
          a2uiBlobEntry.messages[0],
          {
            version: 'v0.9',
            updateComponents: {
              surfaceId: 'weather-card',
              root: 'root',
              components: [
                {
                  id: 'root',
                  component: 'Button',
                  child: 'label',
                  variant: 'danger',
                  action: {
                    event: {
                      name: 'tlon.sendMessage',
                      context: { text: 'refresh weather' },
                    },
                  },
                },
                { id: 'label', component: 'Text', text: 'Refresh' },
              ],
            },
          },
        ],
      })
    ).toBe(false);
  });

  test('rejects malformed a2ui text optional fields', () => {
    expect(
      A2UI.validateBlobEntry({
        ...a2uiBlobEntry,
        messages: [
          a2uiBlobEntry.messages[0],
          {
            version: 'v0.9',
            updateComponents: {
              surfaceId: 'weather-card',
              root: 'root',
              components: [
                {
                  id: 'root',
                  component: 'Text',
                  text: 'Weather',
                  variant: 999,
                },
              ],
            },
          },
        ],
      })
    ).toBe(false);
  });

  test('rejects duplicate child references in containers', () => {
    expect(
      A2UI.validateBlobEntry({
        ...a2uiBlobEntry,
        messages: [
          a2uiBlobEntry.messages[0],
          {
            version: 'v0.9',
            updateComponents: {
              surfaceId: 'weather-card',
              root: 'root',
              components: [
                {
                  id: 'root',
                  component: 'Column',
                  children: ['summary', 'summary'],
                },
                { id: 'summary', component: 'Text', text: '72F and clear' },
              ],
            },
          },
        ],
      })
    ).toBe(false);
  });

  test('rejects shared child references that expand beyond render limits', () => {
    const layerIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((prefix) =>
      Array.from({ length: 7 }, (_, index) => `${prefix}${index}`)
    );
    const components: A2UI.Component[] = [
      { id: 'root', component: 'Column', children: layerIds[0] },
      ...layerIds.flatMap((ids, layerIndex) =>
        ids.map((id) =>
          layerIndex === layerIds.length - 1
            ? ({ id, component: 'Text', text: 'x' } as const)
            : ({
                id,
                component: 'Column',
                children: layerIds[layerIndex + 1],
              } as const)
        )
      ),
    ];

    expect(components).toHaveLength(50);
    expect(
      A2UI.validateBlobEntry({
        ...a2uiBlobEntry,
        messages: [
          a2uiBlobEntry.messages[0],
          {
            version: 'v0.9',
            updateComponents: {
              surfaceId: 'weather-card',
              root: 'root',
              components,
            },
          },
        ],
      })
    ).toBe(false);
  });

  test('ignores non-object messages when finding update message', () => {
    const entry = {
      ...a2uiBlobEntry,
      messages: [42, ...a2uiBlobEntry.messages],
    } as unknown as A2UI.BlobEntry;

    expect(A2UI.validateBlobEntry(entry)).toBe(true);
    expect(A2UI.getUpdateMessage(entry)).toEqual(a2uiBlobEntry.messages[1]);
    expect(A2UI.getRootComponentId(entry)).toBe('root');
  });
});

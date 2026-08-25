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

  test('validates navigate button actions', () => {
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
                  action: {
                    event: {
                      name: A2UI.action.navigate,
                      context: {
                        target: {
                          type: 'message',
                          channelId: 'chat/~zod/general',
                          postId: '170.141.184.507',
                          parentId: '170.141.184.000',
                          parentAuthorId: '~nec',
                          authorId: '~sampel-palnet',
                          groupId: '~zod/garden',
                        },
                      },
                    },
                  },
                },
                { id: 'label', component: 'Text', text: 'View message' },
              ],
            },
          },
        ],
      })
    ).toBe(true);
  });

  test('rejects malformed navigate targets', () => {
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
                  action: {
                    event: {
                      name: A2UI.action.navigate,
                      context: {
                        target: {
                          type: 'message',
                          postId: '170.141.184.507',
                        },
                      },
                    },
                  },
                },
                { id: 'label', component: 'Text', text: 'View message' },
              ],
            },
          },
        ],
      })
    ).toBe(false);
  });

  test('requires explicit send message text for button actions', () => {
    const buttonWithoutText = {
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
                action: {
                  event: {
                    name: A2UI.action.sendMessage,
                  },
                },
              },
              { id: 'label', component: 'Text', text: 'Refresh' },
            ],
          },
        },
      ],
    };
    const buttonWithBlankText = {
      ...buttonWithoutText,
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
                action: {
                  event: {
                    name: A2UI.action.sendMessage,
                    context: { text: '   ' },
                  },
                },
              },
              { id: 'label', component: 'Text', text: 'Refresh' },
            ],
          },
        },
      ],
    };

    expect(A2UI.validateBlobEntry(buttonWithoutText)).toBe(false);
    expect(A2UI.validateBlobEntry(buttonWithBlankText)).toBe(false);
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

  test('rejects unsupported messages without throwing', () => {
    const entry = {
      ...a2uiBlobEntry,
      messages: [42, ...a2uiBlobEntry.messages],
    } as unknown as A2UI.BlobEntry;

    expect(A2UI.validateBlobEntry(entry)).toBe(false);
    expect(A2UI.getUpdateMessage(entry)).toEqual(a2uiBlobEntry.messages[1]);
    expect(A2UI.getRootComponentId(entry)).toBe('root');
  });

  test('supports the safe Image and Icon catalog components', () => {
    const entry: A2UI.BlobEntry = {
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
                component: 'Row',
                align: 'center',
                children: ['icon', 'image', 'label'],
              },
              { id: 'icon', component: 'Icon', name: 'locationOn' },
              {
                id: 'image',
                component: 'Image',
                url: 'https://example.com/weather.png',
                description: 'Clouds over Brooklyn',
                fit: 'cover',
                variant: 'smallFeature',
              },
              { id: 'label', component: 'Text', text: 'Brooklyn weather' },
            ],
          },
        },
      ],
    };

    expect(A2UI.validateBlobEntry(entry)).toBe(true);
    expect(A2UI.resolveComponentGraph(entry)).toMatchObject({ root: 'root' });
    expect(A2UI.resolveComponentGraph(entry)?.components.size).toBe(4);
  });

  test('rejects unsafe image URLs and unknown icon names', () => {
    const withComponent = (component: unknown) => ({
      ...a2uiBlobEntry,
      messages: [
        a2uiBlobEntry.messages[0],
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'weather-card',
            root: 'root',
            components: [component],
          },
        },
      ],
    });

    expect(
      A2UI.validateBlobEntry(
        withComponent({
          id: 'root',
          component: 'Image',
          url: 'javascript:alert(1)',
        })
      )
    ).toBe(false);
    expect(
      A2UI.validateBlobEntry(
        withComponent({ id: 'root', component: 'Icon', name: 'customSvg' })
      )
    ).toBe(false);
  });

  test('requires a matching surface and falls back to the first component root', () => {
    const missingSurface = {
      ...a2uiBlobEntry,
      messages: [a2uiBlobEntry.messages[1]],
    };
    const omittedRoot = {
      ...a2uiBlobEntry,
      messages: [
        a2uiBlobEntry.messages[0],
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'weather-card',
            components: [
              { id: 'not-root', component: 'Text', text: 'No root' },
            ],
          },
        },
      ],
    };

    expect(A2UI.validateBlobEntry(missingSurface)).toBe(false);
    expect(A2UI.validateBlobEntry(omittedRoot)).toBe(true);
    expect(A2UI.getRootComponentId(omittedRoot as A2UI.BlobEntry)).toBe(
      'not-root'
    );
    expect(A2UI.resolveComponentGraph(omittedRoot)?.root).toBe('not-root');
  });

  test('rejects duplicate component ids and missing child references', () => {
    const makeEntry = (components: unknown[]) => ({
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
    });

    expect(
      A2UI.validateBlobEntry(
        makeEntry([
          { id: 'root', component: 'Text', text: 'First' },
          { id: 'root', component: 'Text', text: 'Second' },
        ])
      )
    ).toBe(false);
    expect(
      A2UI.validateBlobEntry(
        makeEntry([{ id: 'root', component: 'Column', children: ['missing'] }])
      )
    ).toBe(false);
    expect(
      A2UI.validateBlobEntry(
        makeEntry([
          { id: 'root', component: 'Text', text: 'Visible' },
          {
            id: 'orphan',
            component: 'Column',
            children: ['missing'],
          },
        ])
      )
    ).toBe(false);
  });

  test('accepts any nonempty v1 catalog id', () => {
    const withCatalogId = (catalogId: unknown) => ({
      ...a2uiBlobEntry,
      messages: [
        {
          version: 'v0.9',
          createSurface: { surfaceId: 'weather-card', catalogId },
        },
        a2uiBlobEntry.messages[1],
      ],
    });
    const unknownCatalog = withCatalogId('unknown.catalog');

    expect(A2UI.validateBlobEntry(unknownCatalog)).toBe(true);
    expect(A2UI.resolveComponentGraph(unknownCatalog)?.root).toBe('root');
    expect(A2UI.validateBlobEntry(withCatalogId(''))).toBe(false);
    expect(A2UI.validateBlobEntry(withCatalogId('x'.repeat(2049)))).toBe(false);
    expect(A2UI.getValidationTelemetry(unknownCatalog)).toEqual({
      hasUnsupportedCatalog: true,
      unsupportedComponentCount: 0,
    });
  });

  test('rejects unsupported versions and components', () => {
    expect(A2UI.validateBlobEntry({ ...a2uiBlobEntry, version: 2 })).toBe(
      false
    );
    const unknownComponent = {
      ...a2uiBlobEntry,
      messages: [
        a2uiBlobEntry.messages[0],
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'weather-card',
            root: 'root',
            components: [
              { id: 'root', component: 'WeatherMap', location: 'Brooklyn' },
            ],
          },
        },
      ],
    };
    expect(A2UI.validateBlobEntry(unknownComponent)).toBe(false);
    expect(A2UI.getValidationTelemetry(unknownComponent)).toEqual({
      hasUnsupportedCatalog: false,
      unsupportedComponentCount: 1,
    });
  });

  test('rejects oversized and deeply nested payloads', () => {
    const oversized = {
      ...a2uiBlobEntry,
      recipe: 'x'.repeat(33 * 1024),
    };
    let recipe: unknown = 'leaf';
    for (let depth = 0; depth < 25; depth += 1) {
      recipe = { child: recipe };
    }

    expect(A2UI.validateBlobEntry(oversized)).toBe(false);
    expect(A2UI.validateBlobEntry({ ...a2uiBlobEntry, recipe })).toBe(false);
  });
});

import { expect, test } from 'vitest';

import { parsePostBlob } from '../lib/content-helpers';
import { convertContent } from '../lib/postContent';

const a2uiEntry = {
  type: 'a2ui',
  version: 1,
  protocolVersion: '0.8',
  catalogId: 'https://tlon.io/catalogs/ochre/v1/catalog.json',
  root: 'root',
  title: 'Weather',
  surfaceId: 'weather-card',
  recipe: 'weather_card',
  components: [
    {
      id: 'root',
      component: {
        Text: {
          text: { literal: '68F and clear' },
        },
      },
    },
  ],
  dataModel: { location: 'Brooklyn' },
  fallbackText: 'Weather: Brooklyn, 68F and clear.',
};

test('parsePostBlob parses a2ui entries', () => {
  expect(parsePostBlob(JSON.stringify([a2uiEntry]))).toEqual([a2uiEntry]);
});

test('convertContent creates an a2ui block from blob data', () => {
  const content = convertContent([], JSON.stringify([a2uiEntry]));

  expect(content).toEqual([
    {
      type: 'a2ui',
      a2ui: a2uiEntry,
    },
  ]);
});

test('convertContent suppresses rendered a2ui fallback story text', () => {
  const content = convertContent(
    [{ inline: ['Weather: Brooklyn, 68F and clear.'] }],
    JSON.stringify([a2uiEntry])
  );

  expect(content).toEqual([
    {
      type: 'a2ui',
      a2ui: a2uiEntry,
    },
  ]);
});

test('convertContent keeps non-fallback text next to a2ui blobs', () => {
  const content = convertContent(
    [{ inline: ['Here is the weather card you requested.'] }],
    JSON.stringify([a2uiEntry])
  );

  expect(content).toEqual([
    {
      type: 'a2ui',
      a2ui: a2uiEntry,
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Here is the weather card you requested.' },
      ],
    },
  ]);
});

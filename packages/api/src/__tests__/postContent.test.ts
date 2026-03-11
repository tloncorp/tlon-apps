import { expect, test } from 'vitest';

import { appendActionButtonToPostBlob } from '../lib/content-helpers';
import { convertContent, plaintextPreviewOf } from '../lib/postContent';

test('convertContent maps action-button blob entries to action-button blocks', () => {
  const blob = appendActionButtonToPostBlob(undefined, {
    label: 'Approve',
    action: {
      type: 'poke',
      app: 'permissions',
      mark: 'json',
      json: { allow: true, requestId: 'req-123' },
    },
  });

  expect(convertContent(null, blob)).toEqual([
    {
      type: 'action-button',
      actionButton: {
        type: 'action-button',
        version: 1,
        label: 'Approve',
        action: {
          type: 'poke',
          app: 'permissions',
          mark: 'json',
          json: { allow: true, requestId: 'req-123' },
        },
      },
    },
  ]);
});

test('plaintextPreviewOf renders action-button blocks as button labels', () => {
  expect(
    plaintextPreviewOf([
      {
        type: 'action-button',
        actionButton: {
          type: 'action-button',
          version: 1,
          label: 'Approve',
          action: {
            type: 'poke',
            app: 'permissions',
            mark: 'json',
            json: { allow: true, requestId: 'req-123' },
          },
        },
      },
    ])
  ).toBe('[Button: Approve]');
});

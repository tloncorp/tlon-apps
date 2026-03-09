import type { PostContent } from '@tloncorp/shared/logic';
import { expect, test } from 'vitest';

import { groupActionButtonBlocks } from './actionButtonUtils';

const makeActionButtonBlock = (label: string) =>
  ({
    type: 'action-button',
    actionButton: {
      type: 'action-button',
      version: 1,
      label,
      pokeApp: 'permissions',
      pokeMark: 'json',
      pokeJson: { label },
    },
  }) as const;

test('groupActionButtonBlocks groups consecutive action-button blocks into one row', () => {
  const content: PostContent = [
    makeActionButtonBlock('Approve'),
    makeActionButtonBlock('Deny'),
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'after buttons' }],
    },
  ];

  expect(groupActionButtonBlocks(content)).toEqual([
    {
      type: 'action-button-row',
      actionButtons: [
        makeActionButtonBlock('Approve').actionButton,
        makeActionButtonBlock('Deny').actionButton,
      ],
    },
    {
      type: 'block',
      block: {
        type: 'paragraph',
        content: [{ type: 'text', text: 'after buttons' }],
      },
    },
  ]);
});

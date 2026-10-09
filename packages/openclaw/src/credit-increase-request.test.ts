import { A2UI, parsePostBlob } from '@tloncorp/api';
import { expect, it } from 'vitest';
import { buildCreditIncreaseCard } from './credit-increase-request.js';

const episodeId = '697e119d-26da-4df7-a131-89f8a816a7dd';

it('builds a silent native request action with local completion copy', () => {
  const text =
    'Your token credits are low. Your 3 scheduled tasks have been paused.';
  const entry = parsePostBlob(buildCreditIncreaseCard(text, episodeId))[0];
  expect(A2UI.validateBlobEntry(entry)).toBe(true);
  if (!A2UI.validateBlobEntry(entry)) throw new Error('invalid card');
  expect(entry.storyMode).toBe('fallback');
  const components = A2UI.getUpdateMessage(entry)?.updateComponents.components;
  expect(components?.find((c) => c.id === 'message')).toMatchObject({ text });
  expect(components?.find((c) => c.id === 'label')).toMatchObject({
    text: 'Request credit increase',
  });
  expect(components?.find((c) => c.component === 'Button')).toMatchObject({
    consumedLabel: 'Credit Increase Requested',
    action: {
      event: {
        name: A2UI.action.requestCreditIncrease,
        context: { requestId: episodeId },
      },
    },
  });
  expect(JSON.stringify(entry)).not.toContain('tlon.sendMessage');
});

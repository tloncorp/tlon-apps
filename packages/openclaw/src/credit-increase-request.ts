import { A2UI } from '@tloncorp/api';
import { makeA2UIBlob, serializeBlobField } from './urbit/blob.js';

export function buildCreditIncreaseCard(
  message: string,
  episodeId: string
): string {
  const card = makeA2UIBlob(`credit-increase-${episodeId}`, 'root', [
    { id: 'root', component: 'Column', children: ['message', 'request'] },
    { id: 'message', component: 'Text', text: message },
    {
      id: 'request',
      component: 'Button',
      variant: 'primary',
      consumedLabel: 'Credit Increase Requested',
      child: 'label',
      action: {
        event: {
          name: A2UI.action.requestCreditIncrease,
          context: { requestId: episodeId },
        },
      },
    },
    { id: 'label', component: 'Text', text: 'Request credit increase' },
  ]);
  card.storyMode = 'fallback';
  return serializeBlobField(card);
}

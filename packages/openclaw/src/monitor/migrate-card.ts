import { A2UI } from '@tloncorp/api';

import { makeA2UIBlob, serializeBlobField } from '../urbit/blob.js';

export function buildMigrateCard(command: string): string {
  const label = command.startsWith('/migrate cleanup ')
    ? 'Delete notebook'
    : command.includes(' --allow-write-widening')
      ? 'Accept widening and proceed — every reader becomes an editor'
      : 'Migrate diary';
  const components: A2UI.Component[] = [
    { id: 'root', component: 'Card', child: 'action' },
    {
      id: 'action',
      component: 'Button',
      variant: 'primary',
      child: 'actionLabel',
      action: {
        event: {
          name: A2UI.action.sendMessage,
          context: { text: command },
        },
      },
    },
    { id: 'actionLabel', component: 'Text', text: label },
  ];

  return serializeBlobField(makeA2UIBlob('migrate-action', 'root', components));
}

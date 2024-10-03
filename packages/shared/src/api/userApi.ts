import { client } from './urbit';

export const updateTelemetrySetting = async (isEnabled: boolean) =>
  client.poke({
    app: 'settings',
    mark: 'settings-event',
    json: {
      'put-entry': {
        desk: 'groups',
        'bucket-key': 'groups',
        'entry-key': 'logActivity',
        value: isEnabled,
      },
    },
  });

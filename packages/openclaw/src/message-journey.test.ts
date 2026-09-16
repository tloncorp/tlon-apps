import { describe, expect, it, vi } from 'vitest';

import { recordTlonMessageJourneyEvent } from './message-journey.js';

describe('message journey identity', () => {
  it('matches backend ship attributes without changing message IDs', () => {
    const info = vi.fn();
    recordTlonMessageJourneyEvent(
      {
        botShip: ' ZOD ',
        ownerShip: ' ~NEC ',
        peerShip: 'bud',
        destinationKind: 'dm',
        inputMessageId: '~nec/111',
        stage: 'plugin_input_observed',
      },
      { info }
    );

    expect(info).toHaveBeenCalledWith(
      'tlon.message_journey.plugin_input_observed',
      expect.objectContaining({
        'tlon.message_journey.bot_ship': '~zod',
        'tlon.message_journey.owner_ship': '~nec',
        'tlon.message_journey.peer_ship': '~bud',
        'tlon.message_journey.input_message_id': '~nec/111',
      })
    );
  });
});

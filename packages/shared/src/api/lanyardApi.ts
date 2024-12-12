import { patp2bn } from '@urbit/aura';
import { Atom, dwim } from '@urbit/nockjs';

import { getCurrentUserId, pokeNoun } from './urbit';

export function initiatePhoneVerify(phoneNumber: string) {
  const currentUserId = getCurrentUserId();
  const azimuthPoint = new Atom(patp2bn(currentUserId));

  const payload = [
    [null, azimuthPoint],
    ['start', ['phone', phoneNumber]],
  ];
  const noun = dwim(payload);

  return pokeNoun({ app: 'lanyard', mark: 'lanyard-command', noun });
}

export function confirmPhoneVerify(phoneNumber: string, otp: string) {
  // TODO
}

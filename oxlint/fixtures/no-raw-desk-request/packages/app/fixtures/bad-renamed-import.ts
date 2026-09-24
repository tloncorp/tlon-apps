// expect: tlon/no-raw-desk-request
import { poke as send } from '@tloncorp/api/client/urbit';

export const leave = () =>
  send({ app: 'groups', mark: 'group-leave', json: '~zod/g' });

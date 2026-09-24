// expect: tlon/no-raw-desk-request
import { scry } from '@tloncorp/api/lib/../client/urbit';

export const load = () => scry({ app: 'groups', path: '/v99/new' });

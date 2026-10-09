// expect: tlon/no-raw-desk-request
import { scry } from '@tloncorp/api/api/urbit';

export const read = () => scry({ app: 'groups', path: '/v2/groups' });

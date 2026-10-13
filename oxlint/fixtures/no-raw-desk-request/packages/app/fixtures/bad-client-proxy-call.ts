// expect: tlon/no-raw-desk-request
import { client } from '@tloncorp/api';

export const load = () => client.scry({ app: 'groups', path: '/v3/groups' });

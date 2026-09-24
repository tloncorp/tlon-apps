// expect: tlon/no-raw-desk-request
import { scry } from '../urbit.js';

export const load = () => scry({ app: 'groups', path: '/v3/groups' });

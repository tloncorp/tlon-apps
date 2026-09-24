// expect: none
import { scry } from '@tloncorp/api';

export const load = () => scry({ app: 'groups', path: '/v3/groups' });

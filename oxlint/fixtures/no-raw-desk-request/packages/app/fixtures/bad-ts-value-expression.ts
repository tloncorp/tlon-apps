// expect: tlon/no-raw-desk-request
import { scry } from '@tloncorp/api';

export const load = () =>
  (scry as typeof scry)({
    app: 'groups',
    path: '/v3/groups',
  }) satisfies Promise<unknown>;

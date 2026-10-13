// expect: tlon/no-raw-desk-request
import { scry } from '@tloncorp/api';

export class Probe {
  constructor(public result = scry({ app: 'groups', path: '/v99/new' })) {}
}

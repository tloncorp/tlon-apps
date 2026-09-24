// expect: tlon/no-raw-desk-request
import { scryNoun } from '@tloncorp/api/api/urbit';

export const records = () => scryNoun({ app: 'lanyard', path: '/v1/records' });

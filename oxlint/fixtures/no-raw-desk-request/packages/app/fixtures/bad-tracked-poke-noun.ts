// expect: tlon/no-raw-desk-request
import { trackedPokeNoun } from '@tloncorp/api';

export const send = (noun: never) =>
  trackedPokeNoun(
    { app: 'lanyard', mark: 'lanyard-command-1', noun },
    { app: 'lanyard', path: '/v1/records' },
    () => true
  );

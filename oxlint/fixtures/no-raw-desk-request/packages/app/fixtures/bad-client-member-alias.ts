// expect: tlon/no-raw-desk-request
import { client } from '@tloncorp/api/client';

const listen = client.subscribe;
export { listen };

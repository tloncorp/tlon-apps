// expect: none
import { poke } from '@tloncorp/api';
import { getAutomations } from '@tloncorp/api/client/stewardAutomationApi';

export const send = () =>
  poke({ app: 'steward', mark: 'steward-automation-action-1', json: {} });
export { getAutomations };

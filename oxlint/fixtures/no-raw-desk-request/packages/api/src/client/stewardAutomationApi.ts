// expect: none
import { requestJson, scry } from './urbit';

export const getAutomations = () =>
  requestJson('/steward/~/v1/automation/tasks', 'GET');
export const scryAutomations = () =>
  scry({ app: 'steward', path: '/v1/automation/tasks' });

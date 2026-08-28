import type { StewardAutomationTasks } from '../urbit/stewardAutomation';

// TODO(bot-profile): MAKE SCHEDULED TASKS BACKEND-DEPENDENT.
// Restore the scry below and delete the shim. The Scheduled tasks row must
// depend on a real %steward automation mirror answering /v1/automation/tasks,
// so that a ship without the module reports { available: false } and the row
// stays hidden, instead of the client reaching a developer's laptop.
//
//   export function getStewardAutomationTasks() {
//     return scry<StewardAutomationTasks>({
//       app: 'steward',
//       path: '/v1/automation/tasks',
//     });
//   }
//
// Blocked on: the automation module does not exist. db/recurring-task-fixtures
// is frontend-only and adds no desk files, so nothing serves that path and
// nothing carries openclaw's cron definitions onto the ship.
//
// TEMPORARY -- REVERT BEFORE MERGE. The %steward automation mirror does not
// exist yet, so scrying /v1/automation/tasks 404s and the Scheduled tasks row
// can never render on a live profile. This reads openclaw's real cron jobs
// from a local shim so the UI can be exercised end to end.
//
// Two reasons this cannot ship: the URL is a hardcoded localhost port, and
// throwing a plain Error loses the 404 contract that useStewardAutomationTasks
// relies on -- it matches BadResponseError with status 404 to mean "backend
// absent" and degrade to { available: false }. As written, a missing backend
// retries and surfaces as an error instead.
const DEMO_AUTOMATION_URL = 'http://localhost:18790/automation/tasks';

export async function getStewardAutomationTasks() {
  const res = await fetch(DEMO_AUTOMATION_URL);
  if (!res.ok) {
    throw new Error(`automation shim ${res.status}`);
  }
  return (await res.json()) as StewardAutomationTasks;
}

import type * as ub from '../urbit';
import { poke, scry, subscribe } from './urbit';

const APP = 'agent-core';
const ACTION_MARK = 'agent-cron-action';

export function agentCronAction(action: ub.AgentCronAction) {
  return {
    app: APP,
    mark: ACTION_MARK,
    json: action,
  };
}

export function agentCronNotice(cronId: string): ub.AgentCronNotice {
  return {
    type: 'recurring-task-scheduled',
    cronId,
  };
}

export async function createAgentCron(params: ub.AgentCronCreate) {
  return poke(agentCronAction({ create: params }));
}

export async function updateAgentCron(params: ub.AgentCronUpdatePayload) {
  return poke(agentCronAction({ update: params }));
}

export async function pauseAgentCron(id: string) {
  return poke(agentCronAction({ pause: { id } }));
}

export async function resumeAgentCron(id: string) {
  return poke(agentCronAction({ resume: { id } }));
}

export async function cancelAgentCron(id: string) {
  return poke(agentCronAction({ cancel: { id } }));
}

export async function deleteAgentCron(id: string) {
  return poke(agentCronAction({ delete: { id } }));
}

export async function runAgentCronNow(id: string) {
  return poke(agentCronAction({ runNow: { id } }));
}

export async function markAgentCronRunStarted(runId: string) {
  return poke(agentCronAction({ runStarted: { runId } }));
}

export async function markAgentCronRunCompleted(params: {
  runId: string;
  outputPreview?: string | null;
  delivery?: ub.AgentCronDelivery | null;
}) {
  return poke(agentCronAction({ runCompleted: params }));
}

export async function markAgentCronRunFailed(params: {
  runId: string;
  error: string;
}) {
  return poke(agentCronAction({ runFailed: params }));
}

export async function loadAgentCronState() {
  return extractInit(
    await scry<ub.AgentCronUpdate>({
      app: APP,
      path: '/v0',
    })
  );
}

export async function loadAgentCrons() {
  return extractInit(
    await scry<ub.AgentCronUpdate>({
      app: APP,
      path: '/v0/crons',
    })
  ).crons;
}

export async function loadAgentCron(id: string) {
  const update = await scry<ub.AgentCronUpdate>({
    app: APP,
    path: `/v0/crons/${id}`,
  });

  if ('cronUpdated' in update) {
    return update.cronUpdated;
  }

  throw new Error(`Unexpected agent cron response for ${id}`);
}

export async function loadAgentCronRuns() {
  return extractInit(
    await scry<ub.AgentCronUpdate>({
      app: APP,
      path: '/v0/runs',
    })
  ).runs;
}

export async function loadPendingAgentCronRuns() {
  return extractInit(
    await scry<ub.AgentCronUpdate>({
      app: APP,
      path: '/v0/runs/pending',
    })
  ).runs;
}

export async function loadAgentCronRun(id: string) {
  const update = await scry<ub.AgentCronUpdate>({
    app: APP,
    path: `/v0/runs/${id}`,
  });

  if ('runUpdated' in update) {
    return update.runUpdated;
  }

  throw new Error(`Unexpected agent cron run response for ${id}`);
}

export function subscribeToAgentCronUpdates(
  handler: (update: ub.AgentCronUpdate, id?: number) => void
) {
  return subscribe<ub.AgentCronUpdate>({ app: APP, path: '/v0' }, handler);
}

export function subscribeToAgentCronRuns(
  handler: (update: ub.AgentCronUpdate, id?: number) => void
) {
  return subscribe<ub.AgentCronUpdate>({ app: APP, path: '/v0/runs' }, handler);
}

function extractInit(update: ub.AgentCronUpdate): ub.AgentCronInit {
  if ('init' in update) {
    return update.init;
  }

  return { crons: [], runs: [] };
}

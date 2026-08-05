export type AgentCronStatus = 'active' | 'paused' | 'cancelled';
export type AgentCronRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentCronSchedule =
  | { kind: 'once'; next: number }
  | { kind: 'interval'; next: number; every: number };

export type AgentCronTarget =
  | { kind: 'delegated-dm'; moon: string }
  | { kind: 'none' };

export type AgentCronToolPolicy =
  | { kind: 'all' }
  | { kind: 'none' }
  | { kind: 'only'; tools: string[] };

export type AgentCronDelivery =
  | { kind: 'delegated-dm'; moon: string; postId: string | null }
  | { kind: 'none' };

export interface AgentCron {
  id: string;
  title: string | null;
  prompt: string;
  status: AgentCronStatus;
  schedule: AgentCronSchedule;
  target: AgentCronTarget;
  toolPolicy: AgentCronToolPolicy;
  createdAt: number;
  updatedAt: number;
  lastFiredAt: number | null;
}

export interface AgentCronRun {
  id: string;
  cronId: string;
  status: AgentCronRunStatus;
  prompt: string;
  target: AgentCronTarget;
  toolPolicy: AgentCronToolPolicy;
  scheduledFor: number;
  firedAt: number;
  claimedAt: number | null;
  completedAt: number | null;
  outputPreview: string | null;
  delivery: AgentCronDelivery | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AgentCronNotice {
  type: 'recurring-task-scheduled';
  cronId: string;
}

export interface AgentCronCreate {
  id?: string;
  title?: string | null;
  prompt: string;
  schedule: AgentCronSchedule;
  target: AgentCronTarget;
  toolPolicy?: AgentCronToolPolicy;
  status?: AgentCronStatus;
}

export interface AgentCronUpdatePayload {
  id: string;
  title?: string | null;
  prompt?: string;
  schedule?: AgentCronSchedule;
  target?: AgentCronTarget;
  toolPolicy?: AgentCronToolPolicy;
}

export type AgentCronAction =
  | { create: AgentCronCreate }
  | { update: AgentCronUpdatePayload }
  | { pause: { id: string } }
  | { resume: { id: string } }
  | { cancel: { id: string } }
  | { delete: { id: string } }
  | { runNow: { id: string } }
  | { runStarted: { runId: string } }
  | {
      runCompleted: {
        runId: string;
        outputPreview?: string | null;
        delivery?: AgentCronDelivery | null;
      };
    }
  | { runFailed: { runId: string; error: string } };

export interface AgentCronInit {
  crons: AgentCron[];
  runs: AgentCronRun[];
}

export type AgentCronUpdate =
  | { init: AgentCronInit }
  | { cronCreated: AgentCron }
  | { cronUpdated: AgentCron }
  | { cronDeleted: { id: string } }
  | { runRequested: AgentCronRun }
  | { runUpdated: AgentCronRun };

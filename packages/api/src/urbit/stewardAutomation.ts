export type StewardAutomationSchedule =
  | {
      kind: 'cron';
      expr?: string;
      tz?: string;
      staggerMs?: number;
    }
  | {
      kind: 'at';
      at?: number;
    }
  | {
      kind: 'every';
      everyMs?: number;
      anchorMs?: number;
    };

export interface StewardAutomationTask {
  agentId?: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  schedule?: StewardAutomationSchedule;
  sessionTarget?: string;
  wakeMode?: string;
  payload?: {
    kind?: string;
    message?: string;
  };
  createdAtMs?: number;
  updatedAtMs?: number;
}

export type StewardAutomationTasks = Record<
  string,
  Record<string, StewardAutomationTask>
>;

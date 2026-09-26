export type ExpectPlan = 'yes' | 'no' | 'either';

export type Persona = {
  id: string;
  /** Who this person is, in a sentence or two. Shown to the simulator and judge. */
  who: string;
  /** What a good ending looks like for this person. The judge grades against it. */
  wants: string;
  /** Whether a daily task plan is the right ending for this person. */
  expectPlan: ExpectPlan;
  /** First message. When omitted the simulator writes one in character. */
  opening?: string;
  /** Facts the person knows but only shares when asked or when relevant. */
  knows?: string[];
  /** How they write: length, tone, typos. */
  style?: string;
  /** Questions they tolerate before getting impatient. */
  patience?: number;
  /** Questions about the app itself, asked in their own words when it fits. */
  asks?: string[];
  /** Unrelated message sent after the ending, to see if the bot keeps pitching. */
  afterEnding?: string;
  timezone?: string;
};

export type Choice = { question: string; options: string[] };

export type TaskPlan = {
  summary: string;
  purposeId: string;
  purpose: string;
  approach?: string;
  topics: string[];
  scheduleHour: number;
  scheduleMinute: number;
  scheduleDescription: string;
  timezoneOverride?: string;
  taskPrompt: string;
};

export type ToolCallRecord = {
  name: string;
  args: unknown;
  result: string;
  blocked?: boolean;
  error?: boolean;
};

export type TranscriptEvent =
  | { from: 'bot'; kind: 'text'; text: string; source: 'model' | 'coordinator' }
  | { from: 'bot'; kind: 'choice'; choice: Choice }
  | { from: 'bot'; kind: 'plan'; plan: TaskPlan }
  | { from: 'bot'; kind: 'service-setup'; providerId: string }
  | { from: 'bot'; kind: 'silent' }
  | { from: 'bot'; kind: 'suppressed'; text: string }
  | { from: 'user'; kind: 'pick'; text: string }
  | { from: 'user'; kind: 'type'; text: string }
  | { from: 'user'; kind: 'leave'; reason: string }
  | { from: 'system'; kind: 'first-result'; ok: boolean; markdown: string }
  | { from: 'system'; kind: 'phase'; phase: 'after-ending' };

export type BotTurn = {
  userText: string;
  toolCalls: ToolCallRecord[];
  events: TranscriptEvent[];
};

export type Ending = 'plan' | 'user-left' | 'turn-limit' | 'bot-error';

/** Measured facts about a run. Not pass/fail on their own. */
export type Facts = {
  ending: Ending;
  userTurns: number;
  choicesPosted: number;
  botTextMessages: number;
  silentTurns: number;
  suppressedNarration: number;
  planCreated: boolean;
  planMatchesExpectation: boolean;
  firstResultOk: boolean | null;
  onboardingComplete: boolean;
  toolCounts: Record<string, number>;
  blockedToolCalls: number;
  toolErrors: number;
};

export type Issue = { quote: string; problem: string };

export type Judgement = {
  outcome: { matched: boolean; why: string };
  conversation: { score: number | null; issues: Issue[] };
  result: { score: number | null; issues: Issue[] };
  product: { score: number | null; issues: Issue[] };
  followUp: { ok: boolean; why: string };
  ruleBreaks: { rule: string; quote: string }[];
  summary: string;
};

export type KeepVerdict = { keep: boolean; why: string };

export type RunRecord = {
  persona: Persona;
  repeat: number;
  startedAt: string;
  durationMs: number;
  models: { bot: string; user: string; judge: string };
  transcript: TranscriptEvent[];
  turns: BotTurn[];
  firstRunToolCalls: ToolCallRecord[];
  plan?: TaskPlan;
  /** The same task run as if it were tomorrow. Only the judge sees it. */
  secondResult?: { ok: boolean; markdown: string };
  facts: Facts;
  keep?: KeepVerdict;
  judgement?: Judgement;
  costUsd: number;
  error?: string;
};

export type RunSetManifest = {
  label: string;
  createdAt: string;
  gitRev: string;
  gitDirty: boolean;
  models: { bot: string; user: string; judge: string };
  sources: { path: string; sha256: string }[];
  variant?: string;
  personas: string[];
  repeat: number;
};

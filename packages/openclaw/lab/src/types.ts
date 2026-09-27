import type { ClaimCheck, VoiceCheck } from './checks.js';
import type { DeploymentCheck } from './deployed.js';
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
  scheduleDays?: number[];
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
  /** Not posted because a newer owner message overtook the turn. */
  superseded?: boolean;
  /** Ends the turn; OpenClaw stops when every call in a batch sets this. */
  terminate?: boolean;
};

export type TranscriptEvent =
  | { from: 'bot'; kind: 'text'; text: string; source: 'model' | 'coordinator' }
  | { from: 'bot'; kind: 'choice'; choice: Choice; source?: 'coordinator' }
  | { from: 'bot'; kind: 'plan'; plan: TaskPlan }
  | { from: 'bot'; kind: 'service-setup'; providerId: string }
  | { from: 'bot'; kind: 'silent' }
  | { from: 'bot'; kind: 'suppressed'; text: string }
  | { from: 'bot'; kind: 'tip'; text: string; step: string; at: string }
  | { from: 'user'; kind: 'pick'; text: string }
  | { from: 'user'; kind: 'type'; text: string }
  | { from: 'user'; kind: 'tip-ignored'; step: string }
  | { from: 'user'; kind: 'leave'; reason: string }
  | { from: 'system'; kind: 'first-result'; ok: boolean; markdown: string }
  | { from: 'system'; kind: 'phase'; phase: 'after-ending' }
  | {
      from: 'system';
      kind: 'campaign';
      action: string;
      step?: string;
      reason?: string;
      at: string;
    }
  | { from: 'system'; kind: 'task-change'; action: string; job: unknown };

export type BotTurn = {
  userText: string;
  /** When the owner's message went out; real runs use it to match model calls. */
  startedAt?: string;
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
  /** Absent on runs recorded before these checks existed. */
  voice?: VoiceCheck;
  claims?: ClaimCheck;
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

export type KeepVerdict = {
  keep: boolean;
  why: string;
  /** The person's survey, 1 to 5 each; absent on runs graded before it. */
  answered?: number;
  effort?: number;
  ending?: number;
  /** null when no note was posted. */
  notes?: number | null;
  /** 1 to 10. */
  overall?: number;
  worst?: string;
};

export type RunRecord = {
  /** Fast: the lab's own model loop. Real: the local OpenClaw sandbox. */
  mode?: 'fast' | 'real';
  /** Which sandbox ran it, when a real set runs on several. */
  sandbox?: number;
  persona: Persona;
  repeat: number;
  startedAt: string;
  durationMs: number;
  models: { bot: string; user: string; judge: string };
  transcript: TranscriptEvent[];
  turns: BotTurn[];
  firstRunToolCalls: ToolCallRecord[];
  plan?: TaskPlan;
  campaign?: {
    trace: { action: string; step?: string; reason?: string; at: string }[];
    final?: import('../../src/monitor/campaign/model.js').CampaignState;
  };
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
  /** False when the round ran without web search. */
  search?: boolean;
  personas: string[];
  repeat: number;
  checkpoint?: { version: 1; file: string };
  /** How the tested build compared with the deployed one. */
  deployment?: DeploymentCheck;
  mode?: 'fast' | 'real';
  /** The real-run capture fast mode filled in, if any. */
  template?: { openclaw: string; capturedAt: string; capturedFrom: string };
};

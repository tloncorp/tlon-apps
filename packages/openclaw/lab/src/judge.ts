import { readFileSync } from 'node:fs';
import { stringify } from 'yaml';
import {
  type LabConfig,
  PRODUCT_GUIDE_DIR,
  type PromptSources,
  RUBRIC_PATH,
} from './config.js';
import { type CostMeter, chatJson } from './openrouter.js';
import type { Issue, Judgement, RunRecord, TranscriptEvent } from './types.js';

/** Everything that happened, including what the user never sees. */
export function renderForJudge(record: RunRecord): string {
  const lines: string[] = [];
  let turnIndex = 0;
  const describe = (event: TranscriptEvent): string | undefined => {
    if (event.from === 'user') {
      if (event.kind === 'leave') return `USER leaves: ${event.reason}`;
      return `USER (${event.kind === 'pick' ? 'tapped' : 'typed'}): ${event.text}`;
    }
    if (event.from === 'system') {
      if (event.kind === 'phase') return '--- after the ending ---';
      return event.ok
        ? `FIRST RESULT (published to the Updates notebook):\n${event.markdown}`
        : 'FIRST RESULT: the scheduled run produced nothing.';
    }
    switch (event.kind) {
      case 'text':
        return `BOT${event.source === 'coordinator' ? ' (coordinator)' : ''}: ${event.text}`;
      case 'choice':
        return `BOT picker: ${event.choice.question}\n  options: ${event.choice.options.map((o) => `"${o}"`).join(', ')} (+ write your own)`;
      case 'plan':
        return `BOT plan card: ${event.plan.summary}\n  schedule shown: "${event.plan.scheduleDescription}" (runs at ${event.plan.scheduleHour}:${String(event.plan.scheduleMinute).padStart(2, '0')})\n  task prompt: ${event.plan.taskPrompt}`;
      case 'service-setup':
        return `BOT service card: connect ${event.providerId}`;
      case 'silent':
        return 'BOT: (no visible reply)';
      case 'suppressed':
        return `BOT narration (hidden from user by the plugin): ${event.text}`;
    }
  };
  for (const event of record.transcript) {
    const line = describe(event);
    if (line) lines.push(line);
    if (event.from === 'user' && event.kind !== 'leave') {
      const turn = record.turns[turnIndex++];
      const tools = turn?.toolCalls
        .map(
          (call) =>
            `${call.name}${call.blocked ? ' [blocked]' : call.error ? ' [error]' : ''}`
        )
        .join(', ');
      if (tools) lines.push(`  (bot tools this turn: ${tools})`);
    }
  }
  if (record.secondResult) {
    lines.push(
      record.secondResult.ok
        ? `DAY TWO RESULT (the same task run as if it were tomorrow; the person has not seen it):\n${record.secondResult.markdown}`
        : 'DAY TWO RESULT: the second run produced nothing.'
    );
  }
  return lines.join('\n\n');
}

export async function judgeRun(input: {
  record: RunRecord;
  sources: PromptSources;
  config: LabConfig;
  meter: CostMeter;
}): Promise<Judgement> {
  const { record } = input;
  const rubric = readFileSync(RUBRIC_PATH, 'utf8');
  const raw = await chatJson<Partial<Judgement>>({
    key: input.config.openrouterKey,
    model: input.config.models.judge,
    temperature: 0,
    meter: input.meter,
    messages: [
      { role: 'system', content: rubric },
      {
        role: 'user',
        content: [
          '## Persona card',
          stringify(record.persona),
          '## Measured facts',
          JSON.stringify(record.facts, null, 2),
          '## Deployment facts',
          `The bot runs on \`${record.models.bot}\` through OpenRouter. This is a real model, possibly newer than your training data; the bot naming it is not a hallucination. Today is ${new Date(record.startedAt).toDateString()}.`,
          '## What happened',
          renderForJudge(record),
          '## Onboarding skill the bot was running',
          input.sources.skill.text,
          '## Tlon product guide (the reference for checking product answers)',
          input.sources.skills.find((skill) => skill.dir === PRODUCT_GUIDE_DIR)
            ?.text ?? '(not available)',
        ].join('\n\n'),
      },
    ],
  });
  return normalizeJudgement(raw);
}

function normalizeIssues(value: unknown): Issue[] {
  return Array.isArray(value)
    ? value.map((issue) => ({
        quote: String(issue?.quote ?? ''),
        problem: String(issue?.problem ?? ''),
      }))
    : [];
}

export function normalizeJudgement(raw: Partial<Judgement>): Judgement {
  const score = (value: unknown) => (typeof value === 'number' ? value : null);
  return {
    outcome: {
      matched: raw.outcome?.matched === true,
      why: String(raw.outcome?.why ?? ''),
    },
    conversation: {
      score: score(raw.conversation?.score),
      issues: normalizeIssues(raw.conversation?.issues),
    },
    result: {
      score: score(raw.result?.score),
      issues: normalizeIssues(raw.result?.issues),
    },
    product: {
      score: score(raw.product?.score),
      issues: normalizeIssues(raw.product?.issues),
    },
    followUp: {
      ok: raw.followUp?.ok === true,
      why: String(raw.followUp?.why ?? ''),
    },
    ruleBreaks: Array.isArray(raw.ruleBreaks)
      ? raw.ruleBreaks.map((rule) => ({
          rule: String(rule?.rule ?? ''),
          quote: String(rule?.quote ?? ''),
        }))
      : [],
    summary: String(raw.summary ?? ''),
  };
}

export type PairVerdict = { winner: 'A' | 'B' | 'tie'; why: string };

/** Pick the better of two runs of the same persona. Order is shuffled by the caller. */
export async function judgePair(input: {
  a: RunRecord;
  b: RunRecord;
  config: LabConfig;
  meter: CostMeter;
}): Promise<PairVerdict> {
  const rubric = readFileSync(RUBRIC_PATH, 'utf8').replace(
    /## Output[\s\S]*$/,
    ''
  );
  return chatJson<PairVerdict>({
    key: input.config.openrouterKey,
    model: input.config.models.judge,
    temperature: 0,
    meter: input.meter,
    messages: [
      {
        role: 'system',
        content: `${rubric}\n## Task\n\nYou are comparing two conversations with the same person. Decide which one served this person better overall: the ending, the conversation, the first result, and the follow-up. Prefer "tie" only when they are genuinely equivalent. Return only JSON: {"winner": "A" | "B" | "tie", "why": "<two or three sentences quoting the decisive differences>"}`,
      },
      {
        role: 'user',
        content: [
          '## Persona card',
          stringify(input.a.persona),
          '## Conversation A',
          renderForJudge(input.a),
          '## Conversation B',
          renderForJudge(input.b),
        ].join('\n\n'),
      },
    ],
  });
}

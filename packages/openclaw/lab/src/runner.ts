import { agentOnboardingTesting } from '../../src/monitor/agent-onboarding.js';
import { BotSession } from './bot.js';
import type { LabConfig, PromptSources } from './config.js';
import {
  coordinatorAcknowledgement,
  coordinatorReveal,
  runScheduledTask,
} from './first-run.js';
import { judgeRun } from './judge.js';
import type { CostMeter } from './openrouter.js';
import type {
  BotTurn,
  Ending,
  Facts,
  Persona,
  RunRecord,
  ToolCallRecord,
  TranscriptEvent,
} from './types.js';
import { keepVerdict, nextUserMove } from './user.js';

const DEFAULT_TIMEZONE = 'America/New_York';
const DEFAULT_AFTER_ENDING =
  'unrelated but whats a quick dinner i can make tonight with eggs and spinach';

function computeFacts(input: {
  persona: Persona;
  ending: Ending;
  transcript: TranscriptEvent[];
  turns: BotTurn[];
  firstRunToolCalls: ToolCallRecord[];
  planCreated: boolean;
  firstResultOk: boolean | null;
  onboardingComplete: boolean;
}): Facts {
  const endingIndex = input.transcript.findIndex(
    (event) => event.from === 'system' && event.kind === 'phase'
  );
  const beforeEnding =
    endingIndex < 0 ? input.transcript : input.transcript.slice(0, endingIndex);
  const count = (predicate: (event: TranscriptEvent) => boolean) =>
    beforeEnding.filter(predicate).length;
  const calls = [
    ...input.turns.flatMap((turn) => turn.toolCalls),
    ...input.firstRunToolCalls,
  ];
  const toolCounts: Record<string, number> = {};
  for (const call of calls)
    toolCounts[call.name] = (toolCounts[call.name] ?? 0) + 1;
  const { expectPlan } = input.persona;
  return {
    ending: input.ending,
    userTurns: count(
      (event) =>
        event.from === 'user' &&
        (event.kind === 'pick' || event.kind === 'type')
    ),
    choicesPosted: count(
      (event) => event.from === 'bot' && event.kind === 'choice'
    ),
    botTextMessages: count(
      (event) =>
        event.from === 'bot' &&
        event.kind === 'text' &&
        event.source === 'model'
    ),
    silentTurns: count(
      (event) => event.from === 'bot' && event.kind === 'silent'
    ),
    suppressedNarration: count(
      (event) => event.from === 'bot' && event.kind === 'suppressed'
    ),
    planCreated: input.planCreated,
    planMatchesExpectation:
      expectPlan === 'either' || (expectPlan === 'yes') === input.planCreated,
    firstResultOk: input.firstResultOk,
    onboardingComplete: input.onboardingComplete,
    toolCounts,
    blockedToolCalls: calls.filter((call) => call.blocked).length,
    toolErrors: calls.filter((call) => call.error).length,
  };
}

export async function runPersona(input: {
  persona: Persona;
  repeat: number;
  config: LabConfig;
  sources: PromptSources;
  maxTurns: number;
  judge: boolean;
}): Promise<RunRecord> {
  const { persona, config, sources } = input;
  const meter: CostMeter = { usd: 0 };
  const startedAt = new Date();
  const timezone = persona.timezone ?? DEFAULT_TIMEZONE;
  const session = new BotSession(config, sources, timezone, meter);
  const transcript: TranscriptEvent[] = [
    {
      from: 'bot',
      kind: 'text',
      text: agentOnboardingTesting.welcomeText,
      source: 'coordinator',
    },
  ];
  const turns: BotTurn[] = [];
  const firstRunToolCalls: ToolCallRecord[] = [];
  let ending: Ending = 'turn-limit';
  let firstResultOk: boolean | null = null;
  let dayTwo: Promise<{ ok: boolean; markdown: string }> | undefined;
  let error: string | undefined;

  const botTurn = async (text: string) => {
    const turn = await session.turn(text);
    turns.push(turn);
    transcript.push(...turn.events);
    return turn;
  };

  try {
    let lastOptions: string[] | undefined;
    for (let index = 0; index < input.maxTurns; index++) {
      const move =
        index === 0 && persona.opening
          ? ({ action: 'type', text: persona.opening } as const)
          : await nextUserMove({
              persona,
              events: transcript,
              config,
              meter,
              lastOptions,
            });
      if (move.action === 'leave') {
        transcript.push({ from: 'user', kind: 'leave', reason: move.reason });
        ending = 'user-left';
        break;
      }
      transcript.push({ from: 'user', kind: move.action, text: move.text });
      const turn = await botTurn(move.text);
      const choice = turn.events.findLast((event) => event.kind === 'choice');
      lastOptions =
        choice?.kind === 'choice' ? choice.choice.options : undefined;
      if (session.plan) {
        ending = 'plan';
        break;
      }
    }

    if (session.plan) {
      for (const text of coordinatorAcknowledgement(session.plan, timezone)) {
        transcript.push({
          from: 'bot',
          kind: 'text',
          text,
          source: 'coordinator',
        });
      }
      const task = { plan: session.plan, config, sources, timezone, meter };
      const first = await runScheduledTask(task);
      firstRunToolCalls.push(...first.toolCalls);
      firstResultOk = first.ok;
      transcript.push({
        from: 'system',
        kind: 'first-result',
        ok: first.ok,
        markdown: first.markdown,
      });
      if (first.ok) {
        transcript.push({
          from: 'bot',
          kind: 'text',
          text: coordinatorReveal(first.markdown),
          source: 'coordinator',
        });
        // The coordinator marks onboarding complete once the entry publishes.
        session.onboardingComplete = true;
        // Tomorrow's run, for the judge only: does the task produce something new?
        dayTwo = runScheduledTask({
          ...task,
          now: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      }
    }

    transcript.push({ from: 'system', kind: 'phase', phase: 'after-ending' });
    const after = persona.afterEnding ?? DEFAULT_AFTER_ENDING;
    transcript.push({ from: 'user', kind: 'type', text: after });
    await botTurn(after);
  } catch (caught) {
    ending = 'bot-error';
    error = caught instanceof Error ? caught.message : String(caught);
  }
  let secondResult: { ok: boolean; markdown: string } | undefined;
  try {
    secondResult = await dayTwo;
  } catch (caught) {
    secondResult = {
      ok: false,
      markdown: `day-two run failed: ${caught instanceof Error ? caught.message : String(caught)}`,
    };
  }

  const record: RunRecord = {
    persona,
    repeat: input.repeat,
    startedAt: startedAt.toISOString(),
    durationMs: 0,
    models: config.models,
    transcript,
    turns,
    firstRunToolCalls,
    ...(session.plan ? { plan: session.plan } : {}),
    ...(secondResult
      ? {
          secondResult: {
            ok: secondResult.ok,
            markdown: secondResult.markdown,
          },
        }
      : {}),
    facts: computeFacts({
      persona,
      ending,
      transcript,
      turns,
      firstRunToolCalls,
      planCreated: Boolean(session.plan),
      firstResultOk,
      onboardingComplete: session.onboardingComplete,
    }),
    costUsd: 0,
    ...(error ? { error } : {}),
  };

  if (!error) {
    try {
      record.keep = await keepVerdict({
        persona,
        events: transcript,
        config,
        meter,
      });
      if (input.judge) {
        record.judgement = await judgeRun({
          record,
          skillText: sources.skill.text,
          config,
          meter,
        });
      }
    } catch (caught) {
      record.error = `grading failed: ${caught instanceof Error ? caught.message : String(caught)}`;
    }
  }
  record.durationMs = Date.now() - startedAt.getTime();
  record.costUsd = meter.usd;
  return record;
}

import { agentOnboardingTesting } from '../../src/monitor/agent-onboarding.js';
import { BotSession } from './bot.js';
import type { CoordinatorMessage, LabConfig, PromptSources } from './config.js';
import {
  coordinatorAcknowledgement,
  coordinatorJob,
  coordinatorReveal,
  runScheduledTask,
} from './first-run.js';
import { judgeRun } from './judge.js';
import { type CostMeter, OutOfCreditError } from './openrouter.js';
import type {
  BotTurn,
  Ending,
  Facts,
  Persona,
  RunRecord,
  ToolCallRecord,
  TranscriptEvent,
} from './types.js';
import {
  type UserMove,
  followUpMessage,
  keepVerdict,
  nextUserMove,
} from './user.js';
import { createLabCampaign } from './tips.js';

export const DEFAULT_TIMEZONE = 'America/New_York';

/** A moment on the next day (after today) whose weekday is in `days`. */
function nextScheduledDay(days: number[] | undefined, timezone: string) {
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).format(candidate);
    const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
      weekday
    );
    if (!days?.length || days.includes(index)) return candidate;
  }
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

/** The instant that is `hour:minute` local time in `timezone` on `day`'s date. */
function atLocalTime(
  day: Date,
  timezone: string,
  hour: number,
  minute: number
) {
  const localParts = (date: Date) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      })
        .formatToParts(date)
        .map((part) => [part.type, Number(part.value)])
    );
    return parts as Record<
      'year' | 'month' | 'day' | 'hour' | 'minute',
      number
    >;
  };
  const { year, month, day: date } = localParts(day);
  const guess = Date.UTC(year, month - 1, date, hour, minute);
  const seen = localParts(new Date(guess));
  const offset =
    Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute) -
    guess;
  return new Date(guess - offset);
}
export const DEFAULT_AFTER_ENDING =
  'unrelated but whats a quick dinner i can make tonight with eggs and spinach';

export function computeFacts(input: {
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
      (event) =>
        event.from === 'bot' &&
        event.kind === 'choice' &&
        event.source !== 'coordinator'
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
  tips?: number;
  rubric?: string;
  simulatorPolicy?: string;
  /** Share of moves that get a quick second message. */
  doubleTextRate?: number;
  tipMovePolicy?: string;
  keepPolicy?: string;
  campaignPromptPolicy?: string;
  /** Called with the transcript each time it grows, for live previews. */
  onProgress?: (transcript: TranscriptEvent[]) => void;
}): Promise<RunRecord> {
  const { persona, config, sources } = input;
  const meter: CostMeter = { usd: 0 };
  const startedAt = new Date();
  const timezone = persona.timezone ?? DEFAULT_TIMEZONE;
  let virtualNow = () => new Date();
  const session = new BotSession(config, sources, timezone, meter, () =>
    virtualNow()
  );
  const overrides = sources.coordinator?.overrides ?? {};
  const coordinatorEvent = (message: CoordinatorMessage): TranscriptEvent =>
    message.options?.length
      ? {
          from: 'bot',
          kind: 'choice',
          choice: { question: message.text, options: message.options },
          source: 'coordinator',
        }
      : {
          from: 'bot',
          kind: 'text',
          text: message.text,
          source: 'coordinator',
        };
  const welcome: CoordinatorMessage = overrides.welcome ?? {
    text: agentOnboardingTesting.welcomeText,
  };
  const transcript: TranscriptEvent[] = [coordinatorEvent(welcome)];
  const onProgress = input.onProgress;
  if (onProgress) {
    // Every writer (turns, coordinator posts, simulated tips) pushes here.
    transcript.push = (...items) => {
      const length = Array.prototype.push.apply(transcript, items);
      onProgress(transcript);
      return length;
    };
    onProgress(transcript);
  }
  const turns: BotTurn[] = [];
  const firstRunToolCalls: ToolCallRecord[] = [];
  const recordTurn = async (
    text: string,
    replyTo?: string,
    campaignContext?: string,
    followUp?: string
  ) => {
    const turn = await session.turn(text, replyTo, campaignContext, followUp);
    turns.push(turn);
    transcript.push(...turn.events);
    return turn;
  };
  const tips = input.tips
    ? createLabCampaign({
        limit: input.tips,
        startedAt,
        timezone,
        persona,
        plan: () => session.plan,
        copy: sources.tipCopy?.overrides,
        config,
        meter,
        transcript,
        policy: input.campaignPromptPolicy,
        userPolicy: input.simulatorPolicy,
        tipMovePolicy: input.tipMovePolicy,
        botTurn: async (text, context) => {
          await recordTurn(text, undefined, context);
        },
        onHandled: (text) => {
          turns.push({ userText: text, toolCalls: [], events: [] });
        },
      })
    : undefined;
  if (tips) virtualNow = tips.now;
  let ending: Ending = 'turn-limit';
  let firstResultOk: boolean | null = null;
  let startDayTwo:
    | (() => Promise<{ ok: boolean; markdown: string }> | undefined)
    | undefined;
  let error: string | undefined;

  const botTurn = async (
    text: string,
    replyTo?: string,
    followUp?: string
  ): Promise<BotTurn & { followUpArrived?: boolean }> => {
    const campaign = await tips?.ownerMessage(text);
    if (campaign?.handled) {
      const turn = {
        userText: text,
        toolCalls: [],
        events: [],
      } satisfies BotTurn;
      turns.push(turn);
      return turn;
    }
    return recordTurn(text, replyTo, campaign?.context, followUp);
  };

  try {
    await tips?.enroll();
    let lastOptions = welcome.options;
    for (let index = 0; index < input.maxTurns; index++) {
      // With buttons on the welcome, the person may tap one before saying what
      // they came for; without them, they open with their own words.
      let move: UserMove =
        index === 0 && persona.opening && !welcome.options?.length
          ? ({ action: 'type', text: persona.opening } as const)
          : await nextUserMove({
              persona,
              events: transcript,
              config,
              meter,
              policy: input.simulatorPolicy,
              lastOptions,
              ...(index === 0 && persona.opening
                ? {
                    nudge: `You came here wanting to say roughly: "${persona.opening}". Tap a button if one fits, or type your message.`,
                  }
                : {}),
            });
      if (
        move.action !== 'leave' &&
        input.doubleTextRate &&
        Math.random() < input.doubleTextRate
      ) {
        const then = await followUpMessage({
          persona,
          events: [
            ...transcript,
            { from: 'user', kind: move.action, text: move.text },
          ],
          sent: move.text,
          config,
          meter,
          policy: input.simulatorPolicy,
        });
        if (then) move = { ...move, then };
      }
      if (move.action === 'leave') {
        transcript.push({ from: 'user', kind: 'leave', reason: move.reason });
        ending = 'user-left';
        break;
      }
      transcript.push({ from: 'user', kind: move.action, text: move.text });
      let turn = await botTurn(move.text, undefined, move.then);
      if (move.then) {
        // The second message is handled as its own turn once this one ends.
        if (!turn.followUpArrived) {
          transcript.push({ from: 'user', kind: 'type', text: move.then });
        }
        turn = await botTurn(move.then);
      }
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
      // The coordinator creates the job when the plan is provisioned.
      session.cronJobs.push(
        coordinatorJob(session.plan, timezone) as Record<string, unknown>
      );
      await tips?.taskCreated();
      const task = { plan: session.plan, config, sources, timezone, meter };
      const first = await runScheduledTask(task);
      firstRunToolCalls.push(...first.toolCalls);
      firstResultOk = first.ok;
      tips?.taskResult(
        first.ok,
        String(
          session.cronJobs.find((job) => job.id === 'job-1')?.name ??
            'Tlonbot scheduled update'
        )
      );
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
        // The next scheduled run, for the judge only: does it produce
        // something new? It runs after the conversation, from the job as it
        // stands then, so edits the owner asked for show up.
        const plan = session.plan;
        const planTimezone = plan.timezoneOverride?.trim() || timezone;
        startDayTwo = () => {
          const job = session.cronJobs.find((entry) => entry.id === 'job-1') as
            | {
                enabled?: boolean;
                schedule?: { expr?: string };
                payload?: { message?: string };
              }
            | undefined;
          if (!job || job.enabled === false) return undefined;
          const [minute, hour, , , dayField] = (job.schedule?.expr ?? '').split(
            /\s+/
          );
          const days =
            dayField && dayField !== '*'
              ? dayField.split(',').map(Number)
              : undefined;
          const scheduleHour = Number.isFinite(Number(hour))
            ? Number(hour)
            : plan.scheduleHour;
          const scheduleMinute = Number.isFinite(Number(minute))
            ? Number(minute)
            : plan.scheduleMinute;
          return runScheduledTask({
            ...task,
            prompt: job.payload?.message,
            now: atLocalTime(
              nextScheduledDay(days ?? plan.scheduleDays, planTimezone),
              planTimezone,
              scheduleHour,
              scheduleMinute
            ),
          });
        };
      }
    }

    if (firstResultOk && overrides.afterFirstEntry) {
      const offer = overrides.afterFirstEntry;
      transcript.push(coordinatorEvent(offer));
      let options = offer.options;
      let replyTo: string | undefined = offer.text;
      for (let index = 0; index < 3; index++) {
        const move = await nextUserMove({
          persona,
          events: transcript,
          config,
          meter,
          policy: input.simulatorPolicy,
          lastOptions: options,
        });
        if (move.action === 'leave') break;
        transcript.push({ from: 'user', kind: move.action, text: move.text });
        const turn = await botTurn(move.text, replyTo);
        replyTo = undefined;
        const choice = turn.events.findLast((event) => event.kind === 'choice');
        options = choice?.kind === 'choice' ? choice.choice.options : undefined;
      }
    }

    transcript.push({ from: 'system', kind: 'phase', phase: 'after-ending' });
    if (persona.asks?.length) {
      // Setup can finish before the person gets to their app questions.
      const move = await nextUserMove({
        persona,
        events: transcript,
        config,
        meter,
        policy: input.simulatorPolicy,
        nudge:
          'Setup is over. If one of your questions about the app is still unasked, ask it now. If you have asked them all, choose leave.',
      });
      if (move.action !== 'leave') {
        transcript.push({ from: 'user', kind: move.action, text: move.text });
        await botTurn(move.text);
      }
    }
    const after = persona.afterEnding ?? DEFAULT_AFTER_ENDING;
    transcript.push({ from: 'user', kind: 'type', text: after });
    await botTurn(after);
    await tips?.advanceWeek();
  } catch (caught) {
    if (caught instanceof OutOfCreditError) throw caught;
    ending = 'bot-error';
    error = caught instanceof Error ? caught.message : String(caught);
  }
  let secondResult: { ok: boolean; markdown: string } | undefined;
  try {
    secondResult = await startDayTwo?.();
  } catch (caught) {
    if (caught instanceof OutOfCreditError) throw caught;
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
    ...(tips ? { campaign: tips.snapshot() } : {}),
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

  if (!error)
    await gradeRun({
      record,
      config,
      sources,
      judge: input.judge,
      meter,
      rubric: input.rubric,
      keepPolicy: input.keepPolicy,
    });
  record.durationMs = Date.now() - startedAt.getTime();
  record.costUsd = meter.usd;
  return record;
}

/** The simulated person's verdict and the judge's grade, stored on the record. */
export async function gradeRun(input: {
  record: RunRecord;
  config: LabConfig;
  sources: PromptSources;
  judge: boolean;
  meter: CostMeter;
  rubric?: string;
  keepPolicy?: string;
}) {
  const { record, config, meter } = input;
  delete record.error;
  try {
    record.keep = await keepVerdict({
      persona: record.persona,
      events: record.transcript,
      config,
      meter,
      policy: input.keepPolicy,
    });
    if (input.judge) {
      record.judgement = await judgeRun({
        record,
        sources: input.sources,
        config,
        meter,
        rubric: input.rubric,
      });
    }
  } catch (caught) {
    if (caught instanceof OutOfCreditError) throw caught;
    record.error = `grading failed: ${caught instanceof Error ? caught.message : String(caught)}`;
  }
}

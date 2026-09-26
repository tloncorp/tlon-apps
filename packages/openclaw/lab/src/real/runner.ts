import type { LabConfig, PromptSources } from '../config.js';
import { type CostMeter, OutOfCreditError } from '../openrouter.js';
import {
  DEFAULT_AFTER_ENDING,
  DEFAULT_TIMEZONE,
  computeFacts,
  gradeRun,
} from '../runner.js';
import type {
  BotTurn,
  Ending,
  Persona,
  RunRecord,
  TaskPlan,
  ToolCallRecord,
  TranscriptEvent,
} from '../types.js';
import { nextUserMove } from '../user.js';
import { type BotPost, OwnerApp } from './owner.js';
import { type ModelExchange, type ModelProxy, exchangeCost } from './proxy.js';
import { type LabStack, SANDBOX_BOT } from './stack.js';

// One persona's conversation with the real bot in the lab's sandbox stack.
// It follows the fast runner's script (same simulated person, same endings,
// same grading) so the two kinds of run can be compared line for line.

const FIRST_ENTRY_MARKERS = ['first-entry-ping', 'first-entry-failed'];
// The coordinator paces its posts (up to a few seconds apart), so a bot is
// only done once the model is idle and nothing has been posted for a while.
const QUIET_MS = 9000;

function planFromCard(post: BotPost): TaskPlan {
  const context = post.plan!.context as Record<string, unknown> & {
    topics: string[];
  };
  const expression = String(context.scheduleExpression ?? '');
  const days = expression.split(/\s+/)[4];
  return {
    summary: post.plan!.summary,
    purposeId: String(context.purposeId ?? ''),
    purpose: String(context.purpose ?? ''),
    ...(context.approach ? { approach: String(context.approach) } : {}),
    topics: context.topics,
    scheduleHour: Number(context.scheduleHour),
    scheduleMinute: Number(context.scheduleMinute),
    ...(days && days !== '*'
      ? { scheduleDays: days.split(',').map(Number) }
      : {}),
    scheduleDescription: String(context.scheduleDescription ?? ''),
    ...(context.timezoneOverride
      ? { timezoneOverride: String(context.timezoneOverride) }
      : {}),
    taskPrompt: String(context.taskPrompt ?? ''),
  };
}

function toEvent(post: BotPost): TranscriptEvent {
  const coordinator = Boolean(post.marker);
  if (post.choice) {
    return {
      from: 'bot',
      kind: 'choice',
      choice: { question: post.choice.question, options: post.choice.options },
      ...(coordinator ? { source: 'coordinator' as const } : {}),
    };
  }
  if (post.plan) return { from: 'bot', kind: 'plan', plan: planFromCard(post) };
  if (post.serviceSetup) {
    return {
      from: 'bot',
      kind: 'service-setup',
      providerId: post.serviceSetup.providerId ?? 'unknown',
    };
  }
  return {
    from: 'bot',
    kind: 'text',
    text: post.text,
    source: coordinator ? 'coordinator' : 'model',
  };
}

function text(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part as { text?: string }).text ?? '')
      .join('');
  }
  return '';
}

/** The model's tool calls in these exchanges, paired with their results. */
export function toolCallsFrom(exchanges: ModelExchange[]): ToolCallRecord[] {
  const results = new Map<string, string>();
  for (const exchange of exchanges) {
    const messages = (exchange.request.messages ?? []) as {
      role: string;
      tool_call_id?: string;
      content?: unknown;
    }[];
    for (const message of messages) {
      if (message.role === 'tool' && message.tool_call_id) {
        results.set(message.tool_call_id, text(message.content));
      }
    }
  }
  return exchanges.flatMap((exchange) =>
    (exchange.response?.toolCalls ?? []).map((call) => {
      let args: unknown = call.function.arguments;
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        // Keep the raw string.
      }
      const result = results.get(call.id) ?? '';
      return {
        name: call.function.name,
        args,
        result,
        ...(/blocked/i.test(result.slice(0, 200)) ? { blocked: true } : {}),
        ...(/^(error|\{"status":"error")/i.test(result.trim())
          ? { error: true }
          : {}),
      };
    })
  );
}

/** A scheduled-task run starts from OpenClaw's cron message. */
export function isCronExchange(exchange: ModelExchange) {
  const messages = (exchange.request.messages ?? []) as {
    role: string;
    content?: unknown;
  }[];
  return messages.some(
    (message) =>
      message.role === 'user' && text(message.content).startsWith('[cron:')
  );
}

export async function runRealPersona(input: {
  persona: Persona;
  repeat: number;
  config: LabConfig;
  sources: PromptSources;
  maxTurns: number;
  judge: boolean;
  stack: LabStack;
  proxy: ModelProxy;
  rubric?: string;
  simulatorPolicy?: string;
  keepPolicy?: string;
  onProgress?: (transcript: TranscriptEvent[]) => void;
}): Promise<RunRecord & { exchanges: ModelExchange[] }> {
  const { persona, config, sources, stack, proxy } = input;
  const meter: CostMeter = { usd: 0 };
  const startedAt = new Date();
  const timezone = persona.timezone ?? DEFAULT_TIMEZONE;
  const tag = `${persona.id}.${input.repeat}.${startedAt.getTime().toString(36)}`;
  const transcript: TranscriptEvent[] = [];
  if (input.onProgress) {
    const onProgress = input.onProgress;
    transcript.push = (...items) => {
      const length = Array.prototype.push.apply(transcript, items);
      onProgress(transcript);
      return length;
    };
  }
  const turns: BotTurn[] = [];
  let ending: Ending = 'turn-limit';
  let plan: TaskPlan | undefined;
  let firstResultOk: boolean | null = null;
  let onboardingComplete = false;
  let error: string | undefined;

  proxy.setTag(tag);
  const owner = new OwnerApp(stack.owner(), SANDBOX_BOT, {
    timezone,
    locale: 'en-US',
  });
  let seen = 0;
  let lastChoice: BotPost | undefined;
  let lastPlan: BotPost | undefined;

  /** Collect bot posts until the bot has gone quiet, or `until` is met. */
  const settle = async (
    options: { maxMs?: number; until?: (post: BotPost) => boolean } = {}
  ) => {
    const collected: BotPost[] = [];
    const started = Date.now();
    let lastPost = Date.now();
    while (Date.now() - started < (options.maxMs ?? 240_000)) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const posts = await owner.botPostsAfter(seen);
      for (const post of posts) {
        seen = Math.max(seen, post.seq);
        lastPost = Date.now();
        collected.push(post);
        if (post.choice) lastChoice = post;
        if (post.plan) lastPlan = post;
      }
      if (options.until && collected.some(options.until)) break;
      if (
        !options.until &&
        Date.now() - started > 4000 &&
        Date.now() - lastPost >= QUIET_MS &&
        proxy.idle(QUIET_MS)
      ) {
        break;
      }
    }
    return collected;
  };

  /** Send one owner message and record the bot's visible answer. */
  const botTurn = async (move: { action: 'pick' | 'type'; text: string }) => {
    const turnStart = new Date();
    lastPlan = undefined;
    if (move.action === 'pick' && lastChoice) {
      await owner.pick(lastChoice, move.text);
    } else {
      await owner.type(move.text);
    }
    const posts = await settle();
    const events: TranscriptEvent[] = posts.length
      ? posts.map(toEvent)
      : [{ from: 'bot', kind: 'silent' }];
    transcript.push(...events);
    turns.push({
      userText: move.text,
      startedAt: turnStart.toISOString(),
      toolCalls: [],
      events,
    });
    return posts;
  };

  try {
    await stack.reset(sources);
    seen = await owner.latestSeq();
    await owner.furnish();
    const welcome = await settle({ maxMs: 90_000 });
    transcript.push(...welcome.map(toEvent));
    await owner.grantBotAdmin(60_000);
    let lastOptions = lastChoice?.choice?.options;

    for (let index = 0; index < input.maxTurns; index++) {
      const move =
        index === 0 && persona.opening && !lastOptions?.length
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
      if (move.action === 'leave') {
        transcript.push({ from: 'user', kind: 'leave', reason: move.reason });
        ending = 'user-left';
        break;
      }
      transcript.push({ from: 'user', kind: move.action, text: move.text });
      const posts = await botTurn(move);
      const choice = posts.findLast((post) => post.choice);
      lastOptions = choice?.choice?.options;
      if (lastPlan) {
        plan = planFromCard(lastPlan);
        ending = 'plan';
        break;
      }
    }

    if (plan && lastPlan) {
      await owner.autoProvision(lastPlan);
      const posts = await settle({
        maxMs: 8 * 60_000,
        until: (post) => FIRST_ENTRY_MARKERS.includes(post.marker ?? ''),
      });
      const done = posts.find((post) =>
        FIRST_ENTRY_MARKERS.includes(post.marker ?? '')
      );
      firstResultOk = done?.marker === 'first-entry-ping';
      const note = firstResultOk ? await owner.newestNote() : undefined;
      for (const post of posts) {
        if (post === done) {
          transcript.push({
            from: 'system',
            kind: 'first-result',
            ok: Boolean(firstResultOk),
            markdown: note
              ? `# ${note.title ?? ''}\n\n${note.body ?? ''}`.trim()
              : '',
          });
        }
        transcript.push(toEvent(post));
      }
      if (!done) {
        transcript.push({
          from: 'system',
          kind: 'first-result',
          ok: false,
          markdown: '',
        });
      }
      onboardingComplete = Boolean(firstResultOk);
    }

    transcript.push({ from: 'system', kind: 'phase', phase: 'after-ending' });
    if (persona.asks?.length) {
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
        await botTurn(move);
      }
    }
    const after = persona.afterEnding ?? DEFAULT_AFTER_ENDING;
    transcript.push({ from: 'user', kind: 'type', text: after });
    await botTurn({ action: 'type', text: after });
  } catch (caught) {
    if (caught instanceof OutOfCreditError) throw caught;
    ending = 'bot-error';
    error = caught instanceof Error ? caught.message : String(caught);
  } finally {
    owner.close();
  }

  // Wait out anything still in flight so its calls land in this run.
  for (let i = 0; i < 60 && proxy.busy; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const exchanges = proxy.take(tag);
  const cron = exchanges.filter(isCronExchange);
  const conversation = exchanges.filter(
    (exchange) => !isCronExchange(exchange)
  );
  turns.forEach((turn, index) => {
    const from = turn.startedAt ?? '';
    const to = turns[index + 1]?.startedAt ?? '9999';
    turn.toolCalls = toolCallsFrom(
      conversation.filter(
        (exchange) => exchange.startedAt >= from && exchange.startedAt < to
      )
    );
  });
  const firstRunToolCalls = toolCallsFrom(cron);

  const record: RunRecord & { exchanges: ModelExchange[] } = {
    mode: 'real',
    persona,
    repeat: input.repeat,
    startedAt: startedAt.toISOString(),
    durationMs: 0,
    models: config.models,
    transcript,
    turns,
    firstRunToolCalls,
    ...(plan ? { plan } : {}),
    facts: computeFacts({
      persona,
      ending,
      transcript,
      turns,
      firstRunToolCalls,
      planCreated: Boolean(plan),
      firstResultOk,
      onboardingComplete,
    }),
    costUsd: 0,
    ...(error ? { error } : {}),
    exchanges,
  };
  if (!error) {
    await gradeRun({
      record,
      config,
      sources,
      judge: input.judge,
      meter,
      rubric: input.rubric,
      keepPolicy: input.keepPolicy,
    });
  }
  record.durationMs = Date.now() - startedAt.getTime();
  record.costUsd = meter.usd + exchangeCost(exchanges);
  return record;
}

import { metrics } from '@opentelemetry/api';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createSubsystemLogger } from 'openclaw/plugin-sdk/runtime-env';

import {
  type MessageJourneyLoggerLike,
  type TlonMessageJourneyDestinationKind,
  recordTlonMessageJourneyEvent,
} from './message-journey.js';
import { sharedMap } from './shared-state.js';

export type TlonAgentTurnExecution =
  | 'completed'
  | 'failed'
  | 'timed_out'
  | 'cancelled'
  | 'abandoned';

export type TlonAgentTurnResult =
  | 'reply'
  | 'error_reply'
  | 'action_only'
  | 'reply_and_action'
  | 'error_reply_and_action'
  | 'intentional_silence'
  | 'empty';

export type TlonAgentTurnDelivery =
  | 'delivered'
  | 'partial'
  | 'failed'
  | 'skipped'
  | 'not_applicable';

export type TlonAgentTurnDispatch = 'attempted' | 'skipped' | 'not_applicable';

export type TlonAgentTurnTrigger =
  | 'cron'
  | 'dm'
  | 'mention'
  | 'thread'
  | 'reaction'
  | 'owner-listen'
  | 'owner-blob'
  | 'summarization'
  | 'tool'
  | 'retry'
  | 'unknown';

export type TlonAgentTurnSkipReason =
  | 'empty'
  | 'silent'
  | 'heartbeat'
  | 'empty_payload_text'
  | 'block_directive_only'
  | 'media_only_payload_not_sent'
  | 'source_reply_delivery_mode_message_tool_only';

export type TlonAgentTurnReason =
  | TlonAgentTurnSkipReason
  | TlonAgentTurnResult
  | 'timed_out'
  | 'cancelled'
  | 'abandoned'
  | 'dispatch_failed'
  | 'delivery_partial'
  | 'delivery_failed'
  | 'reply_not_delivered';

export type TlonAgentTurnStart = {
  accountId: string | null;
  agentId: string | null;
  destinationKind: 'dm' | 'group_channel';
  inputMessageId: string;
  runId: string;
  sessionKey: string;
  ship: string;
  trigger: TlonAgentTurnTrigger;
};

export type TlonAgentTurnTerminal = {
  abandoned?: boolean;
  cancelled?: boolean;
  deliverySkipReason?: TlonAgentTurnSkipReason | null;
  dispatchError?: unknown;
  durationMs: number;
  sourceReplyDeliveryMode?: string | null;
  timedOut?: boolean;
};

export type TlonAgentTurnSummary = TlonAgentTurnStart & {
  delivery: TlonAgentTurnDelivery;
  deliveryFailureCount: number;
  deliverySuccessCount: number;
  dispatch: TlonAgentTurnDispatch;
  dispatchAttemptCount: number;
  dispatchExpected: boolean;
  durationMs: number;
  execution: TlonAgentTurnExecution;
  finalErrorReplyCount: number;
  lastToolError: { toolName: string; message: string } | null;
  reason: TlonAgentTurnReason;
  result: TlonAgentTurnResult;
  sourceReplyCount: number;
  toolCallCount: number;
  toolErrorCount: number;
};

export type TlonAgentTurnObserver = {
  recordDispatchAttempted?(event: TlonAgentTurnDispatchAttempt): void;
  recordDispatchFailed?(event: TlonAgentTurnDispatchOutcome): void;
  recordMoonReplyEnqueued?(event: TlonAgentTurnDispatchOutcome): void;
  recordStarted(turn: TlonAgentTurnStart): void;
  recordTerminal(summary: TlonAgentTurnSummary): void;
};

export type TlonAgentTurnDispatchAttempt = Omit<
  TlonAgentTurnStart,
  'destinationKind'
> & {
  attemptNumber: number;
  destinationKind: TlonMessageJourneyDestinationKind;
};

export type TlonAgentTurnDispatchOutcome = TlonAgentTurnDispatchAttempt & {
  errorKind?: string;
  outputMessageId?: string;
};

type TlonAgentTurnState = TlonAgentTurnStart & {
  deliveryFailureCount: number;
  deliverySuccessCount: number;
  dispatchAttemptCount: number;
  finalErrorReplyCount: number;
  finalNonErrorReplyCount: number;
  finalized: boolean;
  observer: TlonAgentTurnObserver;
  lastToolError: { toolName: string; message: string } | null;
  outputCount: number;
  sourceReplyCount: number;
  summary: TlonAgentTurnSummary | null;
  toolCallCount: number;
  toolErrorCount: number;
};

type MetricAttributes = Record<string, string>;

type CounterLike = {
  add(value: number, attributes: MetricAttributes): void;
};

type HistogramLike = {
  record(value: number, attributes: MetricAttributes): void;
};

type MeterProviderLike = {
  getMeter(name: string): {
    createCounter(
      name: string,
      options?: { description?: string; unit?: string }
    ): CounterLike;
    createHistogram(
      name: string,
      options?: { description?: string; unit?: string }
    ): HistogramLike;
  };
};

type TurnLoggerLike = {
  info(message: string, meta?: Record<string, unknown>): void;
};

type TurnInstruments = {
  duration: HistogramLike;
  started: CounterLike;
  terminal: CounterLike;
};

const turnStorage = new AsyncLocalStorage<TlonAgentTurnState>();
const traceIdsByRunId = sharedMap<string, string>(
  'turnRecorder.traceIdsByRunId'
);
const MAX_TRACKED_TRACE_IDS = 1_024;
const terminalLogger = createSubsystemLogger('tlon/agent-turn');

function normalizeShip(ship: string): string {
  return ship.trim().replace(/^~/, '');
}

function safeObserve(run: () => void): void {
  try {
    run();
  } catch {
    // Observability must never alter dispatch or delivery behavior.
  }
}

function baseMetricAttributes(turn: TlonAgentTurnStart): MetricAttributes {
  return {
    destination_kind: turn.destinationKind,
    trigger: turn.trigger,
  };
}

function terminalMetricAttributes(
  summary: TlonAgentTurnSummary
): MetricAttributes {
  return {
    ...baseMetricAttributes(summary),
    delivery: summary.delivery,
    dispatch: summary.dispatch,
    execution: summary.execution,
    reason: summary.reason,
    result: summary.result,
  };
}

function replyResultExpectsDispatch(result: TlonAgentTurnResult): boolean {
  return (
    result === 'reply' ||
    result === 'error_reply' ||
    result === 'reply_and_action' ||
    result === 'error_reply_and_action'
  );
}

function resolveDispatch(
  state: TlonAgentTurnState,
  result: TlonAgentTurnResult
): {
  dispatch: TlonAgentTurnDispatch;
  dispatchExpected: boolean;
} {
  if (state.dispatchAttemptCount > 0) {
    return { dispatch: 'attempted', dispatchExpected: true };
  }
  if (replyResultExpectsDispatch(result)) {
    return { dispatch: 'skipped', dispatchExpected: true };
  }
  return { dispatch: 'not_applicable', dispatchExpected: false };
}

function resolveExecution(
  terminal: TlonAgentTurnTerminal
): TlonAgentTurnExecution {
  if (terminal.timedOut) {
    return 'timed_out';
  }
  if (terminal.cancelled) {
    return 'cancelled';
  }
  if (terminal.abandoned) {
    return 'abandoned';
  }
  if (terminal.dispatchError) {
    return 'failed';
  }
  return 'completed';
}

function resolveResult(
  state: TlonAgentTurnState,
  skipReason: TlonAgentTurnSkipReason | null
): TlonAgentTurnResult {
  const replied =
    state.sourceReplyCount > 0 ||
    skipReason === 'source_reply_delivery_mode_message_tool_only';
  const acted = state.toolCallCount > 0;
  const onlyFinalErrorReplies =
    state.finalErrorReplyCount > 0 && state.finalNonErrorReplyCount === 0;
  if (replied && onlyFinalErrorReplies && acted) {
    return 'error_reply_and_action';
  }
  if (replied && onlyFinalErrorReplies) {
    return 'error_reply';
  }
  if (replied && acted) {
    return 'reply_and_action';
  }
  if (replied) {
    return 'reply';
  }
  if (acted) {
    return 'action_only';
  }
  if (skipReason === 'silent' || skipReason === 'heartbeat') {
    return 'intentional_silence';
  }
  return 'empty';
}

function resolveDeliverySkipReason(
  state: TlonAgentTurnState,
  terminal: TlonAgentTurnTerminal
): TlonAgentTurnSkipReason | null {
  if (terminal.deliverySkipReason) {
    return terminal.deliverySkipReason;
  }
  if (
    terminal.sourceReplyDeliveryMode === 'message_tool_only' &&
    resolveExecution(terminal) === 'completed' &&
    state.deliverySuccessCount === 0 &&
    state.deliveryFailureCount === 0
  ) {
    return 'source_reply_delivery_mode_message_tool_only';
  }
  return null;
}

function resolveDelivery(
  state: TlonAgentTurnState,
  result: TlonAgentTurnResult
): TlonAgentTurnDelivery {
  if (state.deliverySuccessCount > 0 && state.deliveryFailureCount > 0) {
    return 'partial';
  }
  if (state.deliverySuccessCount > 0) {
    return 'delivered';
  }
  if (state.deliveryFailureCount > 0) {
    return 'failed';
  }
  if (replyResultExpectsDispatch(result)) {
    return 'skipped';
  }
  return 'not_applicable';
}

function resolveReason(params: {
  delivery: TlonAgentTurnDelivery;
  execution: TlonAgentTurnExecution;
  result: TlonAgentTurnResult;
  skipReason?: TlonAgentTurnSkipReason | null;
}): TlonAgentTurnReason {
  switch (params.execution) {
    case 'timed_out':
      return 'timed_out';
    case 'cancelled':
      return 'cancelled';
    case 'abandoned':
      return 'abandoned';
    case 'failed':
      return 'dispatch_failed';
    case 'completed':
      break;
  }

  if (params.delivery === 'partial') {
    return 'delivery_partial';
  }
  if (params.delivery === 'failed') {
    return 'delivery_failed';
  }
  if (params.delivery === 'skipped') {
    return params.skipReason ?? 'reply_not_delivered';
  }
  if (params.result === 'intentional_silence' || params.result === 'empty') {
    return params.skipReason ?? params.result;
  }
  return params.result;
}

function buildSummary(
  state: TlonAgentTurnState,
  terminal: TlonAgentTurnTerminal
): TlonAgentTurnSummary {
  const execution = resolveExecution(terminal);
  const deliverySkipReason = resolveDeliverySkipReason(state, terminal);
  const result = resolveResult(state, deliverySkipReason);
  const delivery = resolveDelivery(state, result);
  const dispatch = resolveDispatch(state, result);
  return {
    accountId: state.accountId,
    agentId: state.agentId,
    delivery,
    deliveryFailureCount: state.deliveryFailureCount,
    deliverySuccessCount: state.deliverySuccessCount,
    dispatch: dispatch.dispatch,
    dispatchAttemptCount: state.dispatchAttemptCount,
    dispatchExpected: dispatch.dispatchExpected,
    destinationKind: state.destinationKind,
    durationMs: Math.max(0, terminal.durationMs),
    execution,
    finalErrorReplyCount: state.finalErrorReplyCount,
    inputMessageId: state.inputMessageId,
    lastToolError: state.lastToolError,
    reason: resolveReason({
      delivery,
      execution,
      result,
      skipReason: deliverySkipReason,
    }),
    result,
    runId: state.runId,
    sessionKey: state.sessionKey,
    ship: state.ship,
    sourceReplyCount: state.sourceReplyCount,
    toolCallCount: state.toolCallCount,
    toolErrorCount: state.toolErrorCount,
    trigger: state.trigger,
  };
}

export function createTlonAgentTurnOtelObserver(options?: {
  getMeterProvider?: () => MeterProviderLike;
  logger?: TurnLoggerLike & MessageJourneyLoggerLike;
}): TlonAgentTurnObserver {
  const getMeterProvider =
    options?.getMeterProvider ??
    (() => metrics.getMeterProvider() as MeterProviderLike);
  const logger = options?.logger ?? terminalLogger;
  let activeProvider: MeterProviderLike | null = null;
  let instruments: TurnInstruments | null = null;

  const getInstruments = (): TurnInstruments => {
    const provider = getMeterProvider();
    if (provider === activeProvider && instruments) {
      return instruments;
    }
    const meter = provider.getMeter('tlon.openclaw');
    const next = {
      started: meter.createCounter('tlon.agent.turns.started', {
        description: 'Tlon-originated agent turns started',
        unit: '1',
      }),
      terminal: meter.createCounter('tlon.agent.turns', {
        description: 'Terminal Tlon-originated agent turn outcomes',
        unit: '1',
      }),
      duration: meter.createHistogram('tlon.agent.turn.duration', {
        description: 'Tlon-originated agent turn duration',
        unit: 's',
      }),
    };
    activeProvider = provider;
    instruments = next;
    return next;
  };

  return {
    recordStarted(turn) {
      safeObserve(() => {
        getInstruments().started.add(1, baseMetricAttributes(turn));
      });
      recordTlonMessageJourneyEvent(
        {
          accountId: turn.accountId,
          agentId: turn.agentId,
          botShip: turn.ship,
          destinationKind: turn.destinationKind,
          inputMessageId: turn.inputMessageId,
          runId: turn.runId,
          sessionKey: turn.sessionKey,
          stage: 'turn_started',
          trigger: turn.trigger,
        },
        logger
      );
    },
    recordDispatchAttempted(event) {
      recordTlonMessageJourneyEvent(
        {
          accountId: event.accountId,
          agentId: event.agentId,
          attemptNumber: event.attemptNumber,
          botShip: event.ship,
          destinationKind: event.destinationKind,
          inputMessageId: event.inputMessageId,
          runId: event.runId,
          sessionKey: event.sessionKey,
          stage: 'reply_dispatch_attempted',
          trigger: event.trigger,
        },
        logger
      );
    },
    recordDispatchFailed(event) {
      recordTlonMessageJourneyEvent(
        {
          accountId: event.accountId,
          agentId: event.agentId,
          attemptNumber: event.attemptNumber,
          botShip: event.ship,
          destinationKind: event.destinationKind,
          errorKind: event.errorKind,
          inputMessageId: event.inputMessageId,
          runId: event.runId,
          sessionKey: event.sessionKey,
          stage: 'reply_dispatch_failed',
          trigger: event.trigger,
        },
        logger
      );
    },
    recordMoonReplyEnqueued(event) {
      recordTlonMessageJourneyEvent(
        {
          accountId: event.accountId,
          agentId: event.agentId,
          attemptNumber: event.attemptNumber,
          botShip: event.ship,
          destinationKind: event.destinationKind,
          inputMessageId: event.inputMessageId,
          outputMessageId: event.outputMessageId,
          runId: event.runId,
          sessionKey: event.sessionKey,
          stage: 'moon_reply_enqueued',
          trigger: event.trigger,
        },
        logger
      );
    },
    recordTerminal(summary) {
      const attributes = terminalMetricAttributes(summary);
      safeObserve(() => {
        const current = getInstruments();
        current.terminal.add(1, attributes);
        current.duration.record(summary.durationMs / 1000, attributes);
      });
      safeObserve(() => {
        logger.info('tlon.agent_turn.terminal', {
          ...(summary.accountId
            ? { 'tlon.turn.account_id': summary.accountId }
            : {}),
          ...(summary.agentId ? { 'tlon.turn.agent_id': summary.agentId } : {}),
          'tlon.turn.delivery': summary.delivery,
          'tlon.turn.delivery_failure_count': summary.deliveryFailureCount,
          'tlon.turn.delivery_success_count': summary.deliverySuccessCount,
          'tlon.turn.destination_kind': summary.destinationKind,
          'tlon.turn.dispatch': summary.dispatch,
          'tlon.turn.dispatch_attempt_count': summary.dispatchAttemptCount,
          'tlon.turn.dispatch_expected': summary.dispatchExpected,
          'tlon.turn.duration_ms': summary.durationMs,
          'tlon.turn.event': 'tlon.agent_turn.terminal',
          'tlon.turn.execution': summary.execution,
          'tlon.turn.final_error_reply_count': summary.finalErrorReplyCount,
          'tlon.turn.input_message_id': summary.inputMessageId,
          'tlon.turn.reason': summary.reason,
          'tlon.turn.result': summary.result,
          'tlon.turn.run_id': summary.runId,
          'tlon.turn.session_key': summary.sessionKey,
          'tlon.turn.ship': summary.ship,
          'tlon.turn.source_reply_count': summary.sourceReplyCount,
          'tlon.turn.tool_call_count': summary.toolCallCount,
          'tlon.turn.tool_error_count': summary.toolErrorCount,
          'tlon.turn.trigger': summary.trigger,
        });
      });
    },
  };
}

const defaultTurnObserver = createTlonAgentTurnOtelObserver();

export function startTlonAgentTurn(
  input: TlonAgentTurnStart,
  options?: { observer?: TlonAgentTurnObserver }
) {
  const observer = options?.observer ?? defaultTurnObserver;
  const state: TlonAgentTurnState = {
    ...input,
    ship: normalizeShip(input.ship),
    deliveryFailureCount: 0,
    deliverySuccessCount: 0,
    dispatchAttemptCount: 0,
    finalErrorReplyCount: 0,
    finalNonErrorReplyCount: 0,
    finalized: false,
    observer,
    lastToolError: null,
    outputCount: 0,
    sourceReplyCount: 0,
    summary: null,
    toolCallCount: 0,
    toolErrorCount: 0,
  };

  safeObserve(() => observer.recordStarted(state));

  return {
    run<T>(callback: () => T): T {
      return turnStorage.run(state, callback);
    },
    finalize(terminal: TlonAgentTurnTerminal): TlonAgentTurnSummary {
      if (state.summary) {
        return state.summary;
      }
      state.finalized = true;
      state.summary = buildSummary(state, terminal);
      traceIdsByRunId.delete(state.runId);
      safeObserve(() => observer.recordTerminal(state.summary!));
      return state.summary;
    },
  };
}

function updateActiveTurn(update: (state: TlonAgentTurnState) => void): void {
  const state = turnStorage.getStore();
  if (!state || state.finalized) {
    return;
  }
  update(state);
}

export function recordActiveTlonTurnSourceReply(reply?: {
  isError?: boolean;
  kind: 'tool' | 'block' | 'final';
}): void {
  updateActiveTurn((state) => {
    state.sourceReplyCount += 1;
    if (reply?.kind !== 'final') {
      return;
    }
    if (reply.isError === true) {
      state.finalErrorReplyCount += 1;
    } else {
      state.finalNonErrorReplyCount += 1;
    }
  });
}

export function recordActiveTlonTurnToolCall(update?: {
  toolName?: string;
  errorMessage?: string;
}): void {
  updateActiveTurn((state) => {
    state.toolCallCount += 1;
    const errorMessage = update?.errorMessage;
    if (typeof errorMessage === 'string' && errorMessage.trim()) {
      state.toolErrorCount += 1;
      state.lastToolError = {
        toolName: update?.toolName || 'unknown',
        message: errorMessage,
      };
    }
  });
}

export function recordTlonAgentRunTrace(
  runId?: string,
  traceId?: string
): void {
  const normalizedRunId = runId?.trim();
  const normalized = traceId?.trim();
  if (!normalizedRunId || !normalized) {
    return;
  }
  if (
    !traceIdsByRunId.has(normalizedRunId) &&
    traceIdsByRunId.size >= MAX_TRACKED_TRACE_IDS
  ) {
    const oldestRunId = traceIdsByRunId.keys().next().value;
    if (oldestRunId) {
      traceIdsByRunId.delete(oldestRunId);
    }
  }
  traceIdsByRunId.set(normalizedRunId, normalized);
}

export function recordActiveTlonTurnDelivery(success: boolean): void {
  updateActiveTurn((state) => {
    state.dispatchAttemptCount += 1;
    if (success) {
      state.deliverySuccessCount += 1;
    } else {
      state.deliveryFailureCount += 1;
    }
  });
}

function activeDispatchAttempt(
  destinationKind?: TlonMessageJourneyDestinationKind
): TlonAgentTurnDispatchAttempt | null {
  const state = turnStorage.getStore();
  if (!state || state.finalized) {
    return null;
  }
  state.dispatchAttemptCount += 1;
  const event: TlonAgentTurnDispatchAttempt = {
    accountId: state.accountId,
    agentId: state.agentId,
    attemptNumber: state.dispatchAttemptCount,
    destinationKind: destinationKind ?? state.destinationKind,
    inputMessageId: state.inputMessageId,
    runId: state.runId,
    sessionKey: state.sessionKey,
    ship: state.ship,
    trigger: state.trigger,
  };
  safeObserve(() => state.observer.recordDispatchAttempted?.(event));
  return event;
}

function activeDispatchOutcome(params: {
  attempt: TlonAgentTurnDispatchAttempt | null;
  error?: unknown;
  outputMessageId?: string;
  success: boolean;
}): void {
  const state = turnStorage.getStore();
  if (!state || state.finalized) {
    return;
  }
  if (params.success) {
    state.deliverySuccessCount += 1;
  } else {
    state.deliveryFailureCount += 1;
  }
  if (!params.attempt) {
    return;
  }
  const event: TlonAgentTurnDispatchOutcome = {
    ...params.attempt,
    ...(params.outputMessageId
      ? { outputMessageId: params.outputMessageId }
      : {}),
    ...(params.error
      ? {
          errorKind:
            params.error instanceof Error
              ? params.error.name
              : typeof params.error,
        }
      : {}),
  };
  safeObserve(() => {
    if (params.success) {
      state.observer.recordMoonReplyEnqueued?.(event);
    } else {
      state.observer.recordDispatchFailed?.(event);
    }
  });
}

function extractOutputMessageId(result: unknown): string | undefined {
  if (!result || typeof result !== 'object' || !('messageId' in result)) {
    return undefined;
  }
  const messageId = (result as { messageId?: unknown }).messageId;
  return typeof messageId === 'string' && messageId ? messageId : undefined;
}

export function claimActiveTlonTurnOutput(): {
  runId: string | null;
  outputIndex: number;
  traceId: string | null;
} {
  const state = turnStorage.getStore();
  if (!state || state.finalized) {
    return { runId: null, outputIndex: 0, traceId: null };
  }
  const outputIndex = state.outputCount;
  state.outputCount += 1;
  return {
    runId: state.runId,
    outputIndex,
    traceId: traceIdsByRunId.get(state.runId) ?? null,
  };
}

export async function observeActiveTlonTurnDelivery<T>(
  delivery: () => Promise<T>,
  options?: { destinationKind?: TlonMessageJourneyDestinationKind }
): Promise<T> {
  const attempt = activeDispatchAttempt(options?.destinationKind);
  try {
    const result = await delivery();
    activeDispatchOutcome({
      attempt,
      outputMessageId: extractOutputMessageId(result),
      success: true,
    });
    return result;
  } catch (error) {
    activeDispatchOutcome({ attempt, error, success: false });
    throw error;
  }
}

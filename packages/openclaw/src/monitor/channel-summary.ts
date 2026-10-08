import {
  observeActiveTlonTurnDelivery,
  recordActiveTlonTurnSourceReply,
  startTlonAgentTurn,
  type TlonAgentTurnSummary,
} from '../turn-recorder.js';

type TlonAgentTurn = ReturnType<typeof startTlonAgentTurn>;

export type ChannelSummaryFallback = {
  reason: string;
  text: string;
};

export type ChannelSummaryPreparation<HistoryItem, DispatchResult> =
  | {
      kind: 'history';
      history: HistoryItem[];
    }
  | {
      kind: 'fallback';
      fallback: ChannelSummaryFallback;
      dispatchResult: DispatchResult;
      summary: TlonAgentTurnSummary;
    };

export async function prepareChannelSummary<
  HistoryItem,
  DispatchResult,
>(params: {
  dispatchFallback: (
    fallback: ChannelSummaryFallback
  ) => Promise<DispatchResult>;
  dispatchStartTime: number;
  loadHistory: () => Promise<HistoryItem[]>;
  now?: () => number;
  onHistory?: (history: HistoryItem[]) => void;
  turnRecorder: TlonAgentTurn;
}): Promise<ChannelSummaryPreparation<HistoryItem, DispatchResult>> {
  let fallback: ChannelSummaryFallback | null = null;
  try {
    const history = await params.loadHistory();
    params.onHistory?.(history);
    if (history.length > 0) {
      return { kind: 'history', history };
    }
    fallback = {
      reason: 'posted no-history summary response',
      text: "I couldn't fetch any messages for this channel. It might be empty or there might be a permissions issue.",
    };
  } catch (error: unknown) {
    fallback = {
      reason: 'posted summary error response',
      text: `Sorry, I encountered an error while fetching the channel history: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!fallback) {
    throw new Error('channel summary fallback was not resolved');
  }
  const directFallback = fallback;

  const now = params.now ?? Date.now;
  let dispatchError: unknown;
  let dispatchResult!: DispatchResult;
  let summary!: TlonAgentTurnSummary;
  try {
    dispatchResult = await params.turnRecorder.run(() => {
      recordActiveTlonTurnSourceReply({ kind: 'final', isError: false });
      return observeActiveTlonTurnDelivery(() =>
        params.dispatchFallback(directFallback)
      );
    });
  } catch (error) {
    dispatchError = error;
    throw error;
  } finally {
    summary = params.turnRecorder.finalize({
      dispatchError,
      durationMs: now() - params.dispatchStartTime,
    });
  }

  return {
    kind: 'fallback',
    fallback: directFallback,
    dispatchResult,
    summary,
  };
}

import type { useConnectionStatus } from '@tloncorp/shared';
import type * as domain from '@tloncorp/shared/domain';

import type { ThinkingIndicator } from './useThinkingIndicator';

/** What the bot is doing, as far as its bauble shows it. */
export type BotBaubleState =
  | 'idle'
  | 'thinking'
  | 'working'
  | 'offline'
  | 'connecting';

export function getBotBaubleState({
  liveness,
  thinking,
  connectionStatus,
}: {
  liveness: domain.BotLivenessState | null;
  /** The conversation's thinking indicator, which the bauble follows. */
  thinking: Pick<ThinkingIndicator, 'visible' | 'computingState'>;
  connectionStatus: ReturnType<typeof useConnectionStatus>;
}): BotBaubleState {
  // Without our own connection, presence and liveness are both stale.
  if (
    connectionStatus === 'Connecting' ||
    connectionStatus === 'Reconnecting'
  ) {
    return 'connecting';
  }
  if (liveness === 'offline') {
    return 'offline';
  }
  if (thinking.visible) {
    return (thinking.computingState?.toolCalls.length ?? 0) > 0
      ? 'working'
      : 'thinking';
  }
  return 'idle';
}

export function getBotBaubleStatusText(
  state: BotBaubleState,
  thinkingLabel: string
): string | null {
  switch (state) {
    case 'thinking':
    case 'working':
      return thinkingLabel;
    case 'offline':
      return 'Offline';
    case 'connecting':
      return 'Connecting…';
    case 'idle':
      return null;
  }
}

/** Milliseconds between ticks while the bot works, or null when it rests. */
export function getBotBaubleBeat(state: BotBaubleState): number | null {
  switch (state) {
    case 'thinking':
      return 1200;
    case 'working':
      return 900;
    case 'idle':
    case 'offline':
    case 'connecting':
      return null;
  }
}

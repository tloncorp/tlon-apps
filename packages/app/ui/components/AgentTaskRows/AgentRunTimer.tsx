import { memo, useEffect, useState } from 'react';
import { SizableText } from 'tamagui';

const TIMER_INTERVAL_MS = 1_000;

export function formatAgentRunElapsedTime(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function resolveAgentRunTimerStartedAt(
  dispatchStartedAt: number | null | undefined,
  createdAt: number
) {
  // Current records use null while preparing; legacy records omit the field.
  return dispatchStartedAt === undefined ? createdAt : dispatchStartedAt;
}

/** Keeps the once-per-second clock update below the run card render boundary. */
export const AgentRunTimer = memo(function AgentRunTimer({
  startedAt,
}: {
  startedAt: number | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (startedAt == null) return;
    const interval = setInterval(() => setNow(Date.now()), TIMER_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <SizableText
      testID="agent-run-elapsed-time"
      size="$xs"
      color="$secondaryText"
      minWidth="$4xl"
      textAlign="right"
      fontVariant={['tabular-nums']}
      accessible={false}
    >
      {formatAgentRunElapsedTime(startedAt == null ? 0 : now - startedAt)}
    </SizableText>
  );
});

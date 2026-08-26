import { useEffect, useMemo, useState } from 'react';

import type { ContextLensEvent } from '../Channel/ContextLens/types';
import type { AgentChatRunOutcome } from './runOutcome';

export const FINISHING_RECEIPT_GRACE_MS = 5 * 60 * 1_000;

export type AgentChatReceiptOutcome = AgentChatRunOutcome | 'unavailable';

export function finishingReceiptExpiresAt(event: ContextLensEvent) {
  const finalOutputAt = event.lens.outputs?.reduce<number | null>(
    (latest, output) =>
      Number.isFinite(output.sentAt) &&
      (latest === null || output.sentAt > latest)
        ? output.sentAt
        : latest,
    null
  );
  return (finalOutputAt ?? event.at) + FINISHING_RECEIPT_GRACE_MS;
}

/** Bound a synthetic final-over-active receipt when its terminal Lens is lost. */
export function useAgentChatReceiptOutcome(
  event: ContextLensEvent,
  outcome: AgentChatRunOutcome
): AgentChatReceiptOutcome {
  const expiresAt = useMemo(
    () => (outcome === 'finishing' ? finishingReceiptExpiresAt(event) : null),
    [event, outcome]
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (expiresAt === null) return;
    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      setNow(Date.now());
      return;
    }
    const timer = setTimeout(() => setNow(Date.now()), delay + 1);
    return () => clearTimeout(timer);
  }, [expiresAt]);

  if (expiresAt !== null && Math.max(now, Date.now()) > expiresAt) {
    return 'unavailable';
  }
  return outcome;
}

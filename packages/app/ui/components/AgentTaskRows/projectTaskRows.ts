import type { TimelineRow } from '../Channel/ContextLens/RunTimeline';
import type { LensTone } from '../Channel/ContextLens/format';
import type { AgentTaskRow, AgentTaskStatus } from './AgentTaskRows';

/**
 * Projects an agent run into the rows the conversation shows.
 *
 * Two sources feed this, and they have complementary weaknesses. ContextLens
 * is durable and knows about completion and failure, but it only reaches the
 * bot's owner and it lags a live run by a sync round trip. Presence is
 * sub-second and public to the whole channel, but it evaporates after 90s and
 * models nothing beyond "these tools are active right now".
 *
 * So the lens supplies the spine and presence only sharpens the row that is
 * currently in flight. Anything terminal always comes from the lens.
 */

/** The slice of presence state this projection needs. */
export type LiveComputingState = {
  label: string;
  toolCalls: { toolName: string; label: string }[];
} | null;

export type ProjectTaskRowsInput = {
  /** Rows from `buildRunTimeline`, or null when no lens run is available. */
  timeline: TimelineRow[] | null;
  /** True once the lens run reached a final status. */
  runFinished: boolean;
  /** Whether the run ended in a failure rather than success. */
  runFailed: boolean;
  live: LiveComputingState;
};

function statusFromTone(tone: LensTone, active: boolean): AgentTaskStatus {
  if (active) {
    return 'running';
  }
  if (tone === 'negative') {
    return 'failed';
  }
  return 'completed';
}

export function projectTaskRows({
  timeline,
  runFinished,
  runFailed,
  live,
}: ProjectTaskRowsInput): AgentTaskRow[] {
  // No lens run means no step data. Callers fall back to the existing
  // presence indicator rather than showing a lone synthetic row, which keeps
  // avatars and multi-ship aggregation for anyone the lens does not reach.
  if (!timeline || timeline.length === 0) {
    return [];
  }

  const rows = timeline.map((row, index): AgentTaskRow => {
    const active = Boolean(row.active) && !runFinished;
    return {
      id: row.key,
      title: row.title,
      status: statusFromTone(row.tone, active),
      sequence: index + 1,
      meta: row.meta || undefined,
      details: row.detail
        ? [{ label: 'Detail', value: row.detail }]
        : undefined,
    };
  });

  // The lens has finished but its last row still reads as neutral: make the
  // outcome explicit rather than leaving a run looking perpetually mid-flight.
  if (runFinished && rows.length > 0) {
    const last = rows[rows.length - 1];
    rows[rows.length - 1] = {
      ...last,
      status: runFailed ? 'failed' : 'completed',
    };
    return rows;
  }

  // Still running: let presence retitle the in-flight row, since it knows
  // which tool is active right now and the lens may not have caught up.
  if (live) {
    const activeIndex = rows.findIndex((row) => row.status === 'running');
    if (activeIndex >= 0) {
      rows[activeIndex] = { ...rows[activeIndex], title: live.label };
    } else {
      rows.push({
        id: 'live',
        title: live.label,
        status: 'running',
        sequence: rows.length + 1,
      });
    }
  }

  return rows;
}

// src/events.ts
export type ClientId = 'claude-code' | 'codex';

export type EventKind =
  | 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'attachment' | 'interruption';

export interface Event {
  anchor: string;        // e1, e2, … stable within a session (ordinal of captured events)
  sourceId: string;      // record uuid (Claude) or `ordinal:<n>` (Codex)
  kind: EventKind;
  timestamp: string;     // ISO
  text: string;          // redacted; for tool_use the JSON input, for tool_result the output
  tool?: string;         // tool name (tool_use / tool_result)
  toolUseId?: string;
  truncated?: { shownBytes: number; totalBytes: number };
}

export interface Omissions {
  thinking: number;     // thinking / reasoning blocks
  sidechain: number;    // subagent / sidechain records
  attachments: number;  // images / files (a marker event is kept)
  system: number;       // system records, developer-role injections
  other: number;        // bookkeeping records (api-request, cost, queue, …)
  redactions: number;   // strings where redaction replaced something
}

export interface ParsedTranscript {
  client: ClientId;
  sessionId: string;
  cwd: string;
  started: string;
  updated: string;
  events: Event[];
  omitted: Omissions;
}

export const emptyOmissions = (): Omissions =>
  ({ thinking: 0, sidechain: 0, attachments: 0, system: 0, other: 0, redactions: 0 });

export const TOOL_IO_LIMIT = 2048;

/** Truncate tool I/O to TOOL_IO_LIMIT bytes, recording sizes. */
export function clip(text: string): { text: string; truncated?: Event['truncated'] } {
  const total = Buffer.byteLength(text, 'utf8');
  if (total <= TOOL_IO_LIMIT) return { text };
  const shown = Buffer.from(text, 'utf8').subarray(0, TOOL_IO_LIMIT).toString('utf8');
  return { text: shown, truncated: { shownBytes: TOOL_IO_LIMIT, totalBytes: total } };
}

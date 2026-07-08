export type Step =
  | { kind: 'text'; content: string }
  | { kind: 'tool_call'; name: string; args: Record<string, unknown> };

export interface ScriptOptions {
  /**
   * Number of calls past the last scripted step to tolerate, returning benign
   * filler instead of a 400. Default 0.
   */
  allowExtraCalls?: number;
}

export interface ReceivedCall {
  /** [tlon-test:KEY] tag selected for the request, or null if none. */
  key: string | null;
  /** Server-side timestamp in ms when the call arrived. */
  at: number;
  /** Model identifier from the request body. */
  model: string | null;
  /** Whether the client requested streaming. */
  stream: boolean;
  /** Number of messages in the request. */
  messageCount: number;
  /** Concatenated user-role text from the request. */
  userText: string;
  /** Sanitized request message summaries, bounded for assertions/debugging. */
  messages: FakeModelMessageSummary[];
  /** Advertised tool names, de-duplicated in request order. */
  toolNames?: string[];
  /** Count of extracted advertised tool names. */
  toolCount?: number;
  /** Request `tool_choice` when present, otherwise null. */
  toolChoice?: unknown | null;
  /** Epoch (reset generation) the server was in when the call arrived. */
  epoch: number;
  /** Epoch in which this call's key was last registered, or null if never. */
  registeredEpoch: number | null;
  /** Diagnostic flag for prior-epoch history bleed. */
  stale: boolean;
  /** How the request key was selected. */
  provenance: 'latest-user' | 'history-active' | 'history-inactive' | 'none';
  /** Assistant tool calls emitted by the fake-model response for this request. */
  responseToolCalls: FakeModelToolCallSummary[];
  /** Assistant text emitted by the fake-model response for this request. */
  responseText?: string | null;
  /** Finish reason emitted by the fake-model response for this request. */
  responseFinishReason?: string;
}

export interface FakeModelReceivedResponse {
  calls: ReceivedCall[];
  count: number;
  epoch: number;
}

export interface FakeModelMessageSummary {
  role: string;
  content?: FakeModelContentSummary;
  tool_calls?: FakeModelToolCallSummary[];
  tool_call_id?: string;
  name?: string;
}

export interface FakeModelContentSummary {
  kind: string;
  text?: string;
  partCount?: number;
}

export interface FakeModelToolCallSummary {
  id?: string;
  type?: string;
  function: {
    name?: string;
    arguments?: string;
  };
}

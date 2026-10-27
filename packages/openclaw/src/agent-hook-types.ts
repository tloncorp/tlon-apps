// OpenClaw 2026.9.x no longer exports its agent hook event and context types
// from a public SDK subpath (openclaw/plugin-sdk/types now only carries the
// tool and skill hook contracts), so the plugin declares the fields it reads.
// The host's PluginHookAgentContext and PluginHookAgentEndEvent stay
// assignable to these.
export type AgentHookContext = {
  runId?: string;
  sessionKey?: string;
  sessionId?: string;
  trigger?: string;
};

export type AgentEndEvent = {
  runId?: string;
  messages: unknown[];
  success: boolean;
  error?: string;
  durationMs?: number;
};

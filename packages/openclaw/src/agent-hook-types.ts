// The SDK no longer exports its agent hook types from a public subpath
// (`openclaw/plugin-sdk/types` ships untyped JS as of 2026.9.x), so these
// mirror the fields this plugin reads from the `agent_turn_prepare` /
// `model_call_started` / `agent_end` hook payloads. The `api.on(...)`
// registrations in monitor/index.ts are contextually typed against the real
// SDK map, so a mismatch fails to compile there. The cron hook mirrors live
// in cron-telemetry.ts.

export type PluginHookAgentContext = {
  sessionKey?: string;
  sessionId?: string;
  runId?: string;
  trigger?: string;
};

export type PluginHookAgentEndEvent = {
  success: boolean;
  error?: string;
  messages: unknown[];
};

export type PluginHookMessageSentEvent = {
  to?: string;
  runId?: string;
  success?: boolean;
  messageId?: string;
  error?: string;
};

const TOOL_TRACE_CONTENT_ENV_VARS = [
  "TEST_LIVE_TOOL_TRACE_CONTENTS",
  "CI_LIVE_TOOL_TRACE_CONTENTS",
] as const;

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 4;
const MAX_STRING_LENGTH = 300;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 30;

const SENSITIVE_KEY_RE = /^(?:authorization|auth|password|secret|token|accesstoken|refreshtoken|apikey|api_key|cookie|set-cookie|code)$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function truncateString(value: string): string {
  if (value.startsWith("data:")) {
    const prefix = value.slice(0, 48);
    return `${prefix}… [data-url ${value.length} chars]`;
  }

  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}… [${value.length} chars]`;
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncateString(value.message),
    };
  }

  if (depth >= MAX_DEPTH) {
    if (Array.isArray(value)) {
      return `[Array(${value.length})]`;
    }
    if (isPlainObject(value)) {
      return `[Object keys=${Object.keys(value).length}]`;
    }
    return String(value);
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`[+${value.length - MAX_ARRAY_ITEMS} more items]`);
    }
    return items;
  }

  if (isPlainObject(value)) {
    const output: Record<string, unknown> = {};
    const entries = Object.entries(value);
    for (const [index, [key, nested]] of entries.entries()) {
      if (index >= MAX_OBJECT_KEYS) {
        output.__truncated__ = `[+${entries.length - MAX_OBJECT_KEYS} more keys]`;
        break;
      }
      output[key] = SENSITIVE_KEY_RE.test(key)
        ? REDACTED
        : sanitizeValue(nested, depth + 1);
    }
    return output;
  }

  return String(value);
}

export function liveToolTraceContentsEnabled(env = process.env): boolean {
  return TOOL_TRACE_CONTENT_ENV_VARS.some((name) => /^(1|true|yes|on)$/i.test(env[name] ?? ""));
}

export function formatToolTraceEvent(params: {
  phase: "before" | "after";
  sessionKey?: string | null;
  toolName: string;
  payload: unknown;
}): string {
  const body = {
    phase: params.phase,
    sessionKey: params.sessionKey?.trim() || undefined,
    toolName: params.toolName,
    payload: sanitizeValue(params.payload),
  };

  return `tooltrace ${params.phase}: ${JSON.stringify(body)}`;
}

export function shouldLogAfterToolTrace(event: {
  durationMs?: number;
  error?: string;
  result?: unknown;
}): boolean {
  if (typeof event.durationMs === "number") {
    return true;
  }

  if (event.error) {
    return true;
  }

  return event.result == null;
}

export const _testing = {
  sanitizeValue,
  truncateString,
};

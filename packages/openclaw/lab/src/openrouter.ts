export type ChatToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | {
      role: 'assistant';
      content: string | null;
      tool_calls?: ChatToolCall[];
    }
  | { role: 'tool'; tool_call_id: string; content: string };

export type ChatTool = {
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
};

export type CostMeter = { usd: number };

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);
// OpenRouter reserves max_tokens × price against the key's credit while a
// request is in flight. Without a cap it reserves the model's full output
// limit, and a handful of parallel judge calls exhausts a small key.
const DEFAULT_MAX_TOKENS = 6000;
// A reply cut off by the cap is retried with a larger one rather than passed
// on as if it were complete; production's cap is far higher than ours.
const MAX_TOKENS_CEILING = 32_000;

export class OutOfCreditError extends Error {}

export async function chat(input: {
  key: string;
  model: string;
  messages: ChatMessage[];
  tools?: ChatTool[];
  temperature?: number;
  json?: boolean;
  maxTokens?: number;
  /** OpenRouter's reasoning setting, e.g. { effort: 'medium' }. */
  reasoning?: Record<string, unknown>;
  /** OpenRouter provider routing, as production configures it. */
  provider?: Record<string, unknown>;
  meter: CostMeter;
}): Promise<{ content: string | null; toolCalls: ChatToolCall[] }> {
  const body = {
    model: input.model,
    messages: input.messages,
    max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(input.reasoning ? { reasoning: input.reasoning } : {}),
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.tools?.length ? { tools: input.tools, tool_choice: 'auto' } : {}),
    ...(input.temperature === undefined
      ? {}
      : { temperature: input.temperature }),
    ...(input.json ? { response_format: { type: 'json_object' } } : {}),
    usage: { include: true },
  };
  let lastError = '';
  let waitMs = 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt) {
      await new Promise((r) => setTimeout(r, waitMs || 1000 * 2 ** attempt));
    }
    waitMs = 0;
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.key}`,
          'Content-Type': 'application/json',
          'X-Title': 'tlonbot onboarding lab',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      }
    ).catch((error: unknown) => {
      lastError = String(error);
      return undefined;
    });
    if (!response) continue;
    if (!response.ok) {
      const text = await response.text();
      lastError = `${response.status} ${text}`;
      if (RETRYABLE.has(response.status)) continue;
      // Too much reserved at once: wait for in-flight requests to settle.
      // Any other 402 means the key or account is out of credit.
      if (response.status === 402 && text.includes('in_flight_budget')) {
        waitMs =
          Math.min(Number(response.headers.get('retry-after') ?? 30), 120) *
          1000;
        continue;
      }
      if (response.status === 402) {
        throw new OutOfCreditError(
          `OpenRouter is out of credit for this key: ${text}`
        );
      }
      break;
    }
    const data = (await response.json()) as {
      choices?: {
        finish_reason?: string;
        message?: { content?: string | null; tool_calls?: ChatToolCall[] };
      }[];
      usage?: { cost?: number };
      error?: { message?: string };
    };
    if (data.error) {
      lastError = data.error.message ?? JSON.stringify(data.error);
      continue;
    }
    input.meter.usd += data.usage?.cost ?? 0;
    if (data.choices?.[0]?.finish_reason === 'length') {
      if (body.max_tokens >= MAX_TOKENS_CEILING) {
        throw new Error(
          `OpenRouter ${input.model} reply was cut off at ${body.max_tokens} tokens`
        );
      }
      body.max_tokens = Math.min(body.max_tokens * 2, MAX_TOKENS_CEILING);
      lastError = 'reply cut off by max_tokens';
      waitMs = 1;
      continue;
    }
    const message = data.choices?.[0]?.message;
    if (!message) {
      lastError = 'empty completion';
      continue;
    }
    return {
      content: message.content ?? null,
      toolCalls: message.tool_calls ?? [],
    };
  }
  throw new Error(`OpenRouter ${input.model} failed: ${lastError}`);
}

/** Ask for a JSON object, retrying once when the reply does not parse. */
export async function chatJson<T>(
  input: Omit<Parameters<typeof chat>[0], 'json' | 'tools'>
): Promise<T> {
  let messages = input.messages;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { content } = await chat({ ...input, messages, json: true });
    const text = content ?? '';
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    try {
      return JSON.parse(text.slice(start, end + 1)) as T;
    } catch {
      messages = [
        ...messages,
        { role: 'assistant', content: text },
        {
          role: 'user',
          content: 'That was not valid JSON. Reply with only the JSON object.',
        },
      ];
    }
  }
  throw new Error(`${input.model} did not return valid JSON`);
}

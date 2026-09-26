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

export async function chat(input: {
  key: string;
  model: string;
  messages: ChatMessage[];
  tools?: ChatTool[];
  temperature?: number;
  json?: boolean;
  meter: CostMeter;
}): Promise<{ content: string | null; toolCalls: ChatToolCall[] }> {
  const body = {
    model: input.model,
    messages: input.messages,
    ...(input.tools?.length ? { tools: input.tools, tool_choice: 'auto' } : {}),
    ...(input.temperature === undefined
      ? {}
      : { temperature: input.temperature }),
    ...(input.json ? { response_format: { type: 'json_object' } } : {}),
    usage: { include: true },
  };
  let lastError = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
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
      lastError = `${response.status} ${await response.text()}`;
      if (RETRYABLE.has(response.status)) continue;
      break;
    }
    const data = (await response.json()) as {
      choices?: {
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

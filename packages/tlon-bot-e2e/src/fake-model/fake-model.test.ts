import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { FakeModelClient } from './client.js';
import {
  type FakeModelServerListener,
  createFakeModelServer,
} from './server-core.mjs';

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
}

interface ChatCompletionChunk {
  choices: Array<{
    delta: {
      content?: string;
      tool_calls?: Array<{
        index?: number;
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

describe('fake model server', () => {
  let server: FakeModelServerListener;
  let fakeModel: FakeModelClient;

  beforeEach(async () => {
    server = await createFakeModelServer().listen({ port: 0 });
    fakeModel = new FakeModelClient(server.baseUrl);
  });

  afterEach(async () => {
    await server.close();
  });

  test('returns a scripted text completion', async () => {
    const key = 'text-completion';
    await fakeModel.script(key, [{ kind: 'text', content: 'Hello from fake' }]);

    const response = await postChat(server.baseUrl, key);
    expect(response.ok).toBe(true);
    const body = (await response.json()) as ChatCompletionResponse;

    expect(body.choices[0].message.content).toBe('Hello from fake');
    expect(body.choices[0].finish_reason).toBe('stop');
  });

  test('returns a scripted tool-call completion', async () => {
    const key = 'tool-completion';
    await fakeModel.script(key, [
      {
        kind: 'tool_call',
        name: 'message',
        args: { action: 'send', target: '~zod/test', message: 'sent' },
      },
    ]);

    const response = await postChat(server.baseUrl, key);
    expect(response.ok).toBe(true);
    const body = (await response.json()) as ChatCompletionResponse;
    const toolCall = body.choices[0].message.tool_calls?.[0];

    expect(body.choices[0].finish_reason).toBe('tool_calls');
    expect(toolCall?.type).toBe('function');
    expect(toolCall?.function.name).toBe('message');
    expect(JSON.parse(toolCall?.function.arguments ?? '{}')).toEqual({
      action: 'send',
      target: '~zod/test',
      message: 'sent',
    });
  });

  test('streams a scripted text completion', async () => {
    const key = 'streaming-text';
    await fakeModel.script(key, [
      { kind: 'text', content: 'streamed response' },
    ]);

    const response = await postChat(server.baseUrl, key, { stream: true });
    expect(response.ok).toBe(true);
    const chunks = parseSseChunks(await response.text());

    expect(chunks[0].choices[0].delta.content).toBe('streamed response');
    expect(chunks.at(-1)?.choices[0].finish_reason).toBe('stop');
  });

  test('streams a scripted tool call', async () => {
    const key = 'streaming-tool-call';
    await fakeModel.script(key, [
      { kind: 'tool_call', name: 'tlon', args: { command: 'contacts self' } },
    ]);

    const response = await postChat(server.baseUrl, key, { stream: true });
    expect(response.ok).toBe(true);
    const chunks = parseSseChunks(await response.text());
    const toolCall = chunks[0].choices[0].delta.tool_calls?.[0];

    expect(toolCall?.index).toBe(0);
    expect(toolCall?.type).toBe('function');
    expect(toolCall?.function.name).toBe('tlon');
    expect(JSON.parse(toolCall?.function.arguments ?? '{}')).toEqual({
      command: 'contacts self',
    });
    expect(chunks.at(-1)?.choices[0].finish_reason).toBe('tool_calls');
  });

  test('records advertised tool metadata from tools arrays', async () => {
    const key = 'advertised-tools';
    await fakeModel.script(key, [{ kind: 'text', content: 'ok' }]);

    const response = await postChat(server.baseUrl, key, {
      tools: [
        { type: 'function', function: { name: 'message' } },
        { type: 'function', function: { name: 'message' } },
        { name: 'tlon' },
        { type: 'function', function: { name: 'image_search' } },
      ],
    });
    expect(response.ok).toBe(true);

    const [call] = await fakeModel.received(key);
    expect(call.toolNames).toEqual(['message', 'tlon', 'image_search']);
    expect(call.toolCount).toBe(3);
    expect(call.toolChoice).toBeNull();
  });

  test('records advertised tool metadata from legacy functions arrays', async () => {
    const key = 'legacy-functions';
    await fakeModel.script(key, [{ kind: 'text', content: 'ok' }]);

    const response = await postChat(server.baseUrl, key, {
      functions: [
        { name: 'legacy_one' },
        { name: 'legacy_two' },
        { name: 'legacy_one' },
      ],
    });
    expect(response.ok).toBe(true);

    const [call] = await fakeModel.received(key);
    expect(call.toolNames).toEqual(['legacy_one', 'legacy_two']);
    expect(call.toolCount).toBe(2);
    expect(call.toolChoice).toBeNull();
  });

  test('normalizes absent advertised tool arrays', async () => {
    const key = 'absent-tools';
    await fakeModel.script(key, [{ kind: 'text', content: 'ok' }]);

    const response = await postChat(server.baseUrl, key);
    expect(response.ok).toBe(true);

    const [call] = await fakeModel.received(key);
    expect(call.toolNames).toEqual([]);
    expect(call.toolCount).toBe(0);
    expect(call.toolChoice).toBeNull();
  });

  test('preserves tool_choice on received-call records', async () => {
    const key = 'tool-choice';
    const toolChoice = {
      type: 'function',
      function: { name: 'message' },
    };
    await fakeModel.script(key, [{ kind: 'text', content: 'ok' }]);

    const response = await postChat(server.baseUrl, key, {
      tools: [{ type: 'function', function: { name: 'message' } }],
      tool_choice: toolChoice,
    });
    expect(response.ok).toBe(true);

    const [call] = await fakeModel.received(key);
    expect(call.toolNames).toEqual(['message']);
    expect(call.toolCount).toBe(1);
    expect(call.toolChoice).toEqual(toolChoice);
  });

  test('records sanitized request messages and emitted response tool calls', async () => {
    const key = 'tool-loop-record';
    await fakeModel.script(key, [
      { kind: 'tool_call', name: 'tlon', args: { command: 'version' } },
      { kind: 'text', content: 'done' },
    ]);

    const firstResponse = await postChat(server.baseUrl, key);
    expect(firstResponse.ok).toBe(true);
    const firstBody = (await firstResponse.json()) as ChatCompletionResponse;
    const toolCall = firstBody.choices[0].message.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('Expected first response to include a tool call.');
    }
    expect(toolCall?.id).toMatch(/^call_/);

    const secondResponse = await postChat(server.baseUrl, key, {
      messages: [
        {
          role: 'user',
          content: `[tlon-test:${key}] Please run version`,
        },
        {
          role: 'assistant',
          content: null,
          tool_calls: [toolCall],
        },
        {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: '{"apiKey":"secret-value","ok":true}',
        },
      ],
    });
    expect(secondResponse.ok).toBe(true);

    const calls = await fakeModel.received(key);
    expect(calls[0].responseToolCalls).toEqual([
      {
        id: toolCall.id,
        type: 'function',
        function: {
          name: 'tlon',
          arguments: '{"command":"version"}',
        },
      },
    ]);
    expect(calls[0].responseFinishReason).toBe('tool_calls');
    expect(calls[1].responseText).toBe('done');
    expect(calls[1].responseFinishReason).toBe('stop');
    expect(calls[1].messages).toMatchObject([
      { role: 'user', content: { kind: 'text' } },
      {
        role: 'assistant',
        content: { kind: 'empty' },
        tool_calls: [{ id: toolCall.id, function: { name: 'tlon' } }],
      },
      {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: {
          kind: 'text',
          text: '{"apiKey":"<redacted>","ok":true}',
        },
      },
    ]);
  });
});

async function postChat(
  baseUrl: string,
  key: string,
  overrides: Record<string, unknown> = {}
): Promise<Response> {
  return fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'tlon-test-scripted',
      messages: [
        {
          role: 'user',
          content: `[tlon-test:${key}] Please respond for ${key}`,
        },
      ],
      ...overrides,
    }),
  });
}

function parseSseChunks(raw: string): ChatCompletionChunk[] {
  return raw
    .split(/\n\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block) => {
      const dataLine = block
        .split(/\r?\n/)
        .find((line) => line.startsWith('data: '));
      if (!dataLine) {
        return [];
      }
      const data = dataLine.slice('data: '.length);
      if (data === '[DONE]') {
        return [];
      }
      return [JSON.parse(data) as ChatCompletionChunk];
    });
}

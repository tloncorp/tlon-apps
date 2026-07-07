import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { openclawDriver } from '../drivers/openclaw.js';
import type { ModelScript } from '../drivers/types.js';
import { FakeModelClient, createFakeModelServer } from '../fake-model/index.js';
import type { FakeModelServerListener } from '../fake-model/server-core.mjs';
import {
  benignModelCallPredicate,
  expectModelExpectations,
  expectNoModelCalls,
  registerModelScript,
} from '../scenarios/shared/model.js';

describe('shared model script helpers', () => {
  let server: FakeModelServerListener;
  let fakeModel: FakeModelClient;
  const noSettle = { settleMs: 0 };

  beforeEach(async () => {
    server = await createFakeModelServer().listen({ port: 0 });
    fakeModel = new FakeModelClient(server.baseUrl);
  });

  afterEach(async () => {
    await server.close();
  });

  test('registers steps with script options and enforces expectations', async () => {
    const script: ModelScript = {
      steps: [{ kind: 'text', content: 'ok' }],
      options: { allowExtraCalls: 1 },
      expectations: {
        advertisedTools: { exact: ['tlon'] },
        expectedCallCount: 2,
        allowedAuxiliaryCalls: ['hermes_title_generation'],
      },
    };
    const tag = await registerModelScript(fakeModel, 'script-options', script);

    await postChat(server.baseUrl, tag, {
      tools: [{ type: 'function', function: { name: 'tlon' } }],
    });
    await postChat(server.baseUrl, tag, {
      tools: [{ type: 'function', function: { name: 'tlon' } }],
    });

    await expect(
      expectModelExpectations(fakeModel, 'script-options', script, noSettle)
    ).resolves.toHaveLength(2);
  });

  test('allows only declared and classified extra model-call budget', async () => {
    const script: ModelScript = {
      steps: [{ kind: 'text', content: 'ok' }],
      options: { allowExtraCalls: 1 },
      expectations: {
        advertisedTools: { exact: ['tlon'] },
        expectedCallCount: 1,
        allowedAuxiliaryCalls: ['hermes_title_generation'],
      },
    };
    const tag = await registerModelScript(fakeModel, 'extra-budget', script);

    await postChat(server.baseUrl, tag, {
      tools: [{ type: 'function', function: { name: 'tlon' } }],
    });
    await postChat(server.baseUrl, tag, {
      messages: hermesTitleMessages(tag, 'ok'),
    });

    await expect(
      expectModelExpectations(fakeModel, 'extra-budget', script, noSettle)
    ).resolves.toHaveLength(2);

    await postChatAllowFailure(server.baseUrl, tag, {
      tools: [{ type: 'function', function: { name: 'tlon' } }],
    });

    await expect(
      expectModelExpectations(fakeModel, 'extra-budget', script, noSettle)
    ).rejects.toThrow(/Expected 1-2 model call/);
  });

  test('rejects unclassified extra-call allowances', async () => {
    const script: ModelScript = {
      steps: [{ kind: 'text', content: 'ok' }],
      options: { allowExtraCalls: 1 },
      expectations: {
        advertisedTools: { exact: ['tlon'] },
        expectedCallCount: 1,
      },
    };

    await expect(
      expectModelExpectations(fakeModel, 'unclassified-extra', script, noSettle)
    ).rejects.toThrow(/without allowedAuxiliaryCalls/);
  });

  test('allows declared Hermes title-generation auxiliary calls', async () => {
    const script: ModelScript = {
      steps: [{ kind: 'text', content: 'ok' }],
      options: { allowExtraCalls: 1 },
      expectations: {
        expectedCallCount: 1,
        allowedAuxiliaryCalls: ['hermes_title_generation'],
      },
    };
    const tag = await registerModelScript(fakeModel, 'hermes-title', script);

    await postChat(server.baseUrl, tag);
    await postChat(server.baseUrl, tag, {
      messages: hermesTitleMessages(tag, 'ok'),
    });

    await expect(
      expectModelExpectations(fakeModel, 'hermes-title', script, noSettle)
    ).resolves.toHaveLength(2);
  });

  test('catches delayed unexpected extra calls inside the settle window', async () => {
    const script: ModelScript = {
      steps: [{ kind: 'text', content: 'ok' }],
      options: { allowExtraCalls: 1 },
      expectations: {
        expectedCallCount: 1,
        allowedAuxiliaryCalls: ['hermes_title_generation'],
      },
    };
    const tag = await registerModelScript(fakeModel, 'delayed-extra', script);

    await postChat(server.baseUrl, tag);
    const delayedExtra = new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        postChat(server.baseUrl, tag, {
          messages: [
            { role: 'system', content: 'Normal assistant request.' },
            { role: 'user', content: `${tag} Duplicate dispatch.` },
          ],
        }).then(resolve, reject);
      }, 25);
    });

    await expect(
      expectModelExpectations(fakeModel, 'delayed-extra', script, {
        settleMs: 80,
        settleTimeoutMs: 500,
        pollIntervalMs: 10,
      })
    ).rejects.toThrow(/Unexpected auxiliary model call/);
    await delayedExtra;
  });

  test('rejects unexpected extra calls when auxiliary calls are narrowed', async () => {
    const script: ModelScript = {
      steps: [{ kind: 'text', content: 'ok' }],
      options: { allowExtraCalls: 1 },
      expectations: {
        expectedCallCount: 1,
        allowedAuxiliaryCalls: ['hermes_title_generation'],
      },
    };
    const tag = await registerModelScript(
      fakeModel,
      'unexpected-auxiliary',
      script
    );

    await postChat(server.baseUrl, tag);
    await postChat(server.baseUrl, tag, {
      messages: [
        { role: 'system', content: 'Normal assistant request.' },
        { role: 'user', content: `${tag} Duplicate dispatch.` },
      ],
    });

    await expect(
      expectModelExpectations(
        fakeModel,
        'unexpected-auxiliary',
        script,
        noSettle
      )
    ).rejects.toThrow(/Unexpected auxiliary model call/);
  });

  test('fails when a required model call omits advertised tools', async () => {
    const script: ModelScript = {
      steps: [
        { kind: 'text', content: 'ok' },
        { kind: 'text', content: 'ok again' },
      ],
      expectations: {
        advertisedTools: { exact: ['tlon'] },
        expectedCallCount: 2,
      },
    };
    const tag = await registerModelScript(
      fakeModel,
      'missing-required-tools',
      script
    );

    await postChat(server.baseUrl, tag);
    await postChat(server.baseUrl, tag, {
      tools: [{ type: 'function', function: { name: 'tlon' } }],
    });

    await expect(
      expectModelExpectations(
        fakeModel,
        'missing-required-tools',
        script,
        noSettle
      )
    ).rejects.toThrow(/Expected exact advertised tools/);
  });

  test('fails when any scenario call advertises unexpected tools', async () => {
    const script: ModelScript = {
      steps: [
        { kind: 'text', content: 'ok' },
        { kind: 'text', content: 'ok again' },
      ],
      expectations: {
        advertisedTools: { exact: ['tlon'] },
        expectedCallCount: 2,
      },
    };
    const tag = await registerModelScript(
      fakeModel,
      'later-tool-mismatch',
      script
    );

    await postChat(server.baseUrl, tag, {
      tools: [{ type: 'function', function: { name: 'tlon' } }],
    });
    await postChat(server.baseUrl, tag, {
      tools: [
        { type: 'function', function: { name: 'tlon' } },
        { type: 'function', function: { name: 'image_search' } },
      ],
    });

    await expect(
      expectModelExpectations(
        fakeModel,
        'later-tool-mismatch',
        script,
        noSettle
      )
    ).rejects.toThrow(/Expected exact advertised tools/);
  });

  test('fails advertised tool expectations with useful errors', async () => {
    const script: ModelScript = {
      steps: [{ kind: 'text', content: 'ok' }],
      expectations: {
        advertisedTools: { include: ['message'], exclude: ['image_search'] },
      },
    };
    const tag = await registerModelScript(fakeModel, 'tool-mismatch', script);
    await postChat(server.baseUrl, tag, {
      tools: [{ type: 'function', function: { name: 'image_search' } }],
    });

    await expect(
      expectModelExpectations(fakeModel, 'tool-mismatch', script, noSettle)
    ).rejects.toThrow(/Advertised tools mismatch/);
  });

  test('asserts follow-up tool result matches emitted tool call id and name', async () => {
    const script: ModelScript = {
      steps: [
        { kind: 'tool_call', name: 'tlon', args: { command: 'version' } },
        { kind: 'text', content: 'done' },
      ],
      expectations: {
        advertisedTools: { exact: ['tlon'] },
        expectedCallCount: 2,
        expectedCallSequence: [
          { kind: 'model_request' },
          { kind: 'tool_call', toolName: 'tlon' },
          { kind: 'model_request' },
          { kind: 'final_model_text' },
        ],
        toolLoopResult: true,
      },
    };
    const tag = await registerModelScript(fakeModel, 'tool-loop-ok', script);

    const toolCall = await postChatForToolCall(server.baseUrl, tag, {
      tools: [{ type: 'function', function: { name: 'tlon' } }],
    });
    await postChat(server.baseUrl, tag, {
      tools: [{ type: 'function', function: { name: 'tlon' } }],
      messages: [
        { role: 'user', content: tag },
        { role: 'assistant', content: null, tool_calls: [toolCall] },
        {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: '{"ok":true}',
        },
      ],
    });

    await expect(
      expectModelExpectations(fakeModel, 'tool-loop-ok', script, noSettle)
    ).resolves.toHaveLength(2);
  });

  test('fails call-sequence expectations when emitted tool name is wrong', async () => {
    const script: ModelScript = {
      steps: [
        { kind: 'tool_call', name: 'message', args: { action: 'send' } },
        { kind: 'text', content: 'done' },
      ],
      expectations: {
        expectedCallCount: 1,
        expectedCallSequence: [
          { kind: 'model_request' },
          { kind: 'tool_call', toolName: 'tlon' },
        ],
      },
    };
    const tag = await registerModelScript(
      fakeModel,
      'sequence-tool-mismatch',
      script
    );

    await postChatForToolCall(server.baseUrl, tag);

    await expect(
      expectModelExpectations(
        fakeModel,
        'sequence-tool-mismatch',
        script,
        noSettle
      )
    ).rejects.toThrow(/emit tool tlon/);
  });

  test('fails call-sequence expectations when final text is asserted before the follow-up request', async () => {
    const script: ModelScript = {
      steps: [
        { kind: 'tool_call', name: 'tlon', args: { command: 'version' } },
        { kind: 'text', content: 'done' },
      ],
      expectations: {
        expectedCallCount: 1,
        expectedCallSequence: [
          { kind: 'model_request' },
          { kind: 'tool_call', toolName: 'tlon' },
          { kind: 'final_model_text' },
        ],
      },
    };
    const tag = await registerModelScript(
      fakeModel,
      'sequence-final-position',
      script
    );

    await postChatForToolCall(server.baseUrl, tag);

    await expect(
      expectModelExpectations(
        fakeModel,
        'sequence-final-position',
        script,
        noSettle
      )
    ).rejects.toThrow(/serve final text/);
  });

  test('accepts tool-result follow-up without assistant echo when ids match', async () => {
    const script: ModelScript = {
      steps: [
        { kind: 'tool_call', name: 'tlon', args: { command: 'version' } },
        { kind: 'text', content: 'done' },
      ],
      expectations: {
        expectedCallCount: 2,
        toolLoopResult: true,
      },
    };
    const tag = await registerModelScript(
      fakeModel,
      'tool-loop-no-assistant-echo',
      script
    );

    const toolCall = await postChatForToolCall(server.baseUrl, tag);
    await postChat(server.baseUrl, tag, {
      messages: [
        { role: 'user', content: tag },
        {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: '{"ok":true}',
        },
      ],
    });

    await expect(
      expectModelExpectations(
        fakeModel,
        'tool-loop-no-assistant-echo',
        script,
        noSettle
      )
    ).resolves.toHaveLength(2);
  });

  test('fails tool-loop expectations when the tool result id does not match', async () => {
    const script: ModelScript = {
      steps: [
        { kind: 'tool_call', name: 'tlon', args: { command: 'version' } },
        { kind: 'text', content: 'done' },
      ],
      expectations: {
        expectedCallCount: 2,
        toolLoopResult: true,
      },
    };
    const tag = await registerModelScript(
      fakeModel,
      'tool-loop-mismatch',
      script
    );

    const toolCall = await postChatForToolCall(server.baseUrl, tag);
    await postChat(server.baseUrl, tag, {
      messages: [
        { role: 'user', content: tag },
        { role: 'assistant', content: null, tool_calls: [toolCall] },
        {
          role: 'tool',
          tool_call_id: 'call_wrong',
          content: '{"ok":true}',
        },
      ],
    });

    await expect(
      expectModelExpectations(fakeModel, 'tool-loop-mismatch', script, noSettle)
    ).rejects.toThrow(/tool-result message with tool_call_id/);
  });

  test('asserts no model calls for negative scenarios', async () => {
    await expect(
      expectNoModelCalls(fakeModel, 'no-calls')
    ).resolves.toBeUndefined();
  });

  test('asserts no unkeyed or differently keyed model calls for negative scenarios', async () => {
    await postChatAllowFailure(server.baseUrl, 'untagged prompt', {
      messages: [{ role: 'user', content: 'untagged prompt' }],
    });

    await expect(expectNoModelCalls(fakeModel)).rejects.toThrow(
      /Expected no model calls, got 1 \(<unkeyed>\)/
    );
  });

  test('ignores driver-declared benign background model calls in negative assertions', async () => {
    await postChatAllowFailure(server.baseUrl, '[OpenClaw heartbeat poll]', {
      messages: [
        { role: 'user', content: '[OpenClaw heartbeat poll]' },
        {
          role: 'user',
          content:
            'Read HEARTBEAT.md if it exists. If nothing needs attention, reply HEARTBEAT_OK.',
        },
      ],
    });

    // Without a driver predicate the shared layer filters nothing.
    await expect(expectNoModelCalls(fakeModel)).rejects.toThrow(
      /Expected no model calls, got 1/
    );

    // The OpenClaw driver classifies its own heartbeat polls as benign.
    await expect(
      expectNoModelCalls(
        fakeModel,
        undefined,
        benignModelCallPredicate(openclawDriver)
      )
    ).resolves.toBeUndefined();
  });
});

async function postChat(
  baseUrl: string,
  prompt: string,
  overrides: Record<string, unknown> = {}
): Promise<void> {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'tlon-test-scripted',
      messages: [{ role: 'user', content: prompt }],
      ...overrides,
    }),
  });
  if (!response.ok) {
    throw new Error(`fake chat request failed: ${response.status}`);
  }
}

async function postChatForToolCall(
  baseUrl: string,
  prompt: string,
  overrides: Record<string, unknown> = {}
): Promise<{
  id: string;
  type: string;
  function: { name: string; arguments: string };
}> {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'tlon-test-scripted',
      messages: [{ role: 'user', content: prompt }],
      ...overrides,
    }),
  });
  if (!response.ok) {
    throw new Error(`fake chat request failed: ${response.status}`);
  }
  const body = (await response.json()) as {
    choices: Array<{
      message: {
        tool_calls?: Array<{
          id: string;
          type: string;
          function: { name: string; arguments: string };
        }>;
      };
    }>;
  };
  const toolCall = body.choices[0]?.message.tool_calls?.[0];
  if (!toolCall) {
    throw new Error('Expected fake model to return a tool call.');
  }
  return toolCall;
}

async function postChatAllowFailure(
  baseUrl: string,
  prompt: string,
  overrides: Record<string, unknown> = {}
): Promise<void> {
  await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'tlon-test-scripted',
      messages: [{ role: 'user', content: prompt }],
      ...overrides,
    }),
  });
}

function hermesTitleMessages(
  tag: string,
  reply: string
): Array<{ role: string; content: string }> {
  return [
    {
      role: 'system',
      content:
        'Generate a short, descriptive title (3-7 words) for a conversation ' +
        'that starts with the following exchange. Return ONLY the title text.',
    },
    {
      role: 'user',
      content: `User: ${tag} Hello.\n\nAssistant: ${reply}`,
    },
  ];
}

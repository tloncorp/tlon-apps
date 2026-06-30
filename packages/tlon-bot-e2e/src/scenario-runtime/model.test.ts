import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { FakeModelClient, createFakeModelServer } from '../fake-model/index.js';
import type { FakeModelServerListener } from '../fake-model/server-core.mjs';
import type { ModelScript } from '../drivers/types.js';
import {
  expectModelExpectations,
  expectNoModelCalls,
  registerModelScript,
} from '../scenarios/shared/model.js';

describe('shared model script helpers', () => {
  let server: FakeModelServerListener;
  let fakeModel: FakeModelClient;

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
      expectModelExpectations(fakeModel, 'script-options', script)
    ).resolves.toHaveLength(2);
  });

  test('allows only the declared extra model-call budget', async () => {
    const script: ModelScript = {
      steps: [{ kind: 'text', content: 'ok' }],
      options: { allowExtraCalls: 1 },
      expectations: {
        advertisedTools: { exact: ['tlon'] },
        expectedCallCount: 1,
      },
    };
    const tag = await registerModelScript(fakeModel, 'extra-budget', script);

    await postChat(server.baseUrl, tag, {
      tools: [{ type: 'function', function: { name: 'tlon' } }],
    });
    await postChat(server.baseUrl, tag, {
      tools: [{ type: 'function', function: { name: 'tlon' } }],
    });

    await expect(
      expectModelExpectations(fakeModel, 'extra-budget', script)
    ).resolves.toHaveLength(2);

    await postChatAllowFailure(server.baseUrl, tag, {
      tools: [{ type: 'function', function: { name: 'tlon' } }],
    });

    await expect(
      expectModelExpectations(fakeModel, 'extra-budget', script)
    ).rejects.toThrow(/Expected 1-2 model call/);
  });

  test('allows tool-less auxiliary extra calls while checking tool-bearing calls', async () => {
    const script: ModelScript = {
      steps: [{ kind: 'text', content: 'ok' }],
      options: { allowExtraCalls: 1 },
      expectations: {
        advertisedTools: { exact: ['tlon'] },
        expectedCallCount: 1,
      },
    };
    const tag = await registerModelScript(fakeModel, 'toolless-extra', script);

    await postChat(server.baseUrl, tag, {
      tools: [{ type: 'function', function: { name: 'tlon' } }],
    });
    await postChat(server.baseUrl, tag);

    await expect(
      expectModelExpectations(fakeModel, 'toolless-extra', script)
    ).resolves.toHaveLength(2);
  });

  test('fails when a required model call omits advertised tools', async () => {
    const script: ModelScript = {
      steps: [{ kind: 'text', content: 'ok' }],
      options: { allowExtraCalls: 1 },
      expectations: {
        advertisedTools: { exact: ['tlon'] },
        expectedCallCount: 2,
      },
    };
    const tag = await registerModelScript(fakeModel, 'missing-required-tools', script);

    await postChat(server.baseUrl, tag);
    await postChat(server.baseUrl, tag, {
      tools: [{ type: 'function', function: { name: 'tlon' } }],
    });

    await expect(
      expectModelExpectations(fakeModel, 'missing-required-tools', script)
    ).rejects.toThrow(/Expected exact advertised tools/);
  });

  test('fails when any scenario call advertises unexpected tools', async () => {
    const script: ModelScript = {
      steps: [{ kind: 'text', content: 'ok' }],
      options: { allowExtraCalls: 1 },
      expectations: {
        advertisedTools: { exact: ['tlon'] },
        expectedCallCount: 2,
      },
    };
    const tag = await registerModelScript(fakeModel, 'later-tool-mismatch', script);

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
      expectModelExpectations(fakeModel, 'later-tool-mismatch', script)
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
      expectModelExpectations(fakeModel, 'tool-mismatch', script)
    ).rejects.toThrow(/Advertised tools mismatch/);
  });

  test('asserts no model calls for negative scenarios', async () => {
    await expect(expectNoModelCalls(fakeModel, 'no-calls')).resolves.toBeUndefined();
  });

  test('asserts no unkeyed or differently keyed model calls for negative scenarios', async () => {
    await postChatAllowFailure(server.baseUrl, 'untagged prompt', {
      messages: [{ role: 'user', content: 'untagged prompt' }],
    });

    await expect(expectNoModelCalls(fakeModel)).rejects.toThrow(
      /Expected no model calls, got 1 \(<unkeyed>\)/
    );
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

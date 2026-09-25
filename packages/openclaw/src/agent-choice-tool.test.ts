import { A2UI } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import {
  type AgentChoiceToolParams,
  agentChoiceToolParameters,
  createAgentChoiceToolExecutor,
} from './agent-choice-tool.js';

const validChoice: AgentChoiceToolParams = {
  target: 'chat/~zod/home-group-chat',
  question: 'Which part of AI agent tooling should I follow?',
  options: ['New products', 'Design patterns', 'Research papers'],
};
const choiceDeps = (
  postChoice: Parameters<typeof createAgentChoiceToolExecutor>[0]['postChoice']
) => ({
  postChoice,
  assertCurrent: vi.fn(),
  finish: vi.fn(),
});

function choiceHarness() {
  const postChoice = vi.fn(async () => '{}');
  const deps = choiceDeps(postChoice);
  return {
    deps,
    postChoice,
    execute: createAgentChoiceToolExecutor(deps),
  };
}

const invalidChoices: Array<{
  name: string;
  params: AgentChoiceToolParams;
  message?: string;
}> = [
  {
    name: 'duplicate options',
    params: { ...validChoice, options: ['News', ' news '] },
  },
  {
    name: 'empty options',
    params: { ...validChoice, options: ['News', ''] },
  },
  {
    name: '37-character labels',
    params: { ...validChoice, options: ['News', 'x'.repeat(37)] },
  },
  ...[
    'Other',
    'Custom: describe it',
    'Something else (write it in)',
    'Write your own',
  ].map((option) => ({
    name: `reserved freeform option "${option}"`,
    params: { ...validChoice, options: ['News', option] },
    message: 'built-in freeform',
  })),
  {
    name: 'non-chat target',
    params: { ...validChoice, target: 'dm/~zod' },
  },
];

describe('agent choice tool', () => {
  it('builds a choice for the furnished first-run bot DM', async () => {
    const { execute } = choiceHarness();
    expect(
      (await execute('dm-choice', { ...validChoice, target: '~ten' })).details
    ).toBeUndefined();
  });
  it('advertises the mobile-safe label limit to the model', () => {
    expect(agentChoiceToolParameters.properties.options.items).toEqual({
      type: 'string',
      maxLength: 36,
    });
    expect(agentChoiceToolParameters.properties).not.toHaveProperty(
      'surfaceId'
    );
    expect(agentChoiceToolParameters.properties).not.toHaveProperty(
      'dimension'
    );
  });

  it('builds a valid A2UI SmallChoice with model-authored options', async () => {
    const { execute, postChoice } = choiceHarness();
    await execute('valid-choice', validChoice);
    const entries = JSON.parse(postChoice.mock.calls[0]![0].blob);
    const entry = entries.find((candidate) => candidate.type === 'a2ui');

    expect(A2UI.validateBlobEntry(entry)).toBe(true);
    expect(entry).toEqual(
      expect.objectContaining({
        version: 1,
        storyMode: 'fallback',
        messages: expect.arrayContaining([
          expect.objectContaining({
            updateComponents: expect.objectContaining({
              components: expect.arrayContaining([
                expect.objectContaining({
                  id: 'choices',
                  component: 'SmallChoice',
                  selectionMode: 'single',
                  freeTextPlaceholder: 'Write your own…',
                  options: [
                    { id: 'choice-1', label: 'New products' },
                    { id: 'choice-2', label: 'Design patterns' },
                    { id: 'choice-3', label: 'Research papers' },
                  ],
                }),
              ]),
            }),
          }),
        ]),
      })
    );
  });

  it('posts the question as fallback text and the choice as a blob', async () => {
    const { execute, postChoice } = choiceHarness();

    const result = await execute('call-1', validChoice);

    expect(result.details).toBeUndefined();
    expect(postChoice).toHaveBeenCalledOnce();
    expect(postChoice).toHaveBeenCalledWith({
      target: validChoice.target,
      fallbackQuestion: validChoice.question,
      blob: expect.stringContaining('agent-choice-call-1'),
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: 'Choice posted. Return NO_REPLY now and wait for the owner answer. Do not call another tool in this turn.',
      },
    ]);
  });

  it('does not post a choice after its owner turn is superseded', async () => {
    const { deps, execute, postChoice } = choiceHarness();
    deps.assertCurrent.mockImplementation(() => {
      throw new Error('A newer owner message arrived');
    });

    const result = await execute('stale-choice', validChoice);

    expect(result.details).toEqual({ error: true });
    expect(result.content[0]?.text).toContain('A newer owner message arrived');
    expect(postChoice).not.toHaveBeenCalled();
  });

  it.each(invalidChoices)(
    'rejects $name before posting',
    async ({ params, message }) => {
      const { execute, postChoice } = choiceHarness();
      const result = await execute('invalid-choice', params);
      expect(result.details).toEqual({ error: true });
      if (message) expect(result.content[0]?.text).toContain(message);
      expect(postChoice).not.toHaveBeenCalled();
    }
  );
});

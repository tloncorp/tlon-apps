import { A2UI } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import {
  type AgentChoiceToolParams,
  buildAgentChoiceBlob,
  createAgentChoiceToolExecutor,
} from './agent-choice-tool.js';

const validChoice: AgentChoiceToolParams = {
  target: 'chat/~zod/home-group-chat',
  surfaceId: 'agent-choice-focus-1',
  question: 'Which part of AI agent tooling should I follow?',
  options: ['New products', 'Design patterns', 'Research papers'],
};

describe('agent choice tool', () => {
  it('builds a valid A2UI SmallChoice with model-authored options', () => {
    const [entry] = buildAgentChoiceBlob(validChoice);

    expect(A2UI.validateBlobEntry(entry)).toBe(true);
    expect(entry).toEqual(
      expect.objectContaining({
        storyMode: 'fallback',
        messages: expect.arrayContaining([
          expect.objectContaining({
            updateComponents: expect.objectContaining({
              components: expect.arrayContaining([
                expect.objectContaining({
                  id: 'choices',
                  component: 'SmallChoice',
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
    const postChoice = vi.fn(async () => '{"ok":true}');
    const execute = createAgentChoiceToolExecutor({ postChoice });

    const result = await execute('call-1', validChoice);

    expect(result.details).toBeUndefined();
    expect(postChoice).toHaveBeenCalledOnce();
    expect(postChoice).toHaveBeenCalledWith({
      target: validChoice.target,
      fallbackQuestion: validChoice.question,
      blob: JSON.stringify(buildAgentChoiceBlob(validChoice)),
    });
  });

  it('rejects duplicate, empty, and overlong options before posting', async () => {
    const postChoice = vi.fn(async () => 'unexpected');
    const execute = createAgentChoiceToolExecutor({ postChoice });

    for (const options of [
      ['News', ' news '],
      ['News', ''],
      ['News', 'x'.repeat(65)],
    ]) {
      const result = await execute('call-invalid', {
        ...validChoice,
        options,
      });
      expect(result.details).toEqual({ error: true });
    }
    expect(postChoice).not.toHaveBeenCalled();
  });

  it('requires a bounded choice surface id and current chat target', async () => {
    const postChoice = vi.fn(async () => 'unexpected');
    const execute = createAgentChoiceToolExecutor({ postChoice });

    expect(
      (
        await execute('call-bad-surface', {
          ...validChoice,
          surfaceId: 'question-1',
        })
      ).details
    ).toEqual({ error: true });
    expect(
      (
        await execute('call-long-surface', {
          ...validChoice,
          surfaceId: `agent-choice-${'x'.repeat(512)}`,
        })
      ).details
    ).toEqual({ error: true });
    expect(
      (
        await execute('call-bad-target', {
          ...validChoice,
          target: 'dm/~zod',
        })
      ).details
    ).toEqual({ error: true });
    expect(postChoice).not.toHaveBeenCalled();
  });
});

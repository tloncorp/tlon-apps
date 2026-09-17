import { A2UI } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import {
  type AgentChoiceToolParams,
  agentChoiceToolParameters,
  buildAgentChoiceBlob,
  createAgentChoiceToolExecutor,
} from './agent-choice-tool.js';

const validChoice: AgentChoiceToolParams = {
  target: 'chat/~zod/home-group-chat',
  surfaceId: 'agent-choice-focus-1',
  dimension: 'focus',
  question: 'Which part of AI agent tooling should I follow?',
  options: ['New products', 'Design patterns', 'Research papers'],
};

describe('agent choice tool', () => {
  it('advertises the mobile-safe label limit to the model', () => {
    expect(agentChoiceToolParameters.properties.options.items).toEqual({
      type: 'string',
      maxLength: 36,
    });
  });

  it('builds a valid A2UI SmallChoice with model-authored options', () => {
    const entry = buildAgentChoiceBlob(validChoice).find(
      (candidate) => candidate.type === 'a2ui'
    );

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

  it('durably marks an approach question for later owner-answer verification', () => {
    expect(
      buildAgentChoiceBlob({
        ...validChoice,
        dimension: 'approach',
        surfaceId: 'agent-choice-approach-1',
      })
    ).toContainEqual({
      type: 'tlon-agent-post-marker',
      version: 1,
      key: 'agent-choice-dimension:approach',
    });
    expect(buildAgentChoiceBlob(validChoice)).not.toContainEqual(
      expect.objectContaining({ key: 'agent-choice-dimension:approach' })
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

  it('keeps approach labels concise while retaining the general option limit', async () => {
    const postChoice = vi.fn(async () => '{"ok":true}');
    const execute = createAgentChoiceToolExecutor({ postChoice });
    const longLabel = 'A'.repeat(37);

    const approachResult = await execute('call-long-approach', {
      ...validChoice,
      dimension: 'approach',
      options: ['Use primary research', longLabel],
    });
    const focusResult = await execute('call-long-focus', {
      ...validChoice,
      options: ['New products', longLabel],
    });

    expect(approachResult.details).toEqual({ error: true });
    expect(approachResult.content[0]?.text).toContain('approach option');
    expect(focusResult.details).toBeUndefined();
    expect(postChoice).toHaveBeenCalledOnce();
  });

  it('rejects options that duplicate the built-in freeform answer', async () => {
    const postChoice = vi.fn(async () => 'unexpected');
    const execute = createAgentChoiceToolExecutor({ postChoice });

    for (const duplicate of [
      'Other',
      'Custom: describe it',
      'Something else (write it in)',
      'Write your own',
    ]) {
      const result = await execute('call-redundant-freeform', {
        ...validChoice,
        options: ['New products', duplicate],
      });
      expect(result.details).toEqual({ error: true });
      expect(result.content[0]?.text).toContain('built-in freeform');
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

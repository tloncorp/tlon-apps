import { A2UI } from '@tloncorp/api';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { type TestFixtures, getFixtures, waitFor } from '../lib/index.js';
import { fakeModel } from '../support/fake-model/client.js';

describe('A2UI message authoring and delivery', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await getFixtures();
  });

  beforeEach(async () => {
    await fakeModel.reset();
  });

  test('injects the standing policy and delivers a catalog-backed status widget', async () => {
    const key = 'a2ui-project-status';
    const token = `a2ui-e2e-${Date.now().toString(36)}`;
    const fallback = `Project status ${token}: launch is on track.`;

    await fakeModel.script(key, [
      {
        kind: 'tool_call',
        name: 'message',
        args: {
          action: 'send',
          target: fixtures.userShip,
          message: fallback,
          a2ui: {
            root: 'root',
            components: [
              { id: 'root', component: 'Card', child: 'body' },
              {
                id: 'body',
                component: 'Column',
                children: [
                  'header',
                  'subtitle',
                  'divider-top',
                  'metrics',
                  'divider-bottom',
                  'health',
                  'actions',
                ],
              },
              {
                id: 'header',
                component: 'Row',
                align: 'center',
                children: ['project-icon', 'title'],
              },
              { id: 'project-icon', component: 'Icon', name: 'event' },
              {
                id: 'title',
                component: 'Text',
                variant: 'h2',
                text: 'Launch readiness',
              },
              {
                id: 'subtitle',
                component: 'Text',
                variant: 'caption',
                text: `Live project snapshot · ${token}`,
              },
              { id: 'divider-top', component: 'Divider' },
              {
                id: 'metrics',
                component: 'Row',
                justify: 'spaceBetween',
                children: ['completion', 'blockers', 'target'],
              },
              {
                id: 'completion',
                component: 'Column',
                children: ['completion-value', 'completion-label'],
              },
              {
                id: 'completion-value',
                component: 'Text',
                variant: 'h3',
                text: '84%',
              },
              {
                id: 'completion-label',
                component: 'Text',
                variant: 'caption',
                text: 'Complete',
              },
              {
                id: 'blockers',
                component: 'Column',
                children: ['blockers-value', 'blockers-label'],
              },
              {
                id: 'blockers-value',
                component: 'Text',
                variant: 'h3',
                text: '0',
              },
              {
                id: 'blockers-label',
                component: 'Text',
                variant: 'caption',
                text: 'Blockers',
              },
              {
                id: 'target',
                component: 'Column',
                children: ['target-value', 'target-label'],
              },
              {
                id: 'target-value',
                component: 'Text',
                variant: 'h3',
                text: 'Fri',
              },
              {
                id: 'target-label',
                component: 'Text',
                variant: 'caption',
                text: 'Target',
              },
              { id: 'divider-bottom', component: 'Divider' },
              {
                id: 'health',
                component: 'Row',
                align: 'center',
                children: ['health-icon', 'health-label'],
              },
              { id: 'health-icon', component: 'Icon', name: 'check' },
              {
                id: 'health-label',
                component: 'Text',
                text: 'All launch checks are passing',
              },
              {
                id: 'actions',
                component: 'Row',
                justify: 'end',
                children: ['details-button'],
              },
              {
                id: 'details-button',
                component: 'Button',
                child: 'details-label',
                variant: 'secondary',
                action: {
                  event: {
                    name: A2UI.action.sendMessage,
                    context: { text: 'Show launch details' },
                  },
                },
              },
              {
                id: 'details-label',
                component: 'Text',
                text: 'View details',
              },
            ],
          },
        },
      },
      { kind: 'text', content: 'NO_REPLY' },
    ]);

    const response = await fixtures.client.prompt(
      `[tlon-test:${key}] Give me the current launch readiness at a glance.`
    );
    if (!response.success) {
      throw new Error(response.error ?? 'Prompt failed');
    }

    const modelCalls = await fakeModel.received(key);
    expect(modelCalls.length).toBeGreaterThanOrEqual(1);
    expect(modelCalls[0]?.toolNames).toContain('message');
    expect(modelCalls[0]?.promptSignals?.tlonA2uiProactive).toBe(true);

    const delivered = await waitFor(async () => {
      const posts = await fixtures.userState.channelPosts(fixtures.botShip, 30);
      for (const post of posts ?? []) {
        const candidate = post as {
          authorId?: string;
          textContent?: string | null;
          blob?: string | null;
        };
        if (
          candidate.authorId === fixtures.botShip &&
          candidate.textContent?.includes(token) &&
          candidate.blob
        ) {
          return candidate;
        }
      }
      return undefined;
    }, 30_000);

    const entries = JSON.parse(delivered.blob!) as unknown[];
    const entry = entries.find(
      (value): value is A2UI.BlobEntry =>
        typeof value === 'object' &&
        value !== null &&
        (value as { type?: unknown }).type === 'a2ui'
    );

    expect(entry).toBeDefined();
    expect(A2UI.validateBlobEntry(entry)).toBe(true);

    const graph = A2UI.resolveComponentGraph(entry);
    expect(graph?.root).toBe('root');
    expect(graph?.components.get('root')).toMatchObject({
      component: 'Card',
      child: 'body',
    });
    expect(
      [...(graph?.components.values() ?? [])].map(
        (component) => component.component
      )
    ).toEqual(
      expect.arrayContaining([
        'Card',
        'Column',
        'Row',
        'Text',
        'Icon',
        'Divider',
        'Button',
      ])
    );
    expect(graph?.components.get('details-button')).toMatchObject({
      component: 'Button',
      action: {
        event: {
          name: A2UI.action.sendMessage,
          context: { text: 'Show launch details' },
        },
      },
    });

    console.log(
      `[A2UI] Delivered ${graph?.components.size ?? 0} validated components from ${fixtures.botShip} to ${fixtures.userShip}`
    );
  });
});

import { A2UI } from '@tloncorp/api';
import type {
  PendingApprovalView,
  ResolvedApprovalView,
} from 'openclaw/plugin-sdk/approval-handler-runtime';
import { describe, expect, it } from 'vitest';

import {
  buildTlonNativeApprovalPayload,
  buildTlonPresentationBlobField,
} from './approval-presentation.js';

function parseSingleBlob(blobField: string) {
  const entries = JSON.parse(blobField) as unknown[];
  expect(entries).toHaveLength(1);
  expect(A2UI.validateBlobEntry(entries[0])).toBe(true);
  return entries[0] as A2UI.BlobEntry;
}

function componentRecords(
  blob: A2UI.BlobEntry
): Array<Record<string, unknown>> {
  const message = blob.messages.find((entry) => 'updateComponents' in entry);
  if (!message || !('updateComponents' in message)) {
    throw new Error('missing updateComponents message');
  }
  return message.updateComponents.components as Array<Record<string, unknown>>;
}

describe('Tlon portable approval presentation', () => {
  it('turns exact OpenClaw command actions into A2UI send-message buttons', () => {
    const command = '/approve 1234-abcd allow-once';
    const blobField = buildTlonPresentationBlobField({
      fallbackText: 'Approval required.',
      surfaceId: 'openclaw-1234-abcd',
      presentation: {
        title: 'Exec approval',
        tone: 'warning',
        blocks: [
          {
            type: 'buttons',
            buttons: [
              {
                label: 'Allow Once',
                style: 'success',
                action: { type: 'command', command },
              },
            ],
          },
        ],
      },
    });

    expect(blobField).toBeDefined();
    const components = componentRecords(parseSingleBlob(blobField!));
    expect(components).toContainEqual(
      expect.objectContaining({
        component: 'Button',
        variant: 'primary',
        action: {
          event: {
            name: A2UI.action.sendMessage,
            context: { text: command },
          },
        },
      })
    );
  });

  it('does not turn opaque callback actions into chat commands', () => {
    const blobField = buildTlonPresentationBlobField({
      fallbackText: 'Fallback only',
      presentation: {
        blocks: [
          {
            type: 'buttons',
            buttons: [
              {
                label: 'Unsafe callback',
                action: { type: 'callback', value: 'opaque' },
              },
            ],
          },
        ],
      },
    });

    const components = componentRecords(parseSingleBlob(blobField!));
    expect(
      components.some((component) => component.component === 'Button')
    ).toBe(false);
  });
});

describe('Tlon native approval view rendering', () => {
  const pending: PendingApprovalView = {
    approvalId: 'plugin:approval-1',
    approvalKind: 'plugin',
    phase: 'pending',
    title: 'Deploy service',
    description: 'Deploy to production.',
    severity: 'critical',
    metadata: [{ label: 'Tool', value: 'deploy_service' }],
    actions: [
      {
        decision: 'allow-once',
        label: 'Allow Once',
        style: 'success',
        command: '/approve plugin:approval-1 allow-once',
      },
      {
        decision: 'deny',
        label: 'Deny',
        style: 'danger',
        command: '/approve plugin:approval-1 deny',
      },
    ],
    expiresAtMs: Date.now() + 60_000,
    pluginId: 'deploy-policy',
    toolName: 'deploy_service',
  };

  it('renders only the decisions OpenClaw offered', () => {
    const result = buildTlonNativeApprovalPayload(pending);
    expect(result.text).toContain('/approve plugin:approval-1 allow-once');
    expect(result.text).toContain('/approve plugin:approval-1 deny');
    expect(result.text).not.toContain('allow-always');

    const components = componentRecords(parseSingleBlob(result.blob!));
    const commands = components
      .map((component) => component.action)
      .filter(Boolean)
      .map(
        (action) =>
          (action as { event: { context: { text: string } } }).event.context
            .text
      );
    expect(commands).toEqual([
      '/approve plugin:approval-1 allow-once',
      '/approve plugin:approval-1 deny',
    ]);
  });

  it('removes controls from resolved-state followups', () => {
    const resolved: ResolvedApprovalView = {
      ...pending,
      phase: 'resolved',
      decision: 'deny',
      resolvedBy: 'tlon:~zod',
    };
    const result = buildTlonNativeApprovalPayload(resolved);
    expect(result.blob).toBeUndefined();
    expect(result.text).toContain('Decision: deny');
    expect(result.text).toContain('Resolved by: tlon:~zod');
  });
});

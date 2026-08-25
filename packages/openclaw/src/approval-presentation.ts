import { A2UI } from '@tloncorp/api';
import type { ReplyPayload } from 'openclaw/plugin-sdk/core';
import type {
  ApprovalViewModel,
  PendingApprovalView,
} from 'openclaw/plugin-sdk/approval-handler-runtime';

import { makeA2UIBlob, serializeBlobField } from './urbit/blob.js';

type PortablePresentation = NonNullable<ReplyPayload['presentation']>;

function safeSurfaceId(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
  return normalized || 'openclaw-approval';
}

function buttonVariant(
  style: 'primary' | 'secondary' | 'success' | 'danger' | undefined
): 'primary' | 'secondary' | undefined {
  if (style === 'primary' || style === 'success') {
    return 'primary';
  }
  if (style === 'secondary' || style === 'danger') {
    return 'secondary';
  }
  return undefined;
}

function presentationComponents(params: {
  presentation: PortablePresentation;
  fallbackText?: string;
}): A2UI.Component[] | null {
  const bodyChildren: string[] = [];
  const components: A2UI.Component[] = [
    { id: 'root', component: 'Card', child: 'body' },
    { id: 'body', component: 'Column', children: bodyChildren },
  ];

  if (params.presentation.title?.trim()) {
    bodyChildren.push('title');
    components.push({
      id: 'title',
      component: 'Text',
      variant: 'h3',
      text: params.presentation.title.trim(),
    });
  }

  let renderedVisibleText = false;
  let nextId = 0;
  for (const block of params.presentation.blocks) {
    const blockId = `block${nextId++}`;
    if (block.type === 'text' || block.type === 'context') {
      if (!block.text.trim()) {
        continue;
      }
      renderedVisibleText = true;
      bodyChildren.push(blockId);
      components.push({
        id: blockId,
        component: 'Text',
        ...(block.type === 'context' ? { variant: 'caption' as const } : {}),
        text: block.text,
      });
      continue;
    }
    if (block.type === 'divider') {
      bodyChildren.push(blockId);
      components.push({ id: blockId, component: 'Divider' });
      continue;
    }
    if (block.type !== 'buttons') {
      continue;
    }

    const buttonIds: string[] = [];
    for (const [buttonIndex, button] of block.buttons.entries()) {
      if (
        button.disabled ||
        button.action?.type !== 'command' ||
        !button.action.command.trim()
      ) {
        continue;
      }
      const buttonId = `${blockId}Button${buttonIndex}`;
      const labelId = `${buttonId}Label`;
      buttonIds.push(buttonId);
      const variant = buttonVariant(button.style);
      components.push(
        {
          id: buttonId,
          component: 'Button',
          ...(variant ? { variant } : {}),
          child: labelId,
          action: {
            event: {
              name: A2UI.action.sendMessage,
              context: { text: button.action.command },
            },
          },
        },
        {
          id: labelId,
          component: 'Text',
          text: button.label,
        }
      );
    }
    if (buttonIds.length > 0) {
      bodyChildren.push(blockId);
      components.push({
        id: blockId,
        component: 'Row',
        children: buttonIds,
      });
    }
  }

  if (!renderedVisibleText && params.fallbackText?.trim()) {
    const fallbackId = 'fallbackText';
    const insertionIndex = params.presentation.title?.trim() ? 1 : 0;
    bodyChildren.splice(insertionIndex, 0, fallbackId);
    components.push({
      id: fallbackId,
      component: 'Text',
      text: params.fallbackText.trim(),
    });
  }

  return bodyChildren.length > 0 ? components : null;
}

export function buildTlonPresentationBlobField(params: {
  presentation?: ReplyPayload['presentation'];
  fallbackText?: string;
  surfaceId?: string;
}): string | undefined {
  if (!params.presentation) {
    return undefined;
  }
  const components = presentationComponents({
    presentation: params.presentation,
    fallbackText: params.fallbackText,
  });
  if (!components) {
    return undefined;
  }
  return serializeBlobField(
    makeA2UIBlob(
      safeSurfaceId(params.surfaceId ?? 'openclaw-presentation'),
      'root',
      components
    )
  );
}

function approvalText(view: ApprovalViewModel): string {
  const lines = [view.title];
  if (view.description?.trim()) {
    lines.push(view.description.trim());
  }
  if (view.approvalKind === 'exec') {
    if (view.warningText?.trim()) {
      lines.push(view.warningText.trim());
    }
    lines.push(`Command:\n\`\`\`sh\n${view.commandText}\n\`\`\``);
  }
  for (const item of view.metadata) {
    lines.push(`${item.label}: ${item.value}`);
  }
  if (view.phase === 'pending') {
    lines.push(
      ...view.actions.map((action) => `- ${action.label}: ${action.command}`)
    );
    lines.push(`Expires: ${new Date(view.expiresAtMs).toISOString()}`);
  } else if (view.phase === 'resolved') {
    lines.push(`Decision: ${view.decision}`);
    if (view.resolvedBy) {
      lines.push(`Resolved by: ${view.resolvedBy}`);
    }
  } else {
    lines.push('This approval request expired.');
  }
  lines.push(`Full id: ${view.approvalId}`);
  return lines.join('\n\n');
}

function pendingViewPresentation(
  view: PendingApprovalView
): PortablePresentation {
  return {
    title: view.title,
    tone:
      view.approvalKind === 'plugin' && view.severity === 'critical'
        ? 'danger'
        : 'warning',
    blocks: [
      ...(view.description?.trim()
        ? [{ type: 'text' as const, text: view.description.trim() }]
        : []),
      ...(view.approvalKind === 'exec'
        ? [
            {
              type: 'text' as const,
              text: `Command:\n\`\`\`sh\n${view.commandText}\n\`\`\``,
            },
          ]
        : []),
      ...view.metadata.map((item) => ({
        type: 'context' as const,
        text: `${item.label}: ${item.value}`,
      })),
      {
        type: 'buttons' as const,
        buttons: view.actions.map((action) => ({
          label: action.label,
          style: action.style,
          action: { type: 'command' as const, command: action.command },
        })),
      },
    ],
  };
}

export function buildTlonNativeApprovalPayload(view: ApprovalViewModel): {
  text: string;
  blob?: string;
} {
  const text = approvalText(view);
  if (view.phase !== 'pending') {
    return { text };
  }
  return {
    text,
    blob: buildTlonPresentationBlobField({
      presentation: pendingViewPresentation(view),
      fallbackText: text,
      surfaceId: `openclaw-${view.approvalId}`,
    }),
  };
}

export function readTlonReplyBlob(payload: ReplyPayload): string | undefined {
  const blob = (payload.channelData?.tlon as { blob?: unknown } | undefined)
    ?.blob;
  return typeof blob === 'string' ? blob : undefined;
}

export function approvalSurfaceId(payload: ReplyPayload): string | undefined {
  const approval = payload.channelData?.execApproval as
    | { approvalId?: unknown }
    | undefined;
  return typeof approval?.approvalId === 'string'
    ? `openclaw-${approval.approvalId}`
    : undefined;
}

import { A2UI } from '@tloncorp/api';
import type { ReplyPayload } from 'openclaw/plugin-sdk/core';
import type {
  ApprovalViewModel,
  PendingApprovalView,
} from 'openclaw/plugin-sdk/approval-handler-runtime';

import { makeA2UIBlob, serializeBlobField } from './urbit/blob.js';

type PortablePresentation = NonNullable<ReplyPayload['presentation']>;

function safeSurfaceId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'openclaw';
}

function buttonVariant(
  style: 'primary' | 'secondary' | 'success' | 'danger' | undefined
): 'primary' | 'secondary' | undefined {
  if (style === 'primary' || style === 'success') return 'primary';
  if (style === 'secondary' || style === 'danger') return 'secondary';
  return undefined;
}

function presentationComponents(
  presentation: PortablePresentation,
  fallbackText?: string
): A2UI.Component[] | null {
  const children: string[] = [];
  const components: A2UI.Component[] = [
    { id: 'root', component: 'Card', child: 'body' },
    { id: 'body', component: 'Column', children },
  ];

  if (presentation.title?.trim()) {
    children.push('title');
    components.push({
      id: 'title',
      component: 'Text',
      variant: 'h3',
      text: presentation.title.trim(),
    });
  }

  let hasText = false;
  for (const [index, block] of presentation.blocks.entries()) {
    const id = `block${index}`;
    if (block.type === 'text' || block.type === 'context') {
      if (!block.text.trim()) continue;
      hasText = true;
      children.push(id);
      components.push({
        id,
        component: 'Text',
        ...(block.type === 'context' ? { variant: 'caption' as const } : {}),
        text: block.text,
      });
    } else if (block.type === 'divider') {
      children.push(id);
      components.push({ id, component: 'Divider' });
    } else if (block.type === 'buttons') {
      const buttonIds: string[] = [];
      for (const [buttonIndex, button] of block.buttons.entries()) {
        if (
          button.disabled ||
          button.action?.type !== 'command' ||
          !button.action.command.trim()
        ) {
          continue;
        }
        const buttonId = `${id}Button${buttonIndex}`;
        const labelId = `${buttonId}Label`;
        const variant = buttonVariant(button.style);
        buttonIds.push(buttonId);
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
          { id: labelId, component: 'Text', text: button.label }
        );
      }
      if (buttonIds.length > 0) {
        children.push(id);
        components.push({ id, component: 'Row', children: buttonIds });
      }
    }
  }

  if (!hasText && fallbackText?.trim()) {
    const insertionIndex = presentation.title?.trim() ? 1 : 0;
    children.splice(insertionIndex, 0, 'fallbackText');
    components.push({
      id: 'fallbackText',
      component: 'Text',
      text: fallbackText.trim(),
    });
  }

  return children.length > 0 ? components : null;
}

export function buildTlonPresentationBlobField(params: {
  presentation?: ReplyPayload['presentation'];
  fallbackText?: string;
  surfaceId?: string;
}): string | undefined {
  if (!params.presentation) return undefined;
  const components = presentationComponents(
    params.presentation,
    params.fallbackText
  );
  if (!components) return undefined;
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
  if (view.description?.trim()) lines.push(view.description.trim());
  if (view.approvalKind === 'exec') {
    if (view.warningText?.trim()) lines.push(view.warningText.trim());
    lines.push(`Command:\n\`\`\`sh\n${view.commandText}\n\`\`\``);
  }
  for (const item of view.metadata) lines.push(`${item.label}: ${item.value}`);
  if (view.phase === 'pending') {
    lines.push(
      ...view.actions.map((action) => `- ${action.label}: ${action.command}`),
      `Expires: ${new Date(view.expiresAtMs).toISOString()}`
    );
  } else if (view.phase === 'resolved') {
    lines.push(`Decision: ${view.decision}`);
    if (view.resolvedBy) lines.push(`Resolved by: ${view.resolvedBy}`);
  } else {
    lines.push('This approval request expired.');
  }
  lines.push(`Full id: ${view.approvalId}`);
  return lines.join('\n\n');
}

function pendingPresentation(view: PendingApprovalView): PortablePresentation {
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
  return {
    text,
    ...(view.phase === 'pending'
      ? {
          blob: buildTlonPresentationBlobField({
            presentation: pendingPresentation(view),
            fallbackText: text,
            surfaceId: `openclaw-${view.approvalId}`,
          }),
        }
      : {}),
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

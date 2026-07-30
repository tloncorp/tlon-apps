import { A2UI } from '@tloncorp/api';
import { parseGroupAgentConfig } from '@tloncorp/api/types/groupAgentConfig';
import { agentGroupTemplates } from '@tloncorp/api/types/groupTemplates';

import { type TlonA2UIBlob, makeA2UIBlob } from '../urbit/blob.js';

/**
 * Agent onboarding, bot side: the purpose picker the agent posts into a group
 * that has no agent config yet.
 *
 * The design's choice cards are tappable and land inline in the transcript —
 * that is what A2UI is for. Each card's Button carries a `tlon.sendMessage`
 * action, so tapping one posts the choice as the user's own reply and the
 * conversation continues normally from there. Tlon code owns the layout and
 * the actions (same shape as the approval cards); the agent never composes
 * components.
 */

export const PURPOSE_PICKER_PROMPT =
  "Let's make you a group that does something useful. What should it do?";

export const PURPOSE_PICKER_FOOTER =
  'Or just tell me — the cards are only starts.';

/** Plain-text fallback for old clients and notifications. */
export function purposePickerFallbackText(): string {
  const options = agentGroupTemplates
    .map((t) => `• ${t.agent.cardTitle} — ${t.agent.cardDescription}`)
    .join('\n');
  return `${PURPOSE_PICKER_PROMPT}\n\n${options}\n\n${PURPOSE_PICKER_FOOTER}`;
}

/**
 * Build the purpose-picker card. Component ids and ordering are fixed here so
 * the rendered result is deterministic.
 */
export function buildPurposePickerBlob(surfaceSuffix: string): TlonA2UIBlob {
  const components: A2UI.Component[] = [
    {
      id: 'root',
      component: 'Column',
      children: [
        'prompt',
        ...agentGroupTemplates.map((t) => `card-${t.id}`),
        'footer',
      ],
    },
    { id: 'prompt', component: 'Text', text: PURPOSE_PICKER_PROMPT },
  ];

  for (const template of agentGroupTemplates) {
    const { id } = template;
    const { cardTitle, cardDescription } = template.agent;
    components.push(
      { id: `card-${id}`, component: 'Card', child: `body-${id}` },
      {
        id: `body-${id}`,
        component: 'Column',
        children: [`title-${id}`, `desc-${id}`, `pick-${id}`],
      },
      {
        id: `title-${id}`,
        component: 'Text',
        variant: 'h4',
        text: cardTitle,
      },
      {
        id: `desc-${id}`,
        component: 'Text',
        variant: 'caption',
        text: cardDescription,
      },
      {
        id: `pick-${id}`,
        component: 'Button',
        variant: 'primary',
        child: `pickLabel-${id}`,
        action: {
          event: {
            name: A2UI.action.sendMessage,
            // Tapping posts the choice as the user's reply, exactly as if
            // they had typed it — the agent reads it as a normal message.
            context: { text: cardTitle },
          },
        },
      },
      { id: `pickLabel-${id}`, component: 'Text', text: cardTitle }
    );
  }

  components.push({
    id: 'footer',
    component: 'Text',
    variant: 'caption',
    text: PURPOSE_PICKER_FOOTER,
  });

  return makeA2UIBlob(`agent-onboarding-${surfaceSuffix}`, 'root', components);
}

/**
 * Read one group's `meta.description` off the ship. Used to tell a
 * not-yet-configured group from a configured one; returns null when the scry
 * fails so a transient error can't cause a spurious re-offer.
 */
export async function fetchGroupDescription(
  api: { scry: (path: string) => Promise<unknown> } | null,
  groupFlag: string,
  runtime: { error?: (message: string) => void }
): Promise<string | null> {
  if (!api) {
    return null;
  }
  try {
    const groups = (await api.scry('/groups/v2/groups.json')) as Record<
      string,
      { meta?: { description?: unknown } }
    > | null;
    const description = groups?.[groupFlag]?.meta?.description;
    return typeof description === 'string' ? description : '';
  } catch (error) {
    runtime.error?.(
      `[tlon] Failed to scry group description for ${groupFlag}: ${String(error)}`
    );
    return null;
  }
}

/** True when `text` is one of the picker's card titles. */
export function isPurposePickerChoice(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return agentGroupTemplates.some(
    (t) => t.agent.cardTitle.toLowerCase() === trimmed
  );
}

/**
 * Whether to offer the picker in response to this message.
 *
 * Offered once per channel, only for the owner's own message in a group the
 * owner hosts that has no agent config yet — and never in response to a tap
 * on the picker itself (that reply continues the conversation instead).
 */
export function shouldOfferPurposePicker(opts: {
  senderIsOwner: boolean;
  groupHostIsOwner: boolean;
  groupDescription: string | null | undefined;
  messageText: string;
  alreadyOffered: boolean;
}): boolean {
  if (opts.alreadyOffered) {
    return false;
  }
  if (!opts.senderIsOwner || !opts.groupHostIsOwner) {
    return false;
  }
  if (parseGroupAgentConfig(opts.groupDescription)) {
    // Group is already configured — nothing to set up.
    return false;
  }
  if (isPurposePickerChoice(opts.messageText)) {
    return false;
  }
  return true;
}

import { A2UI } from '@tloncorp/api';
import { encodeGroupAgentConfig } from '@tloncorp/api/types/groupAgentConfig';
import { agentGroupTemplates } from '@tloncorp/api/types/groupTemplates';
import { describe, expect, test } from 'vitest';

import {
  buildPurposePickerBlob,
  fetchGroupDescription,
  isPurposePickerChoice,
  purposePickerFallbackText,
  shouldOfferPurposePicker,
} from './agent-onboarding.js';

const configuredDescription = encodeGroupAgentConfig({
  type: 'tlon-group-agent-config',
  version: 1,
  purpose: 'Keeps up with sourdough.',
  instructions: 'Be useful.',
  agents: ['~pinser-botter-sampel-palnet'],
  jobs: [],
  updatedAt: 1,
});

const baseOpts = {
  senderIsOwner: true,
  groupHostIsOwner: true,
  groupDescription: '',
  messageText: 'hey',
  alreadyOffered: false,
};

describe('purpose picker card', () => {
  test('builds a valid a2ui blob with a button per template', () => {
    const blob = buildPurposePickerBlob('chat/~sampel-palnet/home-group-chat');
    expect(A2UI.validateBlobEntry(blob)).toBe(true);

    const update = blob.messages.find((m) => 'updateComponents' in m);
    const components = (update as any).updateComponents
      .components as A2UI.Component[];
    const buttons = components.filter((c) => c.component === 'Button');
    expect(buttons).toHaveLength(agentGroupTemplates.length);
  });

  test('each button posts its own card title as the user reply', () => {
    const blob = buildPurposePickerBlob('nest');
    const update = blob.messages.find((m) => 'updateComponents' in m);
    const components = (update as any).updateComponents
      .components as A2UI.Component[];

    for (const template of agentGroupTemplates) {
      const button = components.find(
        (c): c is A2UI.Button =>
          c.component === 'Button' && c.id === `pick-${template.id}`
      );
      expect(button).toBeDefined();
      expect(button!.action?.event.name).toBe(A2UI.action.sendMessage);
      expect(
        (button!.action?.event as A2UI.SendMessageEvent).context.text
      ).toBe(template.agent.cardTitle);
      // The posted text must round-trip as a recognized choice, otherwise the
      // picker would be re-offered in response to its own tap.
      expect(isPurposePickerChoice(template.agent.cardTitle)).toBe(true);
    }
  });

  test('fallback text names every option for old clients', () => {
    const text = purposePickerFallbackText();
    for (const template of agentGroupTemplates) {
      expect(text).toContain(template.agent.cardTitle);
    }
  });

  test('surface ids are namespaced per channel', () => {
    const a = buildPurposePickerBlob('chat/~a/one');
    const b = buildPurposePickerBlob('chat/~b/two');
    const surfaceOf = (blob: typeof a) =>
      (blob.messages.find((m) => 'createSurface' in m) as any).createSurface
        .surfaceId;
    expect(surfaceOf(a)).not.toEqual(surfaceOf(b));
  });
});

describe('shouldOfferPurposePicker', () => {
  test('offers on the owner first message in an unconfigured owned group', () => {
    expect(shouldOfferPurposePicker(baseOpts)).toBe(true);
  });

  test('does not offer twice', () => {
    expect(
      shouldOfferPurposePicker({ ...baseOpts, alreadyOffered: true })
    ).toBe(false);
  });

  test('does not offer to non-owners or in groups the owner does not host', () => {
    expect(
      shouldOfferPurposePicker({ ...baseOpts, senderIsOwner: false })
    ).toBe(false);
    expect(
      shouldOfferPurposePicker({ ...baseOpts, groupHostIsOwner: false })
    ).toBe(false);
  });

  test('does not offer when the group already has an agent config', () => {
    expect(
      shouldOfferPurposePicker({
        ...baseOpts,
        groupDescription: configuredDescription,
      })
    ).toBe(false);
  });

  test('leaves human descriptions alone', () => {
    expect(
      shouldOfferPurposePicker({
        ...baseOpts,
        groupDescription: 'a group about bread',
      })
    ).toBe(true);
  });

  test('does not re-offer in response to a card tap', () => {
    for (const template of agentGroupTemplates) {
      expect(
        shouldOfferPurposePicker({
          ...baseOpts,
          messageText: `  ${template.agent.cardTitle.toUpperCase()}  `,
        })
      ).toBe(false);
    }
  });
});

describe('fetchGroupDescription', () => {
  const flag = '~sampel-palnet/home-group';

  test('returns the description for the flag', async () => {
    const api = {
      scry: async () => ({ [flag]: { meta: { description: 'hello' } } }),
    };
    expect(await fetchGroupDescription(api, flag, {})).toBe('hello');
  });

  test('returns empty string when the group has no description', async () => {
    const api = { scry: async () => ({ [flag]: { meta: {} } }) };
    expect(await fetchGroupDescription(api, flag, {})).toBe('');
  });

  test('returns null on scry failure so callers can stay silent', async () => {
    const errors: string[] = [];
    const api = {
      scry: async () => {
        throw new Error('boom');
      },
    };
    expect(
      await fetchGroupDescription(api, flag, {
        error: (m) => errors.push(m),
      })
    ).toBeNull();
    expect(errors).toHaveLength(1);
  });

  test('returns null without an api client', async () => {
    expect(await fetchGroupDescription(null, flag, {})).toBeNull();
  });
});

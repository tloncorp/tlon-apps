import { A2UI } from '@tloncorp/shared/logic';
import { describe, expect, it } from 'vitest';

import { isConsumableA2UIAction } from './a2uiActionConsumption';

function action(name: A2UI.ButtonAction['event']['name']) {
  return { event: { name, context: {} } } as A2UI.ButtonAction;
}

describe('isConsumableA2UIAction', () => {
  it('consumes owner-response actions', () => {
    expect(isConsumableA2UIAction(action(A2UI.action.sendMessage))).toBe(true);
    expect(isConsumableA2UIAction(action(A2UI.action.provisionAgent))).toBe(
      true
    );
  });

  it('keeps client-local actions reusable', () => {
    expect(isConsumableA2UIAction(action(A2UI.action.navigate))).toBe(false);
    expect(isConsumableA2UIAction(action(A2UI.action.inviteLink))).toBe(false);
  });
});

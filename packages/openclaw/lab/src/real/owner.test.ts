import { expect, test } from 'vitest';
import {
  resolveAgentProvisionId,
  resolveAgentProvisionTimezone,
} from '../../../../app/ui/components/ChatMessage/agentProvision';
import { provisionId, provisionTimezone } from './owner.js';

// The owner copies the app's provisioning rules; keep them identical.
test('provisioning matches the app', () => {
  const context = JSON.stringify({ topics: ['AI'], scheduleHour: 8 });
  expect(provisionId('170.141.184.507', context)).toBe(
    resolveAgentProvisionId('170.141.184.507', 'auto-provision', 'x', context)
  );
  for (const [override, device] of [
    [undefined, 'America/New_York'],
    ['Europe/Paris', 'America/New_York'],
    ['  ', undefined],
  ] as const) {
    expect(provisionTimezone(override, device)).toBe(
      resolveAgentProvisionTimezone(override, device)
    );
  }
});

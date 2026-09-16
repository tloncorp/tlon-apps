import { describe, expect, it } from 'vitest';

import {
  resolveAgentProvisionButtonLabel,
  resolveAgentProvisionTimezone,
} from './agentProvision';

describe('resolveAgentProvisionTimezone', () => {
  it('defaults to the live client timezone instead of the host timezone', () => {
    expect(
      resolveAgentProvisionTimezone(undefined, 'America/Los_Angeles')
    ).toBe('America/Los_Angeles');
  });

  it('honors an explicit owner timezone override', () => {
    expect(
      resolveAgentProvisionTimezone('Europe/London', 'America/Los_Angeles')
    ).toBe('Europe/London');
  });

  it('falls back safely when the client cannot resolve a timezone', () => {
    expect(resolveAgentProvisionTimezone(undefined, undefined)).toBe('UTC');
  });
});

describe('resolveAgentProvisionButtonLabel', () => {
  it('acknowledges a request while sending and after acceptance', () => {
    expect(resolveAgentProvisionButtonLabel('Create task', true, false)).toBe(
      'Creating…'
    );
    expect(resolveAgentProvisionButtonLabel('Create task', false, true)).toBe(
      'Request sent'
    );
    expect(resolveAgentProvisionButtonLabel('Create task', false, false)).toBe(
      'Create task'
    );
  });
});

import { beforeEach, describe, expect, test } from 'vitest';

// @tlon-e2e hermes: connectivity.fake_ships, state.contacts, dm.send_from_user, dm.basic_reply
import { getFixtures } from '../lib/index.js';
import { fakeModel } from '../support/fake-model/client.js';

describe('Hermes Tlon integration smoke', () => {
  beforeEach(async () => {
    await fakeModel.reset();
  });

  test('connects to fake ships', async () => {
    const fixtures = await getFixtures();

    const botContacts = await fixtures.botState.contacts();
    const userContacts = await fixtures.userState.contacts();

    expect(Array.isArray(botContacts)).toBe(true);
    expect(Array.isArray(userContacts)).toBe(true);
  });

  test('answers a DM through the scripted fake model', async () => {
    const fixtures = await getFixtures();
    const key = `hermes-dm-smoke-${Date.now()}`;
    const reply = `hermes smoke reply ${Date.now()}`;

    await fakeModel.script(key, [{ kind: 'text', content: reply }]);

    const result = await fixtures.client.prompt(
      `[tlon-test:${key}] reply exactly: ${reply}`,
      { timeoutMs: 120_000 }
    );

    expect(result.success, result.error).toBe(true);
    expect(result.text).toContain(reply);

    const calls = await fakeModel.received(key);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.at(-1)?.model).toBe('tlon-test-scripted');
  });
});

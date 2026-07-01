import { beforeEach, describe, expect, test } from 'vitest';

import { hermesDriver } from '../drivers/hermes.js';
import { FakeModelClient } from '../fake-model/index.js';
import {
  TlonActorClient,
  actorFromEnv,
  botCredentialsFromEnv,
  normalizeShip,
} from '../tlon/index.js';
import {
  expectModelExpectations,
  registerModelScript,
} from './shared/model.js';

describe('Hermes shared E2E smoke', () => {
  const fakeModel = new FakeModelClient(requireEnv('FAKE_MODEL_BASE_URL'));
  const botShip = normalizeShip(requireEnv('TLON_SHIP'));
  let owner: TlonActorClient;
  let thirdParty: TlonActorClient;

  beforeEach(async () => {
    owner = actorFromEnv('TEST_USER');
    thirdParty = actorFromEnv('TEST_THIRD_PARTY');
    await fakeModel.reset();
  });

  test('owner DM receives final assistant text', async () => {
    const key = `hermes-text-${Date.now()}`;
    const reply = `Hermes text smoke reply ${key}`;
    const script = hermesDriver.model.replyText(reply);
    const tag = await registerModelScript(fakeModel, key, script);

    const result = await owner.promptDm(
      botShip,
      `${tag} Reply with the scripted smoke text.`
    );

    expect(result.success, result.error).toBe(true);
    expect(result.text).toContain(reply);

    const calls = await expectModelExpectations(fakeModel, key, script);
    expect(calls[0].stream).toBe(true);
    expect(calls[0].model).toBe('tlon-test-scripted');
  });

  test('streamed tlon tool call loops back to final assistant text', async () => {
    const key = `hermes-tlon-${Date.now()}`;
    const finalReply = `Hermes tlon tool smoke final reply ${key}`;
    const script = hermesDriver.model.readOrAdmin('version', finalReply);
    const tag = await registerModelScript(fakeModel, key, script);

    const result = await owner.promptDm(
      botShip,
      `${tag} Run tlon version, then reply with the scripted result.`,
      { timeoutMs: 120_000 }
    );

    expect(result.success, result.error).toBe(true);
    expect(result.text).toContain(finalReply);

    const calls = await expectModelExpectations(fakeModel, key, script);
    expect(calls[0].stream).toBe(true);
    expect(calls[1].messageCount).toBeGreaterThan(calls[0].messageCount);
  });

  test('unauthorized DM sender does not reach model or receive direct reply', async () => {
    const key = `hermes-unauthorized-${Date.now()}`;
    await fakeModel.script(key, [
      { kind: 'text', content: 'unauthorized should not see this' },
    ]);
    const baseline = await thirdParty.latestSequenceFrom(botShip, botShip);

    await thirdParty.sendDm(
      botShip,
      `[tlon-test:${key}] Unauthorized sender should not reach the model.`
    );
    await thirdParty.waitForNoDmFrom(botShip, baseline, 12_000);

    expect(await fakeModel.received(key)).toHaveLength(0);
  });

  test('bot credentials are available to the host smoke harness', () => {
    expect(botCredentialsFromEnv().shipName).toBe(botShip);
  });
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

import { describe, expect, test } from 'vitest';

import {
  buildComposeProcessEnv,
  findDisallowedEnvKeys,
} from './env.js';

describe('compose environment scrubber', () => {
  test('keeps docker basics and explicit env but drops ambient credentials', () => {
    const env = buildComposeProcessEnv({
      projectName: 'tlon-test',
      explicitEnv: {
        FAKE_MODEL_PORT: '41000',
        HERMES_MODEL_API_KEY: 'no-key-required',
      },
      sourceEnv: {
        PATH: '/bin',
        HOME: '/tmp/home',
        DOCKER_HOST: 'unix:///docker.sock',
        OPENROUTER_API_KEY: 'live-key',
        MODEL: 'real-model',
        BRAVE_API_KEY: 'live-brave',
      },
    });

    expect(env).toMatchObject({
      PATH: '/bin',
      HOME: '/tmp/home',
      DOCKER_HOST: 'unix:///docker.sock',
      COMPOSE_PROJECT_NAME: 'tlon-test',
      FAKE_MODEL_PORT: '41000',
      HERMES_MODEL_API_KEY: 'no-key-required',
    });
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
    expect(env.MODEL).toBeUndefined();
    expect(env.BRAVE_API_KEY).toBeUndefined();
  });

  test('reports non-empty disallowed env keys', () => {
    expect(
      findDisallowedEnvKeys({
        PATH: '/bin',
        OPENAI_API_KEY: 'live',
        BRAVE_API_KEY: '',
        TLON_TELEMETRY_API_KEY: 'phc',
      })
    ).toEqual(['OPENAI_API_KEY', 'TLON_TELEMETRY_API_KEY']);
  });
});

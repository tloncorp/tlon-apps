import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import {
  buildComposeProcessEnv,
  findDisallowedEnvKeys,
  loadTlonBotE2eEnvFile,
} from './env.js';

const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tmpDirs.map((dir) => rm(dir, { recursive: true, force: true }))
  );
  tmpDirs.length = 0;
});

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
      COMPOSE_DISABLE_ENV_FILE: 'true',
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

describe('tlon-bot-e2e env file loader', () => {
  test('loads allowlisted keys and simple dotenv quoting', async () => {
    const envFilePath = await writeTempEnvFile(`
      # local harness settings
      export TLON_BOT_E2E_DRIVER=openclaw
      TLON_BOT_E2E_SUITE=common
      TLON_BOT_E2E_SCENARIO_PARTITIONS=baseline
      FAKE_SHIP_CACHE_DIR="/tmp/tlon cache"
      BRAVE_API_KEY="abc#def"
      TLONBOT_TOKEN=abc#def
      TEST_STORAGE_BUCKET=bucket-name # inline comment
      TEST_STORAGE_SECRET_KEY='quoted secret'
    `);
    const targetEnv = {
      TEST_STORAGE_SECRET_KEY: 'from-shell',
    } as NodeJS.ProcessEnv;

    const result = await loadTlonBotE2eEnvFile({ envFilePath, targetEnv });

    expect(result).toMatchObject({
      envFilePath,
      loaded: [
        'TLON_BOT_E2E_DRIVER',
        'TLON_BOT_E2E_SUITE',
        'TLON_BOT_E2E_SCENARIO_PARTITIONS',
        'FAKE_SHIP_CACHE_DIR',
        'BRAVE_API_KEY',
        'TLONBOT_TOKEN',
        'TEST_STORAGE_BUCKET',
      ],
      skipped: ['TEST_STORAGE_SECRET_KEY'],
    });
    expect(targetEnv.TLON_BOT_E2E_DRIVER).toBe('openclaw');
    expect(targetEnv.TLON_BOT_E2E_SUITE).toBe('common');
    expect(targetEnv.TLON_BOT_E2E_SCENARIO_PARTITIONS).toBe('baseline');
    expect(targetEnv.FAKE_SHIP_CACHE_DIR).toBe('/tmp/tlon cache');
    // Standard dotenv semantics: quoting preserves '#'; unquoted '#' starts
    // an inline comment even without preceding whitespace.
    expect(targetEnv.BRAVE_API_KEY).toBe('abc#def');
    expect(targetEnv.TLONBOT_TOKEN).toBe('abc');
    expect(targetEnv.TEST_STORAGE_BUCKET).toBe('bucket-name');
    expect(targetEnv.TEST_STORAGE_SECRET_KEY).toBe('from-shell');
  });

  test('rejects unknown keys instead of importing ambient credentials', async () => {
    const envFilePath = await writeTempEnvFile('OPENAI_API_KEY=live-key\n');

    await expect(
      loadTlonBotE2eEnvFile({
        envFilePath,
        targetEnv: {} as NodeJS.ProcessEnv,
      })
    ).rejects.toThrow(/Unsupported key OPENAI_API_KEY/);
  });

  test('rejects duplicate keys', async () => {
    const envFilePath = await writeTempEnvFile(
      'TLON_BOT_E2E_DRIVER=hermes\nTLON_BOT_E2E_DRIVER=openclaw\n'
    );

    await expect(
      loadTlonBotE2eEnvFile({
        envFilePath,
        targetEnv: {} as NodeJS.ProcessEnv,
      })
    ).rejects.toThrow(/Duplicate key TLON_BOT_E2E_DRIVER/);
  });

  test('returns null when the env file is absent', async () => {
    await expect(
      loadTlonBotE2eEnvFile({
        envFilePath: path.join(os.tmpdir(), 'missing-tlon-bot-e2e.env'),
        targetEnv: {} as NodeJS.ProcessEnv,
      })
    ).resolves.toBeNull();
  });
});

async function writeTempEnvFile(contents: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tlon-bot-e2e-env-'));
  tmpDirs.push(dir);
  const envFilePath = path.join(dir, '.env');
  await writeFile(envFilePath, contents, 'utf8');
  return envFilePath;
}

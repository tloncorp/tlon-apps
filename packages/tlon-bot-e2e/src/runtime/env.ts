import { readFile } from 'node:fs/promises';

const BASE_ENV_ALLOWLIST = new Set([
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TMPDIR',
  'TEMP',
  'TMP',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'SYSTEMROOT',
  'COMSPEC',
  'PATHEXT',
]);

const DOCKER_ENV_ALLOWLIST = new Set([
  'DOCKER_HOST',
  'DOCKER_CONTEXT',
  'DOCKER_CONFIG',
  'DOCKER_CERT_PATH',
  'DOCKER_TLS_VERIFY',
  'SSH_AUTH_SOCK',
]);

export const DISALLOWED_AMBIENT_ENV_PATTERNS = [
  /(^|_)API_KEY$/,
  /(^|_)TOKEN$/,
  /(^|_)SECRET$/,
  /(^|_)PASSWORD$/,
  /^OPENROUTER_/,
  /^OPENAI_/,
  /^ANTHROPIC_/,
  /^POSTHOG_/,
  /^BRAVE_/,
  /^FIRECRAWL_/,
  /^TAVILY_/,
  /^EXA_/,
  /^PARALLEL_/,
  /^MODEL$/,
  /^HERMES_MODEL/,
  /^MCP_/,
  /^TLON_TELEMETRY_API_KEY$/,
];

export const TLON_BOT_E2E_ENV_FILE_KEYS = [
  'TLON_BOT_E2E_DRIVER',
  'TLON_BOT_E2E_SUITE',
  'TLON_BOT_E2E_REPO_ROOT',
  'TLON_BOT_E2E_RUN_ID',
  'TLON_BOT_E2E_KEEP_STACK',
  'TLON_BOT_E2E_SCENARIO_PARTITIONS',
  'DUMP_LOGS',
  'FAKE_MODEL_PORT',
  'ZOD_PORT',
  'TEN_PORT',
  'MUG_PORT',
  'OPENCLAW_GATEWAY_PORT',
  'FAKE_SHIP_CACHE_DIR',
  'TLONBOT_DIR',
  'TLONBOT_TOKEN',
  'BRAVE_API_KEY',
  'TLON_KNOWN_BOT_USERS',
  'TLON_MAX_CONSECUTIVE_BOT_RESPONSES',
  'TEST_STORAGE_ENDPOINT',
  'TEST_STORAGE_BUCKET',
  'TEST_STORAGE_ACCESS_KEY',
  'TEST_STORAGE_SECRET_KEY',
  'TEST_STORAGE_REGION',
  'TEST_LIVE_TOOL_TRACE',
  'TEST_LIVE_TOOL_TRACE_CONTENTS',
  'CI_LIVE_TOOL_TRACE',
  'CI_LIVE_TOOL_TRACE_CONTENTS',
  'VERBOSE',
  'HERMES_PLUGINS_DEBUG',
] as const;

const TLON_BOT_E2E_ENV_FILE_KEY_SET = new Set<string>(
  TLON_BOT_E2E_ENV_FILE_KEYS
);

export interface ComposeEnvOptions {
  projectName: string;
  explicitEnv: Record<string, string>;
  sourceEnv?: NodeJS.ProcessEnv;
}

export interface LoadTlonBotE2eEnvFileOptions {
  envFilePath: string;
  targetEnv?: NodeJS.ProcessEnv;
}

export interface LoadTlonBotE2eEnvFileResult {
  envFilePath: string;
  loaded: string[];
  skipped: string[];
}

interface ParsedEnvEntry {
  key: string;
  value: string;
  line: number;
}

export async function loadTlonBotE2eEnvFile({
  envFilePath,
  targetEnv = process.env,
}: LoadTlonBotE2eEnvFileOptions): Promise<LoadTlonBotE2eEnvFileResult | null> {
  let contents: string;
  try {
    contents = await readFile(envFilePath, 'utf8');
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return null;
    }
    throw error;
  }

  const loaded: string[] = [];
  const skipped: string[] = [];
  const entries = parseEnvFile(contents, envFilePath);
  const seenKeys = new Set<string>();
  for (const entry of entries) {
    if (seenKeys.has(entry.key)) {
      throw new Error(
        `Duplicate key ${entry.key} in ${envFilePath}:${entry.line}.`
      );
    }
    seenKeys.add(entry.key);
    if (!TLON_BOT_E2E_ENV_FILE_KEY_SET.has(entry.key)) {
      throw new Error(
        `Unsupported key ${entry.key} in ${envFilePath}:${entry.line}. ` +
          `Only tlon-bot-e2e harness keys are accepted here.`
      );
    }
    if (targetEnv[entry.key] !== undefined) {
      skipped.push(entry.key);
      continue;
    }
    targetEnv[entry.key] = entry.value;
    loaded.push(entry.key);
  }

  return {
    envFilePath,
    loaded,
    skipped,
  };
}

export function buildComposeProcessEnv({
  projectName,
  explicitEnv,
  sourceEnv = process.env,
}: ComposeEnvOptions): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(sourceEnv)) {
    if (value === undefined) {
      continue;
    }
    if (BASE_ENV_ALLOWLIST.has(key) || DOCKER_ENV_ALLOWLIST.has(key)) {
      env[key] = value;
    }
  }

  env.COMPOSE_PROJECT_NAME = projectName;
  env.COMPOSE_DISABLE_ENV_FILE = 'true';
  for (const [key, value] of Object.entries(explicitEnv)) {
    env[key] = value;
  }
  return env;
}

export function findDisallowedEnvKeys(
  env: Record<string, string | undefined>
): string[] {
  return Object.keys(env)
    .filter((key) => {
      const value = env[key];
      return (
        typeof value === 'string' &&
        value.length > 0 &&
        DISALLOWED_AMBIENT_ENV_PATTERNS.some((pattern) => pattern.test(key))
      );
    })
    .sort();
}

function parseEnvFile(contents: string, envFilePath: string): ParsedEnvEntry[] {
  const entries: ParsedEnvEntry[] = [];
  const lines = contents
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');
  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    let line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      return;
    }
    if (line.startsWith('export ')) {
      line = line.slice('export '.length).trimStart();
    }

    const separator = line.indexOf('=');
    if (separator < 1) {
      throw new Error(
        `Invalid .env line ${lineNumber} in ${envFilePath}: expected KEY=VALUE.`
      );
    }

    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(
        `Invalid .env key ${key} in ${envFilePath}:${lineNumber}.`
      );
    }

    const rawValue = line.slice(separator + 1).trimStart();
    entries.push({
      key,
      value: parseEnvValue(rawValue, envFilePath, lineNumber),
      line: lineNumber,
    });
  });
  return entries;
}

function parseEnvValue(
  rawValue: string,
  envFilePath: string,
  lineNumber: number
): string {
  const quote = rawValue[0];
  if (quote === '"' || quote === "'") {
    return parseQuotedValue(rawValue, quote, envFilePath, lineNumber);
  }

  let value = rawValue;
  for (let index = 0; index < rawValue.length; index += 1) {
    if (
      rawValue[index] === '#' &&
      (index === 0 || /\s/.test(rawValue[index - 1] ?? ''))
    ) {
      value = rawValue.slice(0, index);
      break;
    }
  }
  return value.trimEnd();
}

function parseQuotedValue(
  rawValue: string,
  quote: '"' | "'",
  envFilePath: string,
  lineNumber: number
): string {
  let value = '';
  let escaped = false;
  for (let index = 1; index < rawValue.length; index += 1) {
    const character = rawValue[index];
    if (quote === '"' && escaped) {
      value += decodeDoubleQuotedEscape(character);
      escaped = false;
      continue;
    }
    if (quote === '"' && character === '\\') {
      escaped = true;
      continue;
    }
    if (character === quote) {
      const rest = rawValue.slice(index + 1).trim();
      if (rest.length > 0 && !rest.startsWith('#')) {
        throw new Error(
          `Unexpected content after quoted value in ${envFilePath}:${lineNumber}.`
        );
      }
      return value;
    }
    value += character;
  }

  throw new Error(`Unterminated quoted value in ${envFilePath}:${lineNumber}.`);
}

function decodeDoubleQuotedEscape(character: string): string {
  switch (character) {
    case 'n':
      return '\n';
    case 'r':
      return '\r';
    case 't':
      return '\t';
    default:
      return character;
  }
}

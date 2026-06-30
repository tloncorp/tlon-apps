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

export interface ComposeEnvOptions {
  projectName: string;
  explicitEnv: Record<string, string>;
  sourceEnv?: NodeJS.ProcessEnv;
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

import type { ExecResult, RuntimeContext } from '../drivers/types.js';
import { runCommand } from './compose.js';
import { buildComposeProcessEnv } from './env.js';

const DOCKER_TIMEOUT_MS = 60_000;

export type DockerCommandRunner = (
  command: string,
  args: string[],
  opts: {
    env: Record<string, string>;
    cwd: string;
    stream?: boolean;
    timeoutMs?: number;
  }
) => Promise<ExecResult>;

export interface DockerExecOptions {
  env?: Record<string, string>;
  timeoutMs?: number;
}

export async function resolveComposeContainer(
  ctx: RuntimeContext,
  service: string,
  run: DockerCommandRunner = runCommand
): Promise<string> {
  const result = await runDocker(
    ctx,
    [
      'container',
      'ls',
      '--all',
      '--quiet',
      '--filter',
      `label=com.docker.compose.project=${ctx.composeProjectName}`,
      '--filter',
      `label=com.docker.compose.service=${service}`,
    ],
    run
  );
  requireSuccess(result, `resolve service ${service}`);
  const containers = result.stdout
    .split(/\s+/)
    .map((container) => container.trim())
    .filter(Boolean);
  if (containers.length === 0) {
    throw new Error(
      `No Docker container found for compose project ${ctx.composeProjectName} ` +
        `service ${service}.`
    );
  }
  if (containers.length > 1) {
    throw new Error(
      `Expected one Docker container for compose project ${ctx.composeProjectName} ` +
        `service ${service}, found ${containers.length}: ${containers.join(', ')}.`
    );
  }
  return containers[0];
}

export async function stopComposeService(
  ctx: RuntimeContext,
  service: string,
  run: DockerCommandRunner = runCommand
): Promise<void> {
  const container = await resolveComposeContainer(ctx, service, run);
  const result = await runDocker(ctx, ['container', 'stop', container], run);
  requireSuccess(result, `stop service ${service}`);
  const state = await inspectContainer(ctx, container, run);
  if (state.Running) {
    throw new Error(`Docker service ${service} is still running after stop.`);
  }
}

export async function startComposeService(
  ctx: RuntimeContext,
  service: string,
  run: DockerCommandRunner = runCommand
): Promise<void> {
  const container = await resolveComposeContainer(ctx, service, run);
  const before = await inspectContainer(ctx, container, run);
  if (before.Running) {
    return;
  }
  const result = await runDocker(ctx, ['container', 'start', container], run);
  requireSuccess(result, `start service ${service}`);
  const after = await inspectContainer(ctx, container, run);
  if (!after.Running) {
    throw new Error(`Docker service ${service} is not running after start.`);
  }
  if (!after.StartedAt || after.StartedAt === before.StartedAt) {
    throw new Error(
      `Docker service ${service} did not report a new StartedAt after start.`
    );
  }
}

export async function restartComposeService(
  ctx: RuntimeContext,
  service: string,
  run: DockerCommandRunner = runCommand
): Promise<void> {
  await stopComposeService(ctx, service, run);
  await startComposeService(ctx, service, run);
}

export async function execInComposeService(
  ctx: RuntimeContext,
  service: string,
  argv: string[],
  opts: DockerExecOptions = {},
  run: DockerCommandRunner = runCommand
): Promise<ExecResult> {
  const container = await resolveComposeContainer(ctx, service, run);
  const envArgs = Object.entries(opts.env ?? {}).flatMap(([key, value]) => [
    '--env',
    `${key}=${value}`,
  ]);
  return runDocker(
    ctx,
    ['exec', ...envArgs, container, ...argv],
    run,
    opts.timeoutMs
  );
}

export async function disconnectComposeNetwork(
  ctx: RuntimeContext,
  service: string,
  run: DockerCommandRunner = runCommand
): Promise<void> {
  const container = await resolveComposeContainer(ctx, service, run);
  const result = await runDocker(
    ctx,
    ['network', 'disconnect', `${ctx.composeProjectName}_default`, container],
    run
  );
  requireSuccess(result, `disconnect network for service ${service}`);
}

export async function connectComposeNetwork(
  ctx: RuntimeContext,
  service: string,
  run: DockerCommandRunner = runCommand
): Promise<void> {
  const container = await resolveComposeContainer(ctx, service, run);
  const result = await runDocker(
    ctx,
    ['network', 'connect', `${ctx.composeProjectName}_default`, container],
    run
  );
  requireSuccess(result, `connect network for service ${service}`);
}

export async function readComposeServiceLogs(
  ctx: RuntimeContext,
  service: string,
  opts: { since: string },
  run: DockerCommandRunner = runCommand
): Promise<string> {
  const container = await resolveComposeContainer(ctx, service, run);
  const result = await runDocker(
    ctx,
    ['logs', '--since', opts.since, container],
    run
  );
  requireSuccess(result, `read logs for service ${service}`);
  return [result.stdout, result.stderr].filter(Boolean).join('\n');
}

interface DockerContainerState {
  Running: boolean;
  StartedAt: string;
}

async function inspectContainer(
  ctx: RuntimeContext,
  container: string,
  run: DockerCommandRunner
): Promise<DockerContainerState> {
  const result = await runDocker(
    ctx,
    ['container', 'inspect', '--format', '{{json .State}}', container],
    run
  );
  requireSuccess(result, `inspect container ${container}`);
  try {
    const state = JSON.parse(
      result.stdout.trim()
    ) as Partial<DockerContainerState>;
    if (
      typeof state.Running !== 'boolean' ||
      typeof state.StartedAt !== 'string'
    ) {
      throw new Error('missing State.Running or State.StartedAt');
    }
    return { Running: state.Running, StartedAt: state.StartedAt };
  } catch (error) {
    throw new Error(
      `Could not parse Docker state for container ${container}: ` +
        `${error instanceof Error ? error.message : String(error)}.`
    );
  }
}

function runDocker(
  ctx: RuntimeContext,
  args: string[],
  run: DockerCommandRunner,
  timeoutMs = DOCKER_TIMEOUT_MS
): Promise<ExecResult> {
  return run('docker', args, {
    cwd: ctx.packageDir,
    env: buildComposeProcessEnv({
      projectName: ctx.composeProjectName,
      explicitEnv: ctx.composeEnv,
    }),
    stream: false,
    timeoutMs,
  });
}

function requireSuccess(result: ExecResult, action: string): void {
  if (result.exitCode === 0) {
    return;
  }
  throw new Error(
    `docker ${action} failed with exit ${result.exitCode}: ` +
      `${(result.stderr || result.stdout).trim()}`
  );
}

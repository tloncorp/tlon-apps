import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { hermesDriver } from '../drivers/hermes.js';
import type { BotDriver, RuntimeSeed } from '../drivers/types.js';
import { runCommand } from '../runtime/compose.js';
import { createComposeHandle } from '../runtime/compose.js';
import { createRuntimeContext, runtimeContextForJson } from '../runtime/context.js';
import { buildComposeProcessEnv } from '../runtime/env.js';
import { allocateRuntimeEndpoints } from '../runtime/ports.js';
import { waitForHttpOk, waitForShipLogin } from '../runtime/waiters.js';

async function main(): Promise<void> {
  const driver = selectDriver(process.env.TLON_BOT_E2E_DRIVER);
  const repoRoot = path.resolve(process.env.TLON_BOT_E2E_REPO_ROOT ?? '../..');
  const runId = sanitizeRunId(
    process.env.TLON_BOT_E2E_RUN_ID ?? `${Date.now().toString(36)}-${randomId()}`
  );
  const endpoints = await allocateRuntimeEndpoints({
    fakeModel: parsePort(process.env.FAKE_MODEL_PORT),
    zod: parsePort(process.env.ZOD_PORT),
    ten: parsePort(process.env.TEN_PORT),
    mug: parsePort(process.env.MUG_PORT),
  });

  const seed: RuntimeSeed = {
    driverName: driver.name,
    repoRoot,
    runId,
    endpoints,
  };
  const ctx = createRuntimeContext(seed, driver.resolveRuntime(seed));
  const compose = createComposeHandle(ctx);
  const keepStack = flag(process.env.TLON_BOT_E2E_KEEP_STACK);

  logEndpointTable(ctx);

  let failed = false;
  try {
    await driver.beforeComposeBuild?.(ctx);
    await compose.down();
    await compose.build([ctx.services.bot]);
    await driver.beforeComposeUp?.(ctx, compose);
    await compose.up();
    await waitForBaseServices(ctx);
    await driver.waitReady(ctx, compose);
    await driver.assertRuntimeConfig?.(ctx, compose);
    await runVitest(ctx);
  } catch (error) {
    failed = true;
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    const diagnostics = await driver
      .collectDiagnostics?.(ctx, compose)
      .catch((diagError) => `diagnostic collection failed: ${diagError}`);
    if (diagnostics) {
      console.error('\n==> Runtime diagnostics\n');
      console.error(diagnostics);
    }
    process.exitCode = 1;
  } finally {
    if (!keepStack) {
      await compose.down();
      await driver.afterComposeDown?.(ctx);
    } else {
      console.error(
        `Keeping compose stack ${ctx.composeProjectName} because TLON_BOT_E2E_KEEP_STACK is set.`
      );
    }
    if (!failed) {
      console.log('Hermes shared E2E smoke completed.');
    }
  }
}

function selectDriver(raw: string | undefined): BotDriver {
  const name = raw || 'hermes';
  if (name === 'hermes') {
    return hermesDriver;
  }
  throw new Error(`Unsupported TLON_BOT_E2E_DRIVER for M2: ${name}`);
}

async function waitForBaseServices(ctx: ReturnType<typeof createRuntimeContext>) {
  await waitForHttpOk(`${ctx.endpoints.fakeModel.hostBaseUrl}/health`, {
    timeoutMs: 60_000,
    intervalMs: 1_000,
    description: 'fake-model /health',
  });
  for (const [label, endpoint] of Object.entries(ctx.endpoints.ships)) {
    await waitForShipLogin(endpoint.hostUrl, endpoint.code, {
      timeoutMs: 180_000,
      intervalMs: 3_000,
      description: `${label} fake ship login`,
    });
  }
}

async function runVitest(ctx: ReturnType<typeof createRuntimeContext>): Promise<void> {
  const contextDir = await mkdir(
    path.join(os.tmpdir(), `tlon-bot-e2e-${ctx.runId}`),
    { recursive: true }
  ).then(() => path.join(os.tmpdir(), `tlon-bot-e2e-${ctx.runId}`));
  const contextFile = path.join(contextDir, 'runtime-context.json');
  await writeFile(
    contextFile,
    JSON.stringify(runtimeContextForJson(ctx), null, 2),
    'utf8'
  );

  const env = buildComposeProcessEnv({
    projectName: ctx.composeProjectName,
    explicitEnv: {
      ...ctx.testEnv,
      TLON_BOT_E2E_RUNTIME_CONTEXT_FILE: contextFile,
    },
  });

  const result = await runCommand(
    'pnpm',
    [
      'exec',
      'vitest',
      'run',
      '--config',
      'vitest.e2e.config.ts',
      'src/scenarios/hermes-smoke.test.ts',
    ],
    { cwd: path.join(ctx.repoRoot, 'packages/tlon-bot-e2e'), env }
  );
  if (result.exitCode !== 0) {
    throw new Error(`Hermes smoke vitest failed with exit ${result.exitCode}`);
  }
}

function logEndpointTable(ctx: ReturnType<typeof createRuntimeContext>): void {
  console.log('==> Runtime endpoints');
  console.log(`    compose project: ${ctx.composeProjectName}`);
  console.log(
    `    fake-model: host=${ctx.endpoints.fakeModel.hostBaseUrl} container=${ctx.endpoints.fakeModel.containerBaseUrl}`
  );
  for (const [label, endpoint] of Object.entries(ctx.endpoints.ships)) {
    console.log(
      `    ${label}: ship=${endpoint.ship} host=${endpoint.hostUrl} container=${endpoint.containerUrl}`
    );
  }
}

function parsePort(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function sanitizeRunId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 32);
}

function flag(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(value ?? '');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});

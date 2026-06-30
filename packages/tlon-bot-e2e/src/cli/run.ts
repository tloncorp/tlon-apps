import { mkdir, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hermesDriver } from '../drivers/hermes.js';
import { openclawDriver } from '../drivers/openclaw.js';
import type { BotDriver, RuntimeContext, RuntimeSeed } from '../drivers/types.js';
import { runCommand } from '../runtime/compose.js';
import { createComposeHandle } from '../runtime/compose.js';
import { createRuntimeContext, runtimeContextForJson } from '../runtime/context.js';
import {
  buildComposeProcessEnv,
  loadTlonBotE2eEnvFile,
} from '../runtime/env.js';
import { allocatePort, allocateRuntimeEndpoints } from '../runtime/ports.js';
import { waitForHttpOk, waitForShipLogin } from '../runtime/waiters.js';

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

async function main(): Promise<void> {
  await loadPackageEnv();
  const driver = selectDriver(process.env.TLON_BOT_E2E_DRIVER);
  const repoRoot = path.resolve(
    process.env.TLON_BOT_E2E_REPO_ROOT ?? path.join(packageDir, '../..')
  );
  const runId = sanitizeRunId(
    process.env.TLON_BOT_E2E_RUN_ID ?? `${Date.now().toString(36)}-${randomId()}`
  );
  const endpoints = await allocateRuntimeEndpoints({
    fakeModel: parsePort(process.env.FAKE_MODEL_PORT),
    zod: parsePort(process.env.ZOD_PORT),
    ten: parsePort(process.env.TEN_PORT),
    mug: parsePort(process.env.MUG_PORT),
    ...(driver.name === 'openclaw'
      ? {
          gateway:
            parsePort(process.env.OPENCLAW_GATEWAY_PORT) ??
            (await allocatePort()),
        }
      : {}),
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
    await runDriverTests(ctx, process.argv.slice(2));
    if (flag(process.env.DUMP_LOGS)) {
      const diagnostics = await driver.collectDiagnostics?.(ctx, compose);
      if (diagnostics) {
        console.error('\n==> Runtime diagnostics\n');
        console.error(diagnostics);
      }
    }
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
      console.log(`${driver.name} shared E2E completed.`);
    }
  }
}

async function loadPackageEnv(): Promise<void> {
  const envFilePath = path.resolve(
    process.env.TLON_BOT_E2E_ENV_FILE ?? path.join(packageDir, '.env')
  );
  const result = await loadTlonBotE2eEnvFile({ envFilePath });
  if (!result) {
    return;
  }

  const displayPath = path.relative(process.cwd(), result.envFilePath);
  const loadedCount = result.loaded.length;
  const skippedCount = result.skipped.length;
  console.log(
    `Loaded tlon-bot-e2e env from ${displayPath || result.envFilePath} ` +
      `(${loadedCount} loaded, ${skippedCount} shell override).`
  );
}

function selectDriver(raw: string | undefined): BotDriver {
  const name = raw || 'hermes';
  if (name === 'hermes') {
    return hermesDriver;
  }
  if (name === 'openclaw') {
    return openclawDriver;
  }
  throw new Error(`Unsupported TLON_BOT_E2E_DRIVER: ${name}`);
}

async function waitForBaseServices(ctx: RuntimeContext) {
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

async function runDriverTests(
  ctx: RuntimeContext,
  rawArgs: string[]
): Promise<void> {
  if (ctx.driverName === 'openclaw') {
    await runOpenClawVitestFiles(ctx, rawArgs);
    return;
  }
  await runHermesSmoke(ctx);
}

async function writeRuntimeContextFile(ctx: RuntimeContext): Promise<string> {
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
  return contextFile;
}

async function runHermesSmoke(ctx: RuntimeContext): Promise<void> {
  const contextFile = await writeRuntimeContextFile(ctx);

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

async function runOpenClawVitestFiles(
  ctx: RuntimeContext,
  rawArgs: string[]
): Promise<void> {
  const contextFile = await writeRuntimeContextFile(ctx);
  const testFiles = await resolveOpenClawTestFiles(ctx, rawArgs);
  const env = buildComposeProcessEnv({
    projectName: ctx.composeProjectName,
    explicitEnv: {
      ...ctx.composeEnv,
      ...ctx.testEnv,
      TLON_BOT_E2E_RUNTIME_CONTEXT_FILE: contextFile,
      TEST_COMPOSE_FILE: ctx.composeFiles[0] ?? '',
      TEST_COMPOSE_FILES: JSON.stringify(ctx.composeFiles),
      TEST_COMPOSE_PROJECT_NAME: ctx.composeProjectName,
    },
  });

  console.log('');
  console.log('==> Running OpenClaw integration tests...');
  console.log('');
  console.log('Env vars:');
  console.log(`  TLON_URL=${ctx.testEnv.TLON_URL}`);
  console.log(`  TLON_SHIP=${ctx.testEnv.TLON_SHIP}`);
  console.log(`  TEST_USER_SHIP=${ctx.testEnv.TEST_USER_SHIP}`);
  console.log('');

  const timings: string[] = [];
  const suiteStart = Date.now();
  let testExit = 0;

  for (const testFile of testFiles) {
    const start = Date.now();
    console.log(`Running ${testFile}...`);
    const result = await runCommand(
      'pnpm',
      ['exec', 'vitest', 'run', '--config', 'vitest.integration.config.ts', testFile],
      { cwd: ctx.packageDir, env }
    );
    if (result.exitCode !== 0) {
      testExit = result.exitCode;
    }
    const elapsed = Math.round((Date.now() - start) / 1000);
    timings.push(`${String(elapsed).padStart(4, ' ')}s  ${testFile}`);
    console.log(`==> ${testFile} finished in ${elapsed}s`);
    if (testExit >= 128) {
      console.log(
        `==> Test runner killed by signal (exit ${testExit}), stopping suite.`
      );
      break;
    }
  }

  const suiteTotal = Math.round((Date.now() - suiteStart) / 1000);
  console.log('');
  console.log('==> Suite timing');
  for (const line of timings) {
    console.log(`    ${line}`);
  }
  console.log(`    ----`);
  console.log(
    `    ${String(suiteTotal).padStart(4, ' ')}s  total (test execution wall time)`
  );
  console.log('');

  if (testExit !== 0) {
    throw new Error(`OpenClaw integration tests failed with exit ${testExit}`);
  }
}

async function resolveOpenClawTestFiles(
  ctx: RuntimeContext,
  rawArgs: string[]
): Promise<string[]> {
  const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
  if (args.length > 0) {
    return args;
  }

  const casesDir = path.join(ctx.packageDir, 'test/cases');
  const entries = await readdir(casesDir);
  const testFiles = entries
    .filter((entry) => entry.endsWith('.test.ts'))
    .sort()
    .map((entry) => path.join('test/cases', entry));
  if (testFiles.length === 0) {
    throw new Error(`No OpenClaw integration test files found in ${casesDir}`);
  }
  return testFiles;
}

function logEndpointTable(ctx: RuntimeContext): void {
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
  if (ctx.endpoints.gateway) {
    console.log(`    gateway: host=${ctx.endpoints.gateway.hostBaseUrl}`);
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

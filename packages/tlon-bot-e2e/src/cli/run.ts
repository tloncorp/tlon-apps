import { chmod, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hermesDriver } from '../drivers/hermes.js';
import { openclawDriver } from '../drivers/openclaw.js';
import type {
  BotDriver,
  RuntimeContext,
  RuntimeSeed,
} from '../drivers/types.js';
import { runCommand } from '../runtime/compose.js';
import { createComposeHandle } from '../runtime/compose.js';
import {
  createRuntimeContext,
  runtimeContextForJson,
} from '../runtime/context.js';
import { collectRuntimeDiagnostics } from '../runtime/diagnostics.js';
import { loadTlonBotE2eEnvFile } from '../runtime/env.js';
import {
  type RuntimePortOverrides,
  allocatePort,
  allocateRuntimeEndpoints,
  assertRequestedPortsAvailable,
  requestedRuntimeEndpointPorts,
} from '../runtime/ports.js';
import { randomId } from '../runtime/util.js';
import { waitForHttpOk, waitForShipLogin } from '../runtime/waiters.js';
import { commonScenarios } from '../scenarios/shared/common.js';
import {
  type ScenarioPartition,
  selectScenarioPartitions,
} from '../scenarios/shared/dsl.js';
import {
  buildCommonScenarioEnv,
  buildHermesSmokeEnv,
  buildOpenClawPackageTestEnv,
} from './test-env.js';

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
  const baseRunId = sanitizeRunId(
    process.env.TLON_BOT_E2E_RUN_ID ??
      `${Date.now().toString(36)}-${randomId()}`
  );
  const suite = parseSuiteRequest(process.argv.slice(2));
  const keepStack = flag(process.env.TLON_BOT_E2E_KEEP_STACK);

  if (suite.kind === 'common' || suite.kind === 'all') {
    const partitions = selectScenarioPartitions(commonScenarios, {
      requested: process.env.TLON_BOT_E2E_SCENARIO_PARTITIONS,
      driverName: driver.name,
    });
    for (const partition of partitions) {
      await runDriverRuntime({
        driver,
        repoRoot,
        runId: runIdWithSuffix(baseRunId, partition.key),
        keepStack,
        partition,
        runTests: async (ctx) => runCommonScenarioPartition(ctx, partition),
      });
    }
  }

  if (suite.kind === 'package' || suite.kind === 'all') {
    await runDriverRuntime({
      driver,
      repoRoot,
      runId: runIdWithSuffix(baseRunId, 'package'),
      keepStack,
      runTests: async (ctx) => runPackageSpecificTests(ctx, suite.args),
    });
  }

  console.log(`${driver.name} shared E2E completed (${suite.kind}).`);
}

async function runDriverRuntime(args: {
  driver: BotDriver;
  repoRoot: string;
  runId: string;
  keepStack: boolean;
  partition?: ScenarioPartition;
  runTests(ctx: RuntimeContext): Promise<void>;
}): Promise<void> {
  const fixedPorts = fixedRuntimePortsForDriver(args.driver.name, process.env);
  const endpointPorts: RuntimePortOverrides = {
    ...fixedPorts,
    ...(args.driver.name === 'openclaw'
      ? {
          gateway: fixedPorts.gateway ?? (await allocatePort()),
        }
      : {}),
  };
  const endpoints = await allocateRuntimeEndpoints(endpointPorts);

  const seed: RuntimeSeed = {
    driverName: args.driver.name,
    repoRoot: args.repoRoot,
    runId: args.runId,
    endpoints,
    ...(args.partition
      ? {
          capabilityPartition: {
            key: args.partition.key,
            capabilities: args.partition.capabilities,
          },
        }
      : {}),
  };
  const ctx = createRuntimeContext(seed, args.driver.resolveRuntime(seed));
  const compose = createComposeHandle(ctx);

  logEndpointTable(ctx);
  if (args.partition) {
    console.log(
      `    scenario partition: ${args.partition.key} ` +
        `capabilities=${JSON.stringify(args.partition.capabilities)}`
    );
  }

  try {
    await compose.down();
    await assertRequestedPortsAvailable(
      requestedRuntimeEndpointPorts(ctx.endpoints)
    );
    await args.driver.beforeComposeBuild?.(ctx);
    await compose.build([ctx.services.bot]);
    await args.driver.beforeComposeUp?.(ctx, compose);
    await compose.up();
    await waitForBaseServices(ctx);
    await args.driver.waitReady(ctx, compose);
    await args.driver.assertRuntimeConfig?.(ctx, compose);
    await args.runTests(ctx);
    if (flag(process.env.DUMP_LOGS)) {
      const diagnostics = await collectDiagnostics(ctx, compose, args.driver);
      if (diagnostics) {
        console.error('\n==> Runtime diagnostics\n');
        console.error(diagnostics);
      }
    }
  } catch (error) {
    const diagnostics = await collectDiagnostics(
      ctx,
      compose,
      args.driver
    ).catch((diagError) => `diagnostic collection failed: ${diagError}`);
    if (diagnostics) {
      console.error('\n==> Runtime diagnostics\n');
      console.error(diagnostics);
    }
    throw error;
  } finally {
    if (!args.keepStack) {
      await compose.down();
      await args.driver.afterComposeDown?.(ctx);
    } else {
      console.error(
        `Keeping compose stack ${ctx.composeProjectName} because TLON_BOT_E2E_KEEP_STACK is set.`
      );
    }
  }
}

async function collectDiagnostics(
  ctx: RuntimeContext,
  compose: ReturnType<typeof createComposeHandle>,
  driver: BotDriver
): Promise<string> {
  const shared = await collectRuntimeDiagnostics(ctx, compose);
  const driverDiagnostics = await driver.collectDiagnostics?.(ctx, compose);
  if (!driverDiagnostics?.trim()) {
    return shared;
  }
  return [shared, `== driver diagnostics ==\n${driverDiagnostics.trim()}`].join(
    '\n\n'
  );
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

async function runPackageSpecificTests(
  ctx: RuntimeContext,
  rawArgs: string[]
): Promise<void> {
  if (ctx.driverName === 'openclaw') {
    await runOpenClawVitestFiles(ctx, rawArgs);
    return;
  }
  await runHermesSmoke(ctx);
}

interface RuntimeContextFile {
  contextDir: string;
  contextFile: string;
}

async function writeRuntimeContextFile(
  ctx: RuntimeContext
): Promise<RuntimeContextFile> {
  const contextDir = await mkdtemp(
    path.join(os.tmpdir(), `tlon-bot-e2e-${ctx.runId}-`)
  );
  await chmod(contextDir, 0o700);
  const contextFile = path.join(contextDir, 'runtime-context.json');
  await writeFile(
    contextFile,
    JSON.stringify(runtimeContextForJson(ctx), null, 2),
    { encoding: 'utf8', mode: 0o600 }
  );
  return { contextDir, contextFile };
}

async function withRuntimeContextFile<T>(
  ctx: RuntimeContext,
  fn: (contextFile: string) => Promise<T>
): Promise<T> {
  const { contextDir, contextFile } = await writeRuntimeContextFile(ctx);
  try {
    return await fn(contextFile);
  } finally {
    await rm(contextDir, { recursive: true, force: true });
  }
}

async function runHermesSmoke(ctx: RuntimeContext): Promise<void> {
  const env = buildHermesSmokeEnv(ctx);

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

async function runCommonScenarioPartition(
  ctx: RuntimeContext,
  partition: ScenarioPartition
): Promise<void> {
  console.log('');
  console.log(
    `==> Running common ${ctx.driverName} scenarios (${partition.key})...`
  );
  console.log('');

  const result = await withRuntimeContextFile(ctx, async (contextFile) => {
    const env = buildCommonScenarioEnv(ctx, contextFile, partition);
    return runCommand(
      'pnpm',
      [
        'exec',
        'vitest',
        'run',
        '--config',
        'vitest.e2e.config.ts',
        'src/scenarios/common.test.ts',
      ],
      { cwd: path.join(ctx.repoRoot, 'packages/tlon-bot-e2e'), env }
    );
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `Common scenario vitest failed with exit ${result.exitCode}`
    );
  }
}

async function runOpenClawVitestFiles(
  ctx: RuntimeContext,
  rawArgs: string[]
): Promise<void> {
  const testFiles = await resolveOpenClawTestFiles(ctx, rawArgs);
  const env = buildOpenClawPackageTestEnv(ctx);

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
      [
        'exec',
        'vitest',
        'run',
        '--config',
        'vitest.integration.config.ts',
        testFile,
      ],
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

function fixedRuntimePortsForDriver(
  driverName: BotDriver['name'],
  env: NodeJS.ProcessEnv
): RuntimePortOverrides {
  return {
    fakeModel: parsePort(env.FAKE_MODEL_PORT),
    zod: parsePort(env.ZOD_PORT),
    ten: parsePort(env.TEN_PORT),
    mug: parsePort(env.MUG_PORT),
    ...(driverName === 'openclaw'
      ? { gateway: parsePort(env.OPENCLAW_GATEWAY_PORT) }
      : {}),
  };
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

function sanitizeRunId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 32);
}

type SuiteKind = 'common' | 'package' | 'all';

interface SuiteRequest {
  kind: SuiteKind;
  args: string[];
}

function parseSuiteRequest(rawArgs: string[]): SuiteRequest {
  const args = rawArgs[0] === '--' ? rawArgs.slice(1) : [...rawArgs];
  let kind = parseSuiteKind(process.env.TLON_BOT_E2E_SUITE ?? 'common');
  const first = args[0];
  if (first === '--common' || first === '--package' || first === '--all') {
    kind = parseSuiteKind(first.slice(2));
    args.shift();
    if (args[0] === '--') {
      args.shift();
    }
  }
  return { kind, args };
}

function parseSuiteKind(raw: string): SuiteKind {
  if (raw === 'common' || raw === 'package' || raw === 'all') {
    return raw;
  }
  throw new Error(`Unsupported TLON_BOT_E2E_SUITE: ${raw}`);
}

function runIdWithSuffix(baseRunId: string, suffix: string): string {
  return sanitizeRunId(`${baseRunId}-${suffix}`);
}

function flag(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(value ?? '');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});

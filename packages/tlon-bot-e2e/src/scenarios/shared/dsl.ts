import type {
  BotDriver,
  RuntimeCapability,
  RuntimeContext,
} from '../../drivers/types.js';
import type { ScenarioActors } from './actors.js';

export type ScenarioCapability = RuntimeCapability;

export interface ScenarioMetadata {
  capabilities?: readonly ScenarioCapability[];
  orderDependent?: boolean;
  drivers?: readonly BotDriver['name'][];
}

export interface ScenarioRunContext {
  ctx: RuntimeContext;
  driver: BotDriver;
  actors: ScenarioActors;
}

export interface SharedScenario {
  id: string;
  name: string;
  capabilities: readonly ScenarioCapability[];
  orderDependent: boolean;
  drivers?: readonly BotDriver['name'][];
  run(runCtx: ScenarioRunContext): Promise<void>;
}

export interface ScenarioPartition {
  key: string;
  capabilities: readonly ScenarioCapability[];
  scenarios: readonly SharedScenario[];
}

export interface SelectScenarioPartitionOptions {
  requested?: string | readonly string[];
  driverName?: BotDriver['name'];
}

export function testScenario(
  id: string,
  metadata: ScenarioMetadata,
  run: (runCtx: ScenarioRunContext) => Promise<void>
): SharedScenario {
  if (!/^[a-z0-9][a-z0-9_.:-]*$/i.test(id)) {
    throw new Error(`Invalid scenario id: ${id}`);
  }
  return {
    id,
    name: id.replace(/[-_.:]+/g, ' '),
    capabilities: normalizeCapabilities(metadata.capabilities ?? []),
    orderDependent: metadata.orderDependent ?? false,
    drivers: metadata.drivers,
    run,
  };
}

export function partitionScenarios(
  scenarios: readonly SharedScenario[]
): ScenarioPartition[] {
  const byKey = new Map<string, SharedScenario[]>();
  const capabilityByKey = new Map<string, readonly ScenarioCapability[]>();
  for (const scenario of scenarios) {
    const capabilities = normalizeCapabilities(scenario.capabilities);
    const key = partitionKey(capabilities);
    const existing = byKey.get(key) ?? [];
    existing.push(scenario);
    byKey.set(key, existing);
    capabilityByKey.set(key, capabilities);
  }

  return [...byKey.entries()]
    .map(([key, partitionScenarios]) => ({
      key,
      capabilities: capabilityByKey.get(key) ?? [],
      scenarios: partitionScenarios,
    }))
    .sort((a, b) => partitionSortKey(a).localeCompare(partitionSortKey(b)));
}

export function selectScenarioPartitions(
  scenarios: readonly SharedScenario[],
  opts: SelectScenarioPartitionOptions = {}
): ScenarioPartition[] {
  const allPartitions = partitionScenarios(scenarios);
  const partitions = partitionScenarios(
    opts.driverName
      ? scenarios.filter((scenario) => scenarioMatchesDriver(scenario, opts.driverName))
      : scenarios
  );
  const requested = parseRequestedPartitions(opts.requested);
  if (requested === 'all') {
    return partitions;
  }
  const selected = partitions.filter((partition) => requested.has(partition.key));
  const missing = [...requested].filter(
    (key) => !allPartitions.some((partition) => partition.key === key)
  );
  if (missing.length > 0) {
    throw new Error(
      `Unknown scenario partition(s): ${missing.join(', ')}. ` +
        `Available: ${allPartitions.map((partition) => partition.key).join(', ')}`
    );
  }

  const unavailableForDriver = [...requested].filter(
    (key) => !selected.some((partition) => partition.key === key)
  );
  if (unavailableForDriver.length > 0) {
    throw new Error(
      `No scenarios selected for driver=${opts.driverName ?? 'all'} ` +
        `partition(s): ${unavailableForDriver.join(', ')}. ` +
        `Available: ${partitions.map((partition) => partition.key).join(', ')}`
    );
  }
  return selected;
}

export function scenariosForPartition(
  scenarios: readonly SharedScenario[],
  partitionKeyValue: string,
  driverName?: BotDriver['name']
): SharedScenario[] {
  return scenarios.filter((scenario) => {
    if (partitionKey(scenario.capabilities) !== partitionKeyValue) {
      return false;
    }
    return scenarioMatchesDriver(scenario, driverName);
  });
}

export function partitionKey(
  capabilities: readonly ScenarioCapability[]
): string {
  const normalized = normalizeCapabilities(capabilities);
  return normalized.length === 0 ? 'baseline' : normalized.join('+');
}

export function normalizeCapabilities(
  capabilities: readonly ScenarioCapability[]
): readonly ScenarioCapability[] {
  return [...new Set(capabilities)].sort();
}

function parseRequestedPartitions(
  requested: string | readonly string[] | undefined
): 'all' | Set<string> {
  if (requested === undefined || requested === '') {
    return new Set(['baseline']);
  }
  const raw =
    typeof requested === 'string' ? requested.split(',') : [...requested];
  const keys = raw.map((key: string) => key.trim()).filter(Boolean);
  if (keys.includes('all')) {
    return 'all';
  }
  return new Set(keys.length > 0 ? keys : ['baseline']);
}

function scenarioMatchesDriver(
  scenario: SharedScenario,
  driverName?: BotDriver['name']
): boolean {
  return !driverName || !scenario.drivers || scenario.drivers.includes(driverName);
}

function partitionSortKey(partition: ScenarioPartition): string {
  return partition.key === 'baseline' ? '' : partition.key;
}

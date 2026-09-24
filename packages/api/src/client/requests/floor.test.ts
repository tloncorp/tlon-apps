import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

import {
  MIN_GROUPS_VERSION,
  isVersionBelow,
  parseVersion,
} from '../../lib/deskVersion';
import { REGISTRY } from './index';
import type { Entry } from './types';

// The N-1 check. Every declared request must be served by the oldest %groups
// desk the client supports; nothing is credited for a fallback.

const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));

// Agents that do not ship in the %groups desk, and the desk that owns each:
// hood is in %base (urbit/urbit 408k-rc2, pkg/arvo/desk.bill); docket,
// settings, storage and vitals are in %landscape (tloncorp/landscape 5193635,
// desk/desk.bill). Both revs are the ones peru.yaml pins.
const EXTERNAL_AGENTS: Record<string, 'base' | 'landscape'> = {
  hood: 'base',
  docket: 'landscape',
  settings: 'landscape',
  storage: 'landscape',
  vitals: 'landscape',
};

const STRICT_VERSION = /^\d+\.\d+\.\d+$/;

interface Scope {
  excludedModules: string[];
  excludedHttpPrefixes: string[];
  excludedAgentPaths: { agent: string; prefix: string }[];
}

function describeEntry(name: string, e: Entry) {
  const target =
    e.kind === 'poke'
      ? e.mark
      : e.kind === 'thread'
        ? `${e.name} ${e.inputMark}->${e.outputMark}`
        : e.kind === 'http'
          ? `${e.method} ${e.path}`
          : e.path;
  return `${name} (${e.agent} ${e.kind} ${target} since ${e.since})`;
}

function identity(e: Entry) {
  switch (e.kind) {
    case 'http':
      return `http ${e.method} ${e.path}`;
    case 'thread':
      return `thread ${e.agent} ${e.name} ${e.inputMark} ${e.outputMark} ${e.desk ?? ''}`;
    case 'poke':
      return `poke ${e.agent} ${e.mark}`;
    default:
      return `${e.kind} ${e.agent} ${e.path}`;
  }
}

function moduleExists(modulePath: string) {
  return ['.ts', '.tsx', '/index.ts'].some((suffix) =>
    existsSync(`${REPO_ROOT}${modulePath}${suffix}`)
  );
}

export function checkRegistry(
  registry: Record<string, Record<string, Entry>>,
  floor: string,
  scope: Scope
): string[] {
  const failures: string[] = [];
  if (!STRICT_VERSION.test(floor) || parseVersion(floor) === null) {
    failures.push(`MIN_GROUPS_VERSION ${floor} is not a version`);
    return failures;
  }
  const seen = new Map<string, string>();
  for (const [group, entries] of Object.entries(registry)) {
    for (const [key, entry] of Object.entries(entries)) {
      const name = `${group}.${key}`;
      const label = describeEntry(name, entry);

      if (
        !STRICT_VERSION.test(entry.since) ||
        parseVersion(entry.since) === null
      ) {
        failures.push(`${label}: since is not a version`);
        continue;
      }

      const owner = EXTERNAL_AGENTS[entry.agent];
      let exempt = false;
      if (entry.desk !== undefined) {
        if (entry.kind === 'http') {
          failures.push(
            `${label}: an http route cannot carry a desk exemption`
          );
        } else if (owner !== entry.desk) {
          failures.push(
            `${label}: ${entry.agent} is not an agent of %${entry.desk}`
          );
        } else {
          exempt = true;
        }
      } else if (owner !== undefined && entry.kind !== 'http') {
        failures.push(`${label}: ${entry.agent} lives in %${owner}; say so`);
      }

      if (!exempt && isVersionBelow(floor, entry.since)) {
        failures.push(
          `${label}: since is above MIN_GROUPS_VERSION ${floor}, so the N-1 desk does not serve it`
        );
      }

      const id = identity(entry);
      const previous = seen.get(id);
      if (previous) {
        failures.push(`${label}: same request as ${previous}`);
      } else {
        seen.set(id, name);
      }

      if (
        entry.kind === 'http' &&
        scope.excludedHttpPrefixes.some((p) => entry.path.startsWith(p))
      ) {
        failures.push(`${label}: route is excluded by desk-request-scope.json`);
      }
      if (
        entry.kind !== 'http' &&
        entry.kind !== 'poke' &&
        entry.kind !== 'thread' &&
        scope.excludedAgentPaths.some(
          (x) => x.agent === entry.agent && entry.path.startsWith(x.prefix)
        )
      ) {
        failures.push(`${label}: path is excluded by desk-request-scope.json`);
      }
    }
  }
  for (const modulePath of scope.excludedModules) {
    if (!moduleExists(modulePath)) {
      failures.push(`excluded module ${modulePath} does not exist`);
    }
  }
  return failures;
}

const scope: Scope = JSON.parse(
  readFileSync(`${REPO_ROOT}oxlint/desk-request-scope.json`, 'utf8')
);

test('every registry entry is served by the N-1 desk', () => {
  expect(checkRegistry(REGISTRY, MIN_GROUPS_VERSION, scope)).toEqual([]);
});

describe('the check fails closed', () => {
  const entry = (e: Record<string, unknown>) => e as unknown as Entry;
  const run = (entries: Record<string, Entry>) =>
    checkRegistry({ t: entries }, '12.2.0', scope);

  test('a since above the floor', () => {
    expect(
      run({
        a: entry({
          kind: 'scry',
          agent: 'groups',
          path: '/x',
          since: '12.3.0',
        }),
      })
    ).toEqual([
      't.a (groups scry /x since 12.3.0): since is above MIN_GROUPS_VERSION 12.2.0, so the N-1 desk does not serve it',
    ]);
  });

  test.each(['13.0.1e0', '12.2', '12.2.0-rc1', ' 12.2.0', 'x'])(
    'a malformed since %j',
    (since) => {
      expect(
        run({ a: entry({ kind: 'scry', agent: 'groups', path: '/x', since }) })
      ).toEqual([
        `t.a (groups scry /x since ${since}): since is not a version`,
      ]);
    }
  );

  test('a malformed floor', () => {
    expect(checkRegistry({}, '12.2.0.1', scope)).toEqual([
      'MIN_GROUPS_VERSION 12.2.0.1 is not a version',
    ]);
  });

  test('a %groups agent labelled as another desk', () => {
    expect(
      run({
        a: entry({
          kind: 'scry',
          agent: 'groups',
          path: '/x',
          since: '12.2.0',
          desk: 'base',
        }),
      })
    ).toEqual([
      't.a (groups scry /x since 12.2.0): groups is not an agent of %base',
    ]);
  });

  test('an external agent with the wrong desk, or none', () => {
    expect(
      run({
        a: entry({
          kind: 'scry',
          agent: 'hood',
          path: '/x',
          since: '12.2.0',
          desk: 'landscape',
        }),
        b: entry({ kind: 'poke', agent: 'docket', mark: 'm', since: '12.2.0' }),
      })
    ).toEqual([
      't.a (hood scry /x since 12.2.0): hood is not an agent of %landscape',
      't.b (docket poke m since 12.2.0): docket lives in %landscape; say so',
    ]);
  });

  test('an honest external label exempts the entry from the floor', () => {
    expect(
      run({
        a: entry({
          kind: 'scry',
          agent: 'hood',
          path: '/kiln/x',
          since: '99.0.0',
          desk: 'base',
        }),
      })
    ).toEqual([]);
  });

  test('an http route cannot borrow an external agent label', () => {
    expect(
      run({
        a: entry({
          kind: 'http',
          agent: 'hood',
          desk: 'base',
          method: 'GET',
          path: '/notes/~/v99/notebooks',
          since: '99.0.0',
        }),
      })
    ).toEqual([
      't.a (hood http GET /notes/~/v99/notebooks since 99.0.0): an http route cannot carry a desk exemption',
      't.a (hood http GET /notes/~/v99/notebooks since 99.0.0): since is above MIN_GROUPS_VERSION 12.2.0, so the N-1 desk does not serve it',
    ]);
  });

  test('duplicate identity within a kind', () => {
    expect(
      run({
        a: entry({
          kind: 'scry',
          agent: 'groups',
          path: '/x',
          since: '12.2.0',
        }),
        b: entry({
          kind: 'scry',
          agent: 'groups',
          path: '/x',
          since: '12.2.0',
        }),
        c: entry({
          kind: 'subscribe',
          agent: 'groups',
          path: '/x',
          since: '12.2.0',
        }),
        d: entry({
          kind: 'http',
          agent: 'notes',
          method: 'GET',
          path: '/n',
          since: '12.2.0',
        }),
        e: entry({
          kind: 'http',
          agent: 'notes',
          method: 'POST',
          path: '/n',
          since: '12.2.0',
        }),
        f: entry({
          kind: 'http',
          agent: 'other',
          method: 'GET',
          path: '/n',
          since: '12.2.0',
        }),
      })
    ).toEqual([
      't.b (groups scry /x since 12.2.0): same request as t.a',
      't.f (other http GET /n since 12.2.0): same request as t.d',
    ]);
  });

  test('bot-only routes stay out of the registry', () => {
    expect(
      run({
        a: entry({
          kind: 'http',
          agent: 'steward',
          method: 'GET',
          path: '/steward/~/v1/automation/tasks',
          since: '12.2.0',
        }),
        b: entry({
          kind: 'subscribe',
          agent: 'steward',
          path: '/v1/automation/tasks',
          since: '12.2.0',
        }),
      })
    ).toEqual([
      't.a (steward http GET /steward/~/v1/automation/tasks since 12.2.0): route is excluded by desk-request-scope.json',
      't.b (steward subscribe /v1/automation/tasks since 12.2.0): path is excluded by desk-request-scope.json',
    ]);
  });

  test('an excluded module that no longer exists', () => {
    expect(
      checkRegistry({}, '12.2.0', {
        ...scope,
        excludedModules: ['packages/api/src/client/gone'],
      })
    ).toEqual(['excluded module packages/api/src/client/gone does not exist']);
  });
});

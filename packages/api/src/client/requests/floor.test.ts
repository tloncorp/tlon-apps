import { existsSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

import {
  MIN_GROUPS_VERSION,
  isVersionBelow,
  parseVersion,
} from '../../lib/deskVersion';
import { REGISTRY } from './index';
import { GUARDS, type Entry } from './types';

// The N-1 check. Every declared request must be served by the oldest %groups
// desk the client supports; nothing is credited for a fallback except a
// declared guard.

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
        : e.kind === 'http' || e.kind === 'raw'
          ? `${e.method} ${e.path}`
          : e.path;
  return `${name} (${e.agent} ${e.kind} ${target} since ${e.since})`;
}

// Hole names are labels, not routing: /{flag} and /{groupId} are one path.
const shape = (path: string) => path.replace(/\{[^}]*\}/g, '{}');

function identity(e: Entry) {
  switch (e.kind) {
    case 'http':
    case 'raw':
      // Both transports reach the same eyre route.
      return `route ${e.method} ${shape(e.path)}`;
    case 'thread':
      return `thread ${e.agent} ${e.name} ${e.inputMark} ${e.outputMark} ${e.desk ?? ''}`;
    case 'poke':
      return `poke ${e.agent} ${e.mark}`;
    default:
      return `${e.kind} ${e.agent} ${shape(e.path)}`;
  }
}

// A path can reach a protected prefix if it starts with it, or if a hole
// appears before the prefix's last character, since the hole could be
// filled to match the rest.
function mayReach(template: string, prefix: string) {
  // Compare the pathname the URL parser will route: no query or fragment,
  // dot segments resolved.
  // %2e is a dot to the URL parser, so decode it before resolving segments.
  const path = posix.normalize(template.split(/[?#]/)[0].replace(/%2e/gi, '.'));
  const hole = path.indexOf('{');
  if (hole === -1) {
    return path === prefix || path.startsWith(`${prefix}/`);
  }
  const literal = path.slice(0, hole);
  return literal.startsWith(prefix) || prefix.startsWith(literal);
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
        if (entry.kind === 'http' || entry.kind === 'raw') {
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
      } else if (
        owner !== undefined &&
        entry.kind !== 'http' &&
        entry.kind !== 'raw'
      ) {
        failures.push(`${label}: ${entry.agent} lives in %${owner}; say so`);
      }

      const guard = entry.guardedBy;
      const guarded = guard !== undefined;
      if (guarded && !Object.hasOwn(GUARDS, guard)) {
        failures.push(`${label}: guardedBy ${guard} names no guard`);
      } else if (guarded && exempt) {
        failures.push(
          `${label}: guardedBy ${guard} on a %${entry.desk} entry; external desks take no guard`
        );
      } else if (guarded && !isVersionBelow(floor, entry.since)) {
        failures.push(
          `${label}: guardedBy ${guard}, but the N-1 desk serves it; drop the guard`
        );
      }

      if (!exempt && !guarded && isVersionBelow(floor, entry.since)) {
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
        (entry.kind === 'http' || entry.kind === 'raw') &&
        scope.excludedHttpPrefixes.some((p) => mayReach(entry.path, p))
      ) {
        failures.push(
          `${label}: route can reach a prefix excluded by desk-request-scope.json`
        );
      }
      if (
        (entry.kind === 'scry' || entry.kind === 'subscribe') &&
        scope.excludedAgentPaths.some(
          (x) => x.agent === entry.agent && mayReach(entry.path, x.prefix)
        )
      ) {
        failures.push(
          `${label}: path can reach a prefix excluded by desk-request-scope.json`
        );
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
  const fails = (e: Record<string, unknown>) =>
    checkRegistry(
      { t: { a: { since: '12.2.0', ...e } as unknown as Entry } },
      '12.2.0',
      scope
    );
  const scry = (path: string, extra = {}) => ({
    kind: 'scry',
    agent: 'steward',
    path,
    ...extra,
  });
  const get = (path: string, extra = {}) => ({
    kind: 'http',
    agent: 'notes',
    method: 'GET',
    path,
    ...extra,
  });

  test.each([
    [
      'a since above the floor',
      scry('/x', { since: '12.3.0' }),
      'since is above MIN_GROUPS_VERSION',
    ],
    [
      'a guard on a request N-1 serves',
      scry('/x', { guardedBy: 'deskSupportsBuckets' }),
      'the N-1 desk serves it',
    ],
    [
      'a guard on a request below the floor',
      scry('/x', { since: '12.1.0', guardedBy: 'deskSupportsBuckets' }),
      'the N-1 desk serves it',
    ],
    [
      'a guard that names no guard',
      scry('/x', { since: '12.3.0', guardedBy: 'nope' }),
      'names no guard',
    ],
    [
      'a malformed since',
      scry('/x', { since: '13.0.1e0' }),
      'since is not a version',
    ],
    [
      'an http route with a desk',
      get('/x', { agent: 'hood', desk: 'base' }),
      'an http route cannot carry a desk exemption',
    ],
    [
      'a %groups agent with a desk',
      scry('/x', { agent: 'groups', desk: 'base' }),
      'groups is not an agent of %base',
    ],
    [
      'a path under a bot-only prefix',
      scry('/v1/automation/tasks'),
      'path can reach a prefix excluded',
    ],
    [
      'a hole that can reach a bot-only prefix',
      scry('/v1/{module}/tasks'),
      'path can reach a prefix excluded',
    ],
    [
      '%2e segments reaching a bot-only route',
      get('/steward/~/v1/lens/%2e%2E/automation/tasks'),
      'route can reach a prefix excluded',
    ],
  ])('%s', (_name, entry, message) => {
    expect(fails(entry)).toEqual([expect.stringContaining(message)]);
  });

  test('a guarded request above the floor passes', () => {
    const e = scry('/x', { since: '12.3.0', guardedBy: 'deskSupportsBuckets' });
    expect(fails(e)).toEqual([]);
  });

  test('a malformed floor, and an excluded module that no longer exists', () => {
    expect(checkRegistry({}, '12.2.0.1', scope)).toEqual([
      'MIN_GROUPS_VERSION 12.2.0.1 is not a version',
    ]);
    expect(
      checkRegistry({}, '12.2.0', { ...scope, excludedModules: ['gone'] })
    ).toEqual(['excluded module gone does not exist']);
  });

  test('duplicates, exact or with renamed holes', () => {
    const e = (path: string) =>
      ({ kind: 'scry', agent: 'groups', path, since: '12.2.0' }) as Entry;
    expect(
      checkRegistry(
        {
          t: {
            a: e('/x/{flag}'),
            b: e('/x/{groupId}'),
            c: e('/y'),
            d: e('/y'),
          },
        },
        '12.2.0',
        scope
      )
    ).toEqual([
      't.b (groups scry /x/{groupId} since 12.2.0): same request as t.a',
      't.d (groups scry /y since 12.2.0): same request as t.c',
    ]);
  });
});

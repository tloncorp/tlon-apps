import { describe, expect, it } from 'vitest';

import {
  Dependency,
  extractClient,
  extractFile,
  segmentsFromLiteral,
} from './extract';
import { memoryTree } from './git';

function extract(
  source: string,
  file = 'packages/api/src/client/thing.ts'
): Dependency[] {
  const out: Dependency[] = [];
  extractFile(file, source, out);
  return out;
}
const keys = (source: string, file?: string) =>
  extract(source, file)
    .map((d) => d.key)
    .sort();

/** Helper definitions the poke sites below build on. */
const HELPERS = `
  export function groupAction(json: unknown) {
    return { app: 'groups', mark: 'group-action-5', json };
  }
  export function channelAction(nest: string, action: unknown) {
    return { app: 'channels', mark: 'channel-action-2', json: { nest, action } };
  }
  export function channelPostAction(nest: string, action: unknown) {
    return channelAction(nest, { post: action });
  }
  export function activityAction(action: unknown) {
    if (getActivitySupportsNotes()) {
      return { app: 'activity', mark: 'activity-action-2', json: action };
    }
    return {
      app: 'activity',
      mark: getActivitySupportsReactions() ? 'activity-action-1' : 'activity-action',
      json: action,
    };
  }
`;
const withHelpers = (body: string) =>
  `import { poke } from './urbit';\n${HELPERS}\nexport const f = () => ${body};`;

it('splits a literal path, dropping a segment glued to an interpolation', () => {
  expect(segmentsFromLiteral('/v10/init', false)).toEqual(['v10', 'init']);
  // `/v1/foo${x}` — `foo` is not a complete segment.
  expect(segmentsFromLiteral('/v1/foo', true)).toEqual(['v1']);
  expect(segmentsFromLiteral('/v1/foo/', true)).toEqual(['v1', 'foo']);
});

describe('binding is by import source, not by name', () => {
  it('binds every form a wrapper arrives in', () => {
    expect(
      keys(
        "import { scry } from './urbit';\nexport const f = () => scry({ app: 'groups', path: '/v3/groups' });"
      )
    ).toEqual(['scry groups /v3/groups']);
    expect(
      keys(
        "import { scry as fetchIt } from '@tloncorp/api';\nexport const f = () => fetchIt({ app: 'groups', path: '/v3/groups' });"
      )
    ).toEqual(['scry groups /v3/groups']);
    expect(
      keys(
        "import * as api from '@tloncorp/api';\nexport const f = () => api.subscribe({ app: 'chat', path: '/v1' }, () => {});"
      )
    ).toEqual(['subscribe chat /v1']);
  });

  it('ignores same-named functions and `.subscribe` on unrelated objects', () => {
    expect(
      keys(
        "import { poke } from './local-helpers';\nexport const f = () => poke({ app: 'groups', mark: 'group-action-5' });"
      )
    ).toEqual([]);
    expect(
      keys(
        "import { useStore } from 'zustand';\nexport const f = () => useStore.subscribe(() => {});"
      )
    ).toEqual([]);
  });
});

describe('path shapes', () => {
  it('reads a template down to its literal prefix', () => {
    expect(
      keys(
        "import { scry } from './urbit';\nexport const f = (g: string) => scry({ app: 'groups', path: `/v3/ui/groups/${g}` });"
      )
    ).toEqual(['scry groups /v3/ui/groups/{}']);
  });

  it('keeps a shape distinct from one that merely shares its prefix', () => {
    expect(
      keys(`import { subscribe } from './urbit';
      export const a = (id: string) => subscribe({ app: 'groups', path: \`/chan/\${id}\` }, () => {});
      export const b = (id: string) => subscribe({ app: 'groups', path: \`/chan/\${id}/new-feature\` }, () => {});`)
    ).toEqual([
      'subscribe groups /chan/{}',
      'subscribe groups /chan/{}/new-feature',
    ]);
  });

  it('writes every hole the same way, and lets no literal spell one', () => {
    const sub = (path: string) =>
      keys(
        `import { subscribe } from './urbit';
         export const f = (id: string, o: { id: string }) =>
           subscribe({ app: 'groups', path: ${path} }, () => {});`
      )[0];
    // Every interpolation is anonymous, however it is written.
    expect(sub('`/chan/${id}`')).toBe('subscribe groups /chan/{}');
    expect(sub('`/chan/${o.id}`')).toBe('subscribe groups /chan/{}');
    expect(sub("`/chan/${id + '/new'}`")).toBe('subscribe groups /chan/{}');
    // A literal brace is escaped, so it cannot inherit a hole's exemption.
    expect(sub("'/chan/{}'")).not.toBe(sub('`/chan/${id}`'));
  });
});

describe('conditional branches', () => {
  it('reports a path per branch, never unioned, with its guard', () => {
    const deps = extract(
      "import { scry } from './urbit';\nexport const f = () => scry({ app: 'activity', path: getActivitySupportsNotes() ? '/v6/activity' : '/v4/activity' });"
    );
    expect(deps.map((d) => [d.key, d.guard])).toEqual([
      ['scry activity /v6/activity', 'getActivitySupportsNotes() ? …'],
      ['scry activity /v4/activity', '! (getActivitySupportsNotes())'],
    ]);
  });

  it('reports a mark per branch, with its guard', () => {
    const deps = extract(
      "import { poke } from './urbit';\nexport const f = () => poke({ app: 'activity', mark: supportsNotes ? 'activity-action-2' : 'activity-action-1' });"
    );
    expect(deps.map((d) => [d.key, d.guard])).toEqual([
      ['poke activity activity-action-2', 'supportsNotes ? …'],
      ['poke activity activity-action-1', '! (supportsNotes)'],
    ]);
  });

  it('conjoins a nested ternary with the branch it sits under', () => {
    const deps = extract(
      "import { scry } from './urbit';\nexport const f = () => scry({ app: 'activity', path: a ? (b ? '/v6' : '/v5') : '/v4' });"
    );
    expect(deps.map((d) => d.guard)).toEqual([
      'a ? … && b ? …',
      'a ? … && ! (b)',
      '! (a)',
    ]);
  });

  it('pairs a branching app with the branching path beside it, not by cross product', () => {
    const deps = extract(
      "import { scry } from './urbit';\nexport const f = () => scry({ app: dm ? 'chat' : 'channels', path: dm ? '/v1/dm' : '/v1/chan' });"
    );
    expect(deps.map((d) => d.key)).toEqual([
      'scry chat /v1/dm',
      'scry channels /v1/chan',
    ]);
  });
});

describe('the one local binding this reader follows', () => {
  it('reads a sole const used as the path, shorthand or named', () => {
    // `getGroup` — one of the two call sites that broke build 440.
    expect(
      keys(`import { scry } from './urbit';
        export const getGroup = async (groupId: string) => {
          const path = \`/v3/ui/groups/\${groupId}\`;
          return scry({ app: 'groups', path });
        };`)
    ).toEqual(['scry groups /v3/ui/groups/{}']);
    expect(
      keys(`import { scry } from './urbit';
        export const f = () => {
          const endpoint = '/v10/init';
          return scry({ app: 'groups-ui', path: endpoint });
        };`)
    ).toEqual(['scry groups-ui /v10/init']);
  });

  it('gives up on anything less certain than a sole const', () => {
    const unresolved = (body: string) =>
      extract(`import { scry } from './urbit';\n${body}`)[0];
    // Reassigned.
    expect(
      unresolved(`export const f = (n: number) => {
        let path = '/v1/a';
        if (n) path = '/v1/b';
        return scry({ app: 'groups', path });
      };`).unresolved
    ).toBeDefined();
    // Declared twice in the same function.
    expect(
      unresolved(`export const f = (n: number) => {
        if (n) { const path = '/v1/a'; return scry({ app: 'groups', path }); }
        const path = '/v1/b';
        return scry({ app: 'groups', path });
      };`).unresolved
    ).toBeDefined();
    // Bound in an outer scope.
    expect(
      unresolved(`const path = '/v1/a';
      export const f = () => scry({ app: 'groups', path });`).unresolved
    ).toBeDefined();
    // Declared inside a nested closure, which the call cannot see.
    expect(
      unresolved(`export const f = async () => {
        const unused = () => { const path = '/v99/init'; return path; };
        return scry({ app: 'groups', path });
      };`).unresolved
    ).toBeDefined();
    // Shadowed by a parameter of the call's own function.
    expect(
      unresolved(`export const f = async (path: string) => {
        const unused = () => { const path = '/v99/init'; return path; };
        return scry({ app: 'groups', path });
      };`).unresolved
    ).toBeDefined();
  });
});

describe('helper expansion', () => {
  it('resolves an object-literal return, and one hop of forwarding', () => {
    expect(keys(withHelpers("poke(groupAction({ flag: 'x' }))"))).toEqual([
      'poke groups group-action-5',
    ]);
    expect(
      keys(withHelpers("poke(channelPostAction('chat/~zod/x', {}))"))
    ).toEqual(['poke channels channel-action-2']);
  });

  it('keeps the condition a guarded return sits under', () => {
    // Without it, `activity-action-2` would block every run against a desk
    // that predates it instead of being reported as GUARDED.
    const deps = extract(withHelpers('poke(activityAction({}))'));
    expect(deps.map((d) => [d.key, d.guard])).toEqual([
      ['poke activity activity-action-2', 'getActivitySupportsNotes()'],
      ['poke activity activity-action-1', 'getActivitySupportsReactions() ? …'],
      ['poke activity activity-action', '! (getActivitySupportsReactions())'],
    ]);
  });

  it('records a helper return it cannot read rather than dropping it', () => {
    const [dep] = extract(
      "import { poke } from './urbit';\nexport function groupAction(x: unknown) { return buildIt(x); }\nexport const f = () => poke(groupAction({}));"
    );
    expect(dep.unresolved).toContain('groupAction returns');
  });
});

describe('what it cannot resolve is recorded, never dropped', () => {
  it('names the reason on the record', () => {
    // An open value set: feedVersion() returns 'v7' | 'v6' | 'v5' at runtime.
    expect(
      extract(
        "import { scry } from './urbit';\nexport const f = () => scry({ app: 'activity', path: `/${feedVersion()}/feed/init/30` });"
      )[0].unresolved
    ).toContain('could not be resolved');
    expect(
      extract(
        "import { poke } from './urbit';\nexport const f = (a: unknown) => poke(buildSomething(a));"
      )[0].unresolved
    ).toContain('buildSomething');
    expect(
      extract(
        "import { scry } from './urbit';\nexport const f = (app: string) => scry({ app, path: '/v1/init' });"
      )[0].unresolved
    ).toContain('app is not a string literal');
    expect(
      extract(
        'export const init = async (airlock: Urbit) => airlock.subscribe(sub(set, get));'
      )[0].unresolved
    ).toContain('airlock.subscribe');
  });

  it('reads both dependencies of a tracked poke: the mark and the watch endpoint', () => {
    expect(
      keys(
        "import { trackedPoke } from './urbit';\nexport const f = () => trackedPoke({ app: 'groups', mark: 'group-action-5' }, { app: 'groups', path: '/v3/groups' }, () => true);"
      )
    ).toEqual(['poke groups group-action-5', 'subscribe groups /v3/groups']);
  });

  it('reads the web client, whose subscribeOnce is positional (app, path, timeout)', () => {
    const web = 'apps/tlon-web/src/logic/useThing.tsx';
    expect(
      keys(
        "import api from '@/api';\nexport const f = () => api.subscribeOnce('groups', '/v3/groups', 5000);",
        web
      )
    ).toEqual(['subscribe groups /v3/groups']);
  });
});

it('skips the wrapper definitions and test files', () => {
  const deps = extractClient(
    memoryTree({
      'packages/api/src/client/urbit.ts':
        "import { poke } from './urbit';\nexport const f = () => poke({ app: 'groups', mark: 'x' });",
      'packages/api/src/__tests__/t.test.ts':
        "import { scry } from '../client/urbit';\nexport const f = () => scry({ app: 'groups', path: '/v3/groups' });",
      'packages/api/src/client/real.ts':
        "import { scry } from './urbit';\nexport const f = () => scry({ app: 'groups', path: '/v1/init' });",
    }),
    ['packages/api/src']
  );
  expect(deps.map((d) => d.key)).toEqual(['scry groups /v1/init']);
});

it('scans both app source roots by default', () => {
  const deps = extractClient(
    memoryTree({
      'apps/tlon-web/src/state/base.ts':
        "import { scry } from '@tloncorp/api';\nexport const f = () => scry({ app: 'groups', path: '/v1/init' });",
      'apps/tlon-mobile/src/lib/notifications.ts':
        "import { poke } from '@tloncorp/api';\nexport const g = () => poke({ app: 'activity', mark: 'activity-action-2' });",
    })
  );
  expect(deps.map((d) => d.key).sort()).toEqual([
    'poke activity activity-action-2',
    'scry groups /v1/init',
  ]);
});

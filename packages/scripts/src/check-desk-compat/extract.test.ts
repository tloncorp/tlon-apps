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

describe('a wrapper name a nested scope has taken back', () => {
  it('is not a ship call, however the shadow is bound', () => {
    // The import map is file-wide, so without this each of these invents a
    // dependency the client never has.
    const shadowing = (body: string) =>
      keys(`import { poke, scry } from './urbit';\n${body}`);
    expect(
      shadowing(
        "export const f = (poke: (x: unknown) => void) => poke({ app: 'groups', mark: 'group-action-5' });"
      )
    ).toEqual([]);
    expect(
      shadowing(`export const f = () => {
        const poke = (x: unknown) => x;
        return poke({ app: 'groups', mark: 'group-action-5' });
      };`)
    ).toEqual([]);
    expect(
      shadowing(
        "export const f = ({ scry }: { scry: (x: unknown) => void }) => scry({ app: 'groups', path: '/v1/init' });"
      )
    ).toEqual([]);
    // And the real import still resolves beside them.
    expect(
      shadowing(
        "export const g = () => poke({ app: 'groups', mark: 'group-action-5' });"
      )
    ).toEqual(['poke groups group-action-5']);
  });
});

describe('threads', () => {
  const run = (body: string) =>
    extract(`import { thread } from './urbit';\n${body}`)[0];

  it('are identified by desk, name and the mark they take', () => {
    // Two desks may both ship a `group-create-1`, and a thread that starts
    // taking a different input mark is a different dependency.
    expect(
      run(
        "export const f = () => thread({ desk: 'groups', threadName: 'group-create-1', inputMark: 'group-create-thread', outputMark: 'group-ui-2', body: {} });"
      ).key
    ).toBe('thread groups/group-create-1 group-create-thread');
  });

  it('are unresolved when any of the three is computed', () => {
    const dep = run(
      "export const f = (desk: string) => thread({ desk, threadName: 'group-create-1', inputMark: 'group-create-thread', body: {} });"
    );
    expect(dep.key).toBe('thread ?/group-create-1 group-create-thread');
    expect(dep.unresolved).toBe('desk is not a string literal');
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

  it('pairs two branches on the same condition, and crosses independent ones', () => {
    // One condition, one choice: the cross product would invent `chat` with
    // the channel path.
    const same = extract(
      "import { scry } from './urbit';\nexport const f = (dm: boolean) => scry({ app: dm ? 'chat' : 'channels', path: dm ? '/v1/dm' : '/v1/chan' });"
    );
    expect(same.map((d) => d.key)).toEqual([
      'scry chat /v1/dm',
      'scry channels /v1/chan',
    ]);
    // Two conditions: every combination is reachable, and pairing by position
    // would drop half of them.
    const independent = extract(
      "import { scry } from './urbit';\nexport const f = (dm: boolean, v2: boolean) => scry({ app: dm ? 'chat' : 'channels', path: v2 ? '/v2' : '/v1' });"
    );
    expect(independent.map((d) => d.key).sort()).toEqual([
      'scry channels /v1',
      'scry channels /v2',
      'scry chat /v1',
      'scry chat /v2',
    ]);
    expect(independent[0].guard).toBe('dm ? … && v2 ? …');
  });
});

describe('the branch a call site sits under', () => {
  it('guards the request, wrapped or gated by an early return', () => {
    // `getThreadUnreadsByChannel` gates its notes scry with
    // `if (!supported) return null;` rather than by wrapping it, and the
    // GUARDED rule downstream reads the same text either way.
    const wrapped = extract(`import { scry } from './urbit';
      export const f = () => {
        if (getActivitySupportsNotes()) {
          return scry({ app: 'activity', path: '/v6/activity' });
        }
        return null;
      };`);
    expect(wrapped[0].guard).toBe('getActivitySupportsNotes() ? …');

    const gated = extract(`import { scry } from './urbit';
      export const f = (channel: { type: string }) => {
        if (channel.type === 'notes') {
          if (!getActivitySupportsNotes()) {
            return null;
          }
          return scry({ app: 'activity', path: '/v6/activity/notes' });
        }
        return null;
      };`);
    expect(gated[0].guard).toBe(
      "channel.type === 'notes' ? … && ! (!getActivitySupportsNotes())"
    );
  });

  it('does not reach through a nested closure', () => {
    // The callback may run anywhere; the `if` around its definition says
    // nothing about when it fires.
    const deps = extract(`import { scry } from './urbit';
      export const f = (flag: boolean) => {
        if (flag) {
          return later(() => scry({ app: 'activity', path: '/v6' }));
        }
        return null;
      };`);
    expect(deps[0].guard).toBeUndefined();
  });

  it('conjoins the call-site branch with the value-level guard', () => {
    const deps = extract(`import { scry } from './urbit';
      export const f = (a: boolean, b: boolean) => {
        if (a) {
          return scry({ app: 'activity', path: b ? '/v6' : '/v4' });
        }
        return null;
      };`);
    expect(deps.map((d) => d.guard)).toEqual([
      'a ? … && b ? …',
      'a ? … && ! (b)',
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
    // Declared twice, once per block: each call reads the innermost binding
    // that encloses it, which is the only reading the language allows.
    expect(
      keys(`import { scry } from './urbit';
        export const f = (n: number) => {
          if (n) { const path = '/v1/a'; return scry({ app: 'groups', path }); }
          const path = '/v1/b';
          return scry({ app: 'groups', path });
        };`)
    ).toEqual(['scry groups /v1/a', 'scry groups /v1/b']);
    // Declared in a block the call is not inside.
    expect(
      unresolved(`export const f = (flag: boolean) => {
        const path = '/v1/live';
        if (flag) { const path = '/v99/unused'; void path; }
        return scry({ app: 'groups', path });
      };`).key
    ).toBe('scry groups /v1/live');
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

  it('reads a cross-file helper\u2019s guard from that file, not the caller\u2019s', () => {
    // The helper's nodes index into *its* source; slicing them out of the
    // caller's text yields whatever sits at those offsets.
    const deps = extractClient(
      memoryTree({
        'packages/api/src/urbit/activity.ts': [
          'export function activityAction(action: unknown) {',
          '  if (getActivitySupportsNotes()) {',
          "    return { app: 'activity', mark: 'activity-action-2', json: action };",
          '  }',
          "  return { app: 'activity', mark: 'activity-action', json: action };",
          '}',
        ].join('\n'),
        'packages/api/src/client/activityApi.ts':
          "import { poke } from './urbit';\nimport * as ub from '@tloncorp/api/urbit';\nexport const f = () => poke(ub.activityAction({}));",
      }),
      ['packages/api/src']
    );
    expect(
      deps.find((d) => d.key === 'poke activity activity-action-2')?.guard
    ).toBe('getActivitySupportsNotes()');
  });

  it('reads a helper that returns its object through a local const', () => {
    // `chatAction` binds each branch before returning it; without this the
    // helper reports two unreadable returns instead of its two marks.
    expect(
      keys(`import { poke } from './urbit';
        export function chatAction(whom: string) {
          if (whomIsDm(whom)) {
            const action = { app: 'chat', mark: 'chat-dm-action-2', json: {} };
            return action;
          }
          const action = { app: 'chat', mark: 'chat-club-action-2', json: {} };
          return action;
        }
        export const f = (whom: string) => poke(chatAction(whom));`)
    ).toEqual(['poke chat chat-club-action-2', 'poke chat chat-dm-action-2']);
  });

  it('records a helper return it cannot read rather than dropping it', () => {
    const [dep] = extract(
      "import { poke } from './urbit';\nexport function groupAction(x: unknown) { return buildIt(x); }\nexport const f = () => poke(groupAction({}));"
    );
    expect(dep.unresolved).toContain('groupAction returns');
  });
});

describe('a poke whose params are bound first', () => {
  it('reads the object a sole const holds, innermost binding first', () => {
    // `showPost` declares `action` twice: once inside the `if`, once after.
    // Each call reads the one the language resolves it to.
    expect(
      keys(`import { poke } from './urbit';
        export async function showPost(post: { id: string }) {
          if (isGroupChannelId(post.id)) {
            const action = { app: 'channels', mark: 'channel-action-2', json: {} };
            return poke(action);
          }
          const action = { app: 'chat', mark: 'chat-toggle-message', json: {} };
          return poke(action);
        }`)
    ).toEqual([
      'poke channels channel-action-2',
      'poke chat chat-toggle-message',
    ]);
  });

  it('carries the branch the binding sits under as its guard', () => {
    // The whole call is inside the arm, so the request is as conditional as
    // the binding is — which is what the GUARDED rule downstream reads.
    const deps = extract(`import { poke } from './urbit';
      export const f = (supportsNotes: boolean) => {
        if (supportsNotes) {
          const action = { app: 'activity', mark: 'activity-action-2' };
          return poke(action);
        }
        const action = { app: 'activity', mark: 'activity-action' };
        return poke(action);
      };`);
    expect(deps.map((d) => [d.mark, d.guard])).toEqual([
      ['activity-action-2', 'supportsNotes ? …'],
      // The `if` above it always returns, so the fallback runs only when the
      // capability is absent — and says so.
      ['activity-action', '! (supportsNotes)'],
    ]);
  });

  it('marks a poke whose app it could not read', () => {
    const [dep] = extract(
      "import { poke } from './urbit';\nexport const f = (app: string) => poke({ app, mark: 'chat-negotiate' });"
    );
    expect(dep.key).toBe('poke ? chat-negotiate');
    expect(dep.unresolved).toBe('app is not a string literal');
  });

  it('splits a bound choice between params objects', () => {
    // `deletePost` binds `action` to a three-way conditional. Passing that
    // into the params reader whole leaves the whole site unresolvable, when
    // each branch is a perfectly readable request.
    const deps = extract(`import { poke } from './urbit';
      export async function deletePost(id: string) {
        const action = isDm(id)
          ? { app: 'chat', mark: 'chat-dm-action-2', json: {} }
          : isClub(id)
            ? { app: 'chat', mark: 'chat-club-action-2', json: {} }
            : { app: 'channels', mark: 'channel-action-2', json: {} };
        return poke(action);
      }`);
    expect(deps.map((d) => [d.key, d.guard])).toEqual([
      ['poke chat chat-dm-action-2', 'isDm(id) ? …'],
      ['poke chat chat-club-action-2', '! (isDm(id)) && isClub(id) ? …'],
      ['poke channels channel-action-2', '! (isDm(id)) && ! (isClub(id))'],
    ]);
  });

  it('splits a choice a helper returns, too', () => {
    expect(
      keys(`import { poke } from './urbit';
        export function chatAction(whom: string) {
          return whomIsDm(whom)
            ? { app: 'chat', mark: 'chat-dm-action-2', json: {} }
            : { app: 'chat', mark: 'chat-club-action-2', json: {} };
        }
        export const f = (whom: string) => poke(chatAction(whom));`)
    ).toEqual(['poke chat chat-club-action-2', 'poke chat chat-dm-action-2']);
  });

  it('still gives up when the binding is not the one the call reads', () => {
    const unresolved = (body: string) =>
      extract(`import { poke } from './urbit';\n${body}`)[0].unresolved;
    // Reassigned.
    expect(
      unresolved(`export const f = (n: number) => {
        let action = { app: 'chat', mark: 'chat-dm-action-2' };
        if (n) action = { app: 'chat', mark: 'chat-club-action-2' };
        return poke(action);
      };`)
    ).toBeDefined();
    // Declared only in a block the call is not inside.
    expect(
      unresolved(`export const f = (n: number) => {
        if (n) { const action = { app: 'chat', mark: 'chat-dm-action-2' }; void action; }
        return poke(action);
      };`)
    ).toBeDefined();
    // Built in the enclosing function, sent from a callback.
    expect(
      unresolved(`export const f = () => {
        const action = { app: 'chat', mark: 'chat-dm-action-2' };
        return backOff(() => poke(action));
      };`)
    ).toBeDefined();
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

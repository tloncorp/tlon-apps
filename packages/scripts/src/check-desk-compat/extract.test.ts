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
  export function chatAction(whom: string, delta: unknown) {
    if (whomIsDm(whom)) {
      const action = { app: 'chat', mark: 'chat-dm-action-2', json: delta };
      return action;
    }
    const action = { app: 'chat', mark: 'chat-club-action-2', json: delta };
    return action;
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
  keys(
    `import { poke } from './urbit';\n${HELPERS}\nexport const f = (whom: string) => ${body};`
  );

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

describe('argument forms', () => {
  it('reads a template path down to its literal prefix, directly or through a local', () => {
    const inline = extract(
      "import { scry } from './urbit';\nexport const f = (g: string) => scry({ app: 'groups', path: `/v3/ui/groups/${g}` });"
    );
    expect(inline[0].path).toMatchObject({
      known: ['v3', 'ui', 'groups'],
      unknownTail: true,
    });
    const shorthand = extract(
      "import { scry } from './urbit';\nexport const f = (g: string) => { const path = `/v3/ui/groups/${g}`; return scry({ app: 'groups', path }); };"
    );
    expect(shorthand[0].path).toMatchObject({ known: ['v3', 'ui', 'groups'] });
  });

  it('reports a conditional path per branch, never unioned, with its guard', () => {
    const deps = extract(
      "import { scry } from './urbit';\nexport const f = () => scry({ app: 'activity', path: getActivitySupportsNotes() ? '/v6/activity' : '/v4/activity' });"
    );
    expect(deps.map((d) => d.key).sort()).toEqual([
      'scry activity /v4/activity',
      'scry activity /v6/activity',
    ]);
    expect(deps.every((d) => d.guard)).toBe(true);
  });

  it('pairs multi-branch app and path by branch, not by cross product', () => {
    expect(
      keys(`
        import { scry } from './urbit';
        export const f = (channelId: string, postId: string) => {
          let app: 'chat' | 'channels';
          let path: string;
          if (isDmChannelId(channelId)) {
            app = 'chat';
            path = \`/v4/dm/\${channelId}/writs/writ/id/\${postId}\`;
          } else {
            app = 'channels';
            path = \`/v5/\${channelId}/posts/post/\${postId}\`;
          }
          return scry({ app, path });
        };
      `)
      // Identity keeps the literal text after each interpolation, so two calls
      // that share a prefix are not silently the same request.
    ).toEqual([
      'scry channels /v5/{}/posts/post/{}',
      'scry chat /v4/dm/{}/writs/writ/id/{}',
    ]);
  });

  it('keeps a template shape distinct from one that merely shares its prefix', () => {
    const two = `import { subscribe } from './urbit';
      export const a = (id: string) => subscribe({ app: 'groups', path: \`/chan/\${id}\` }, () => {});
      export const b = (id: string) => subscribe({ app: 'groups', path: \`/chan/\${id}/new-feature\` }, () => {});`;
    expect(keys(two)).toEqual([
      'subscribe groups /chan/{}',
      'subscribe groups /chan/{}/new-feature',
    ]);
  });

  it('only anonymises a plain identifier chain, and hashes the rest whole', () => {
    const sub = (path: string) =>
      keys(
        `import { subscribe } from './urbit';
         export const f = (id: string, o: { id: string }) =>
           subscribe({ app: 'groups', path: ${path} }, () => {});`
      )[0];
    expect(sub('`/chan/${id}`')).toBe('subscribe groups /chan/{}');
    expect(sub('`/chan/${o.id}`')).toBe('subscribe groups /chan/{}');
    // An expression receiver is not a plain chain, and a suffix folded into
    // the expression must not collapse onto the shorter shape.
    expect(sub("`/chan/${({ path: id + '/new-feature' }).path}`")).not.toBe(
      'subscribe groups /chan/{}'
    );
    expect(sub("`/chan/${id + '/new-feature'}`")).not.toBe(
      'subscribe groups /chan/{}'
    );
    // Two long expressions that differ only past 200 characters stay distinct.
    const pad = "'".concat('x'.repeat(210), "'");
    expect(sub(`\`/chan/\${id + ${pad} + 'a'}\``)).not.toBe(
      sub(`\`/chan/\${id + ${pad} + 'b'}\``)
    );
    // A literal brace cannot spell a hole.
    expect(sub("'/chan/{}'")).not.toBe(sub('`/chan/${id}`'));
  });

  it('records an endpoint assigned from a call, instead of dropping the branch', () => {
    const deps = extract(`import { scry } from './urbit';
      export const f = (n: number) => {
        let endpoint = { app: 'groups', path: '/v3/groups' };
        if (n > 0) endpoint = buildEndpoint(n);
        return scry(endpoint);
      };`);
    expect(deps.map((d) => d.key).sort()).toEqual([
      'scry ? ?',
      'scry groups /v3/groups',
    ]);
    expect(deps.find((d) => d.key === 'scry ? ?')?.unresolved).toContain(
      'buildEndpoint'
    );
  });

  it('keeps the real assignments when a placeholder precedes them', () => {
    // activityApi.ts:57 — `let scryPath = ''` is not a request, but the two
    // paths assigned after it are, and both must survive as their own records.
    const deps = extract(`import { scry } from './urbit';
      export const f = (id: string, dm: boolean) => {
        let scryPath = '';
        if (dm) { scryPath = \`/v4/activity/dm-threads/\${id}\`; }
        else { scryPath = \`/v4/activity/threads/\${id}\`; }
        return scry({ app: 'activity', path: scryPath });
      };`);
    expect(deps.map((d) => d.key).sort()).toEqual([
      'scry activity /',
      'scry activity /v4/activity/dm-threads/{}',
      'scry activity /v4/activity/threads/{}',
    ]);
    const placeholder = deps.find((d) => d.key === 'scry activity /');
    expect(placeholder?.unresolved).toContain('placeholder');
  });

  it('resolves only the bindings that can reach the call', () => {
    // An assignment after the call, or inside a closure that may never run,
    // cannot be the value the call sent.
    expect(
      keys(`import { scry } from './urbit';
        export const f = () => {
          let path = '/v1/live';
          const later = () => { path = '/v1/never-sent'; };
          const out = scry({ app: 'groups', path });
          path = '/v1/after-the-call';
          return [out, later];
        };`)
    ).toEqual(['scry groups /v1/live']);
  });

  it('resolves nothing when a loop makes the ordering meaningless', () => {
    // In a loop the call sees the previous iteration's value, so position no
    // longer says which assignment reaches it.
    const [dep] = extract(`import { scry } from './urbit';
      export const f = (ids: string[]) => {
        let path = '/v1/first';
        for (const id of ids) {
          scry({ app: 'groups', path });
          path = \`/v1/\${id}\`;
        }
      };`);
    expect(dep.unresolved).toBeDefined();
  });

  it('records what it cannot resolve rather than dropping it', () => {
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
        'export const init = async (airlock: Urbit) => airlock.subscribe(sub(set, get));'
      )[0].unresolved
    ).toContain('airlock.subscribe');
  });

  it('reads both dependencies of a tracked poke: the mark and the watch endpoint', () => {
    expect(
      keys(`
        import { trackedPoke } from './urbit';
        export const f = () =>
          trackedPoke(
            { app: 'groups', mark: 'group-action-5', json: {} },
            { app: 'groups', path: '/v3/groups' },
            () => true
          );
      `)
    ).toEqual(['poke groups group-action-5', 'subscribe groups /v3/groups']);
  });

  it('reads the web client, whose subscribeOnce is positional (app, path, timeout)', () => {
    const web = 'apps/tlon-web/src/logic/useThing.tsx';
    expect(
      keys(
        "import api from '@/api';\nexport const f = (t: number) => api.subscribeOnce<string>('groups', '/v3/groups', t);",
        web
      )
    ).toEqual(['subscribe groups /v3/groups']);
    expect(
      keys(
        "import api from '@/api';\nexport const f = () => api.poke({ app: 'groups-ui', mark: 'ui-vita-toggle', json: true });",
        web
      )
    ).toEqual(['poke groups-ui ui-vita-toggle']);
  });
});

describe('helper expansion', () => {
  it('resolves an object-literal return, and one hop of forwarding', () => {
    expect(withHelpers('poke(groupAction({}))')).toContain(
      'poke groups group-action-5'
    );
    // channelPostAction returns channelAction(...), not an object literal.
    expect(withHelpers("poke(channelPostAction('chat/~zod/x', {}))")).toContain(
      'poke channels channel-action-2'
    );
  });

  it('keeps the condition a conditional return sits under', () => {
    // Without it, every call site of a version-gated helper looks like it needs
    // all three marks, and the documented fallback can never pass the gate.
    const deps = extract(
      `import { poke } from './urbit';\n${HELPERS}\nexport const f = () => poke(activityAction({}));`
    );
    const guardOf = (mark: string) =>
      deps.find((d) => d.mark === mark)?.guard ?? '';
    expect(guardOf('activity-action-2')).toContain(
      'getActivitySupportsNotes()'
    );
    expect(guardOf('activity-action-1')).toContain(
      '! (getActivitySupportsNotes())'
    );
    expect(guardOf('activity-action')).toContain(
      '! (getActivitySupportsNotes())'
    );
    // Every branch still comes from the one call site, which is what lets a
    // served sibling cover a missing one.
    expect(new Set(deps.map((d) => d.site.line)).size).toBe(1);
  });

  it('keeps every branch of a helper as its own record', () => {
    expect(withHelpers('poke(chatAction(whom, {}))')).toEqual(
      expect.arrayContaining([
        'poke chat chat-dm-action-2',
        'poke chat chat-club-action-2',
      ])
    );
    // A capability-dependent mark: one record per value it can take.
    expect(withHelpers('poke(activityAction({}))')).toEqual(
      expect.arrayContaining([
        'poke activity activity-action',
        'poke activity activity-action-1',
        'poke activity activity-action-2',
      ])
    );
  });

  it('resolves a helper through a local variable', () => {
    expect(
      keys(
        `import { poke } from './urbit';\n${HELPERS}\nexport const f = () => { const action = groupAction({}); return poke(action); };`
      )
    ).toContain('poke groups group-action-5');
  });

  it('finds a helper defined in another module of the scanned tree', () => {
    const deps = extractClient(
      memoryTree({
        'packages/api/src/urbit/channel.ts':
          "export function channelAction(nest: string, action: unknown) { return { app: 'channels', mark: 'channel-action-2', json: { nest, action } }; }",
        'packages/api/src/client/postsApi.ts':
          "import { poke } from './urbit';\nimport * as ub from '@tloncorp/api/urbit';\nexport const f = () => poke(ub.channelAction('chat/~zod/x', {}));",
      }),
      ['packages/api/src']
    );
    expect(deps.map((d) => d.key)).toContain('poke channels channel-action-2');
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

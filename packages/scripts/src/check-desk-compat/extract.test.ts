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

describe('a wrapper name a nested scope has taken back', () => {
  it('is not a ship call, however the shadow is bound', () => {
    // The import map is file-wide, so without this each of these invents a
    // dependency the client never has.
    const shadowing = (body: string) =>
      keys(`import { poke, scry } from './urbit';\n${body}`);
    // A parameter.
    expect(
      shadowing(
        "export const f = (poke: (x: unknown) => void) => poke({ app: 'groups', mark: 'group-action-5' });"
      )
    ).toEqual([]);
    // A local.
    expect(
      shadowing(`export const f = () => {
        const poke = (x: unknown) => x;
        return poke({ app: 'groups', mark: 'group-action-5' });
      };`)
    ).toEqual([]);
    // A destructured parameter, and a namespace object of the same name.
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

  it('pairs two ternaries on the same condition, and crosses independent ones', () => {
    // One condition, one choice: the cross product would invent `chat` with
    // the channel path.
    expect(
      keys(
        "import { scry } from './urbit';\nexport const f = (dm: boolean) => scry({ app: dm ? 'chat' : 'channels', path: dm ? '/v1/dm' : '/v1/chan' });"
      )
    ).toEqual(['scry channels /v1/chan', 'scry chat /v1/dm']);
    // Two conditions: every combination is reachable, and each carries both.
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

  it('conjoins nested conditionals inside a property', () => {
    // `mark: A ? B ? x : y : z` sends x under A && B. A guard reading only `A`
    // would pair x with y's sibling as if either could serve it.
    const deps = extract(`import { poke } from './urbit';
      export const f = (json: unknown) =>
        poke({
          app: 'activity',
          mark: supportsNotes
            ? supportsReactions
              ? 'activity-action-3'
              : 'activity-action-2'
            : 'activity-action-1',
          json,
        });`);
    expect(deps.map((d) => `${d.mark} ${d.guard}`).sort()).toEqual([
      'activity-action-1 ! (supportsNotes)',
      'activity-action-2 supportsNotes ? … && ! (supportsReactions)',
      'activity-action-3 supportsNotes ? … && supportsReactions ? …',
    ]);
  });

  it('guards each arm of a ternary written as the poke argument itself', () => {
    // `poke(a ? new : old)` is the same fallback as `poke({ mark: a ? … : … })`
    // and has to read as one, or the new mark looks unconditional.
    const deps = extract(`import { poke } from './urbit';
      export const f = (json: unknown) => {
        const modern = { app: 'activity', mark: 'activity-action-2', json };
        const legacy = { app: 'activity', mark: 'activity-action-1', json };
        return poke(getActivitySupportsNotes() ? modern : legacy);
      };`);
    expect(deps.map((d) => `${d.mark} ${d.guard}`).sort()).toEqual([
      'activity-action-1 ! (getActivitySupportsNotes())',
      'activity-action-2 getActivitySupportsNotes() ? …',
    ]);
  });

  it('conjoins a nested ternary with the branch it sits under', () => {
    const deps = extract(`import { poke } from './urbit';
      export const f = (json: unknown) => {
        return poke(
          supportsNotes
            ? supportsReactions
              ? { app: 'activity', mark: 'activity-action-3', json }
              : { app: 'activity', mark: 'activity-action-2', json }
            : { app: 'activity', mark: 'activity-action-1', json }
        );
      };`);
    expect(deps.map((d) => `${d.mark} ${d.guard}`).sort()).toEqual([
      'activity-action-1 ! (supportsNotes)',
      'activity-action-2 supportsNotes ? … && ! (supportsReactions)',
      'activity-action-3 supportsNotes ? … && supportsReactions ? …',
    ]);
  });

  it('keeps only the last write on a straight line', () => {
    // Nothing between the two assignments can skip either, so the first is
    // dead and the request it describes was never sent.
    expect(
      keys(`import { scry } from './urbit';
        export const f = () => {
          let path = '/v1/removed';
          path = '/v1/served';
          return scry({ app: 'groups', path });
        };`)
    ).toEqual(['scry groups /v1/served']);
  });

  it('keeps every write once control flow can skip one', () => {
    // Each of these leaves it open which assignment the call actually read, so
    // both requests stay on the record.
    const ambiguous = [
      "let path = '/v1/a'; if (x) { path = '/v1/b'; }",
      "let path = '/v1/a'; if (x) path = '/v1/b';",
      "let path = '/v1/a'; x && (path = '/v1/b');",
      "let path = '/v1/a'; path = x ? '/v1/b' : '/v1/a';",
      "let path = '/v1/a'; for (const y of ys) { path = '/v1/b'; }",
      "let path = '/v1/a'; try { path = '/v1/b'; } catch {}",
    ];
    for (const setup of ambiguous) {
      expect(
        keys(`import { scry } from './urbit';
          export const f = (x: boolean, ys: string[]) => {
            ${setup}
            return scry({ app: 'groups', path });
          };`)
      ).toContain('scry groups /v1/a');
    }
  });

  it('drops an empty initialiser that a later assignment overwrites', () => {
    // activityApi.ts:57 — `let scryPath = ''` is only a placeholder because
    // both branches below it assign the path the call actually sends.
    const deps = extract(`import { scry } from './urbit';
      export const f = (id: string, dm: boolean) => {
        let scryPath = '';
        if (dm) { scryPath = \`/v4/activity/dm-threads/\${id}\`; }
        else { scryPath = \`/v4/activity/threads/\${id}\`; }
        return scry({ app: 'activity', path: scryPath });
      };`);
    expect(deps.map((d) => d.key).sort()).toEqual([
      'scry activity /v4/activity/dm-threads/{}',
      'scry activity /v4/activity/threads/{}',
    ]);
  });

  it('keeps an empty path a lone `if` may never overwrite', () => {
    // Only one arm writes, so the root path still reaches the call. Dropping
    // it hides a request the client really makes.
    expect(
      keys(`import { scry } from './urbit';
        export const f = (flag: boolean) => {
          let path = '';
          if (flag) path = '/v1';
          return scry({ app: 'chat', path });
        };`)
    ).toEqual(['scry chat /', 'scry chat /v1']);
  });

  it('gives up on a write whose result depends on the old value', () => {
    // `path ||= '/v1'` leaves the reader unable to say which value the call
    // sends; reporting the initialiser would name a request that is not made.
    for (const op of ['||=', '&&=', '??=', '+=']) {
      const [dep] = extract(`import { scry } from './urbit';
        export const f = () => {
          let path = '';
          path ${op} '/v1';
          return scry({ app: 'groups', path });
        };`);
      expect(dep.key).toBe('scry groups /*');
      expect(dep.unresolved).toContain('could not be resolved');
    }
    // A plain `=` is still read.
    expect(
      keys(`import { scry } from './urbit';
        export const f = () => {
          let path = '';
          path = '/v1';
          return scry({ app: 'groups', path });
        };`)
    ).toEqual(['scry groups /v1']);
  });

  it('keeps an empty path that nothing overwrites', () => {
    // chatApi.ts subscribes to `/` for real. Only a competing assignment makes
    // an empty string a placeholder; on its own it is the request.
    const deps = extract(`import { subscribe } from './urbit';
      export const f = () => {
        const path = '';
        return subscribe({ app: 'chat', path }, () => {});
      };`);
    expect(deps.map((d) => d.key)).toEqual(['subscribe chat /']);
    expect(deps[0].unresolved).toBeUndefined();
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

  it('reads a request the enclosing function declared and a callback sends', () => {
    // `backOff(() => poke(action))`: the call's own scope is the callback, and
    // the request it sends was built one scope out.
    expect(
      keys(`import { poke } from './urbit';
        export const readAll = () => {
          const action = { app: 'activity', mark: 'activity-action-2' };
          return backOff(() => poke(action), { numOfAttempts: 4 });
        };`)
    ).toEqual(['poke activity activity-action-2']);
  });

  it('stops the outward walk at a name the callback binds itself', () => {
    // The callback's own `action` is the one it sends, whatever an outer
    // scope calls by that name.
    expect(
      keys(`import { poke } from './urbit';
        export const f = (items: unknown[]) => {
          const action = { app: 'activity', mark: 'activity-action-2' };
          items.forEach((action) => poke(action));
          return action;
        };`)
    ).toEqual(['poke ? ?']);
  });

  it('keeps the loop rule in every scope the walk passes through', () => {
    // The callback is built inside the loop, so the outer scope cannot say
    // which write to `params` reached it either.
    const [dep] = extract(`import { poke } from './urbit';
      export const f = (ids: string[]) => {
        let params = { app: 'groups', mark: 'group-action-5' };
        for (const id of ids) {
          backOff(() => poke(params));
          params = { app: 'groups', mark: id };
        }
      };`);
    expect(dep.unresolved).toBeDefined();
  });

  it('ignores a binding in a block the call is not inside', () => {
    // The `path` in the `if` is a different `path`; taking it would send a
    // request no code path makes.
    expect(
      keys(`import { scry } from './urbit';
        const outer = '/v1/live';
        export const f = (flag: boolean) => {
          const path = outer;
          if (flag) {
            const path = '/v99/unused';
            void path;
          }
          return scry({ app: 'groups', path });
        };`)
    ).toEqual(['scry groups /*']);
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

  it('carries the branch an assignment sits under as its guard', () => {
    // An `if` arm is no less conditional than a ternary branch, and the
    // GUARDED rule downstream reads exactly this text.
    const deps = extract(`import { poke } from './urbit';
      export const f = (supportsNew: boolean) => {
        let params = { app: 'activity', mark: 'activity-action' };
        if (supportsNew) {
          params = { app: 'activity', mark: 'activity-action-2' };
        } else {
          params = { app: 'activity', mark: 'activity-action-1' };
        }
        return poke(params);
      };`);
    expect(
      deps
        .filter((d) => d.mark !== 'activity-action')
        .map((d) => [d.mark, d.guard])
    ).toEqual([
      ['activity-action-2', 'supportsNew ? …'],
      ['activity-action-1', '! (supportsNew)'],
    ]);
  });

  it('conjoins nested branch conditions, and reads a case label', () => {
    const nested = extract(`import { scry } from './urbit';
      export const f = (a: boolean, b: boolean) => {
        let path = '/v1';
        if (a) { if (b) { path = '/v3'; } }
        return scry({ app: 'chat', path });
      };`);
    expect(nested.find((d) => d.path?.text.includes('v3'))?.guard).toBe(
      'a ? … && b ? …'
    );
    const switched = extract(`import { scry } from './urbit';
      export const f = (kind: string) => {
        let path = '/v1';
        switch (kind) {
          case 'dm':
            path = '/v2';
            break;
        }
        return scry({ app: 'chat', path });
      };`);
    expect(switched.find((d) => d.path?.text.includes('v2'))?.guard).toBe(
      "kind === 'dm'"
    );
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

  it('marks a poke whose app it could not read, as the endpoint readers do', () => {
    const [dep] = extract(
      "import { poke } from './urbit';\nexport const f = (app: string) => poke({ app, mark: 'chat-negotiate' });"
    );
    expect(dep.key).toBe('poke ? chat-negotiate');
    expect(dep.unresolved).toBe('app is not a string literal');
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
    // A computed path there is unresolved, exactly as in the object form —
    // not a request to the root.
    const [computed] = extract(
      "import api from '@/api';\nexport const f = () => api.subscribeOnce<string>('groups', buildPath(), 5000);",
      web
    );
    expect(computed.key).toBe('subscribe groups /*');
    expect(computed.unresolved).toContain('path could not be resolved');
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
    const guarded = deps.find(
      (d) => d.key === 'poke activity activity-action-2'
    );
    expect(guarded?.guard).toBe('getActivitySupportsNotes()');
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
    expect(
      run(
        "export const f = (n: string) => thread({ desk: 'groups', threadName: n, body: {} });"
      ).unresolved
    ).toBe('threadName, inputMark are not a string literal');
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

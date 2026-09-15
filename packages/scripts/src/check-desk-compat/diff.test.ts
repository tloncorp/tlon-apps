import { describe, expect, it } from 'vitest';

import { diffInventories, renderMarkdown, renderText, sitesOf } from './diff';
import { Dependency, extractFile } from './extract';

const FILE = 'packages/api/src/client/thing.ts';

/** Real extractor output, so the diff is keyed the way the report is. */
function client(body: string): Dependency[] {
  const out: Dependency[] = [];
  extractFile(
    FILE,
    `import { poke, scry, subscribe } from './urbit';\n${body}`,
    out
  );
  return out;
}

const refs = { base: 'base', head: 'head' };
const diff = (base: string, head: string) =>
  diffInventories(client(base), client(head));

const SCRY_V2 =
  "export const f = () => scry({ app: 'groups', path: '/v2/groups' });";
const SCRY_V3 =
  "export const f = () => scry({ app: 'groups', path: '/v3/groups' });";
const POKE_CHAT_1 =
  "export const g = () => poke({ app: 'chat', mark: 'chat-action-1', json: {} });";
const POKE_CHAT_2 =
  "export const g = () => poke({ app: 'chat', mark: 'chat-action-2', json: {} });";
const SUBSCRIBE_UNREADS =
  "export const h = () => subscribe({ app: 'channels', path: '/v1/unreads' }, () => {});";

describe('an unchanged inventory', () => {
  it('is the summary line and nothing else', () => {
    const result = diff(SCRY_V2, SCRY_V2);
    expect(result).toEqual({ added: [], changed: [], removed: [] });
    expect(renderText(result, refs)).toBe('0 added, 0 changed, 0 removed');
  });

  it('still says so in markdown, so a stale comment cannot linger', () => {
    const rendered = renderMarkdown(diff(SCRY_V2, SCRY_V2), refs);
    expect(rendered).toContain('**0 added, 0 changed, 0 removed**');
    expect(rendered).toContain('no desk request to review');
    expect(rendered).not.toContain('### Added');
  });
});

it('reports a request the branch adds', () => {
  const result = diff(SCRY_V2, `${SCRY_V2}\n${SUBSCRIBE_UNREADS}`);
  expect(result.added.map((r) => r.key)).toEqual([
    'subscribe channels /v1/unreads',
  ]);
  expect(sitesOf(result.added[0])).toEqual([`${FILE}:3`]);
  expect(result.changed).toEqual([]);
  expect(result.removed).toEqual([]);
});

it('reports a request the branch drops', () => {
  const result = diff(`${SCRY_V2}\n${POKE_CHAT_1}`, SCRY_V2);
  expect(result.removed.map((r) => r.key)).toEqual(['poke chat chat-action-1']);
  expect(result.added).toEqual([]);
  expect(result.changed).toEqual([]);
});

describe("an added request's call sites", () => {
  it('name the guard that reaches them, when there is one', () => {
    const result = diff(UNBRANCHED, BRANCHED);
    expect(result.added.map((r) => r.key)).toEqual([
      'poke chat chat-club-action-2',
    ]);
    expect(renderText(result, refs)).toContain(
      `${POKE_SITE} (guard: ! (flag))`
    );
    // The guard is its own span, so it is never swallowed into the site's.
    expect(renderMarkdown(result, refs)).toContain(
      `\`${POKE_SITE}\` (guard: \`! (flag)\`)`
    );
  });

  it('say nothing about a guard when the call is unconditional', () => {
    const result = diff(SCRY_V2, `${SCRY_V2}\n${SUBSCRIBE_UNREADS}`);
    expect(renderText(result, refs)).toContain(`      ${FILE}:3`);
    expect(renderText(result, refs)).not.toContain('guard');
    expect(renderMarkdown(result, refs)).toContain(`— \`${FILE}:3\``);
    expect(renderMarkdown(result, refs)).not.toContain('(guard:');
  });
});

describe('a call site that survives a change to what it asks for', () => {
  it('is one change, not an unrelated add beside an unrelated remove', () => {
    const result = diff(SCRY_V2, SCRY_V3);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].before.key).toBe('scry groups /v2/groups');
    expect(result.changed[0].after.key).toBe('scry groups /v3/groups');
    expect(renderText(result, refs)).toBe(
      [
        'Desk requests: base -> head',
        '',
        '0 added, 1 changed, 0 removed',
        '',
        'changed',
        '  scry %groups',
        '    /v2/groups -> /v3/groups',
        `      ${FILE}:2`,
      ].join('\n')
    );
  });

  it('pairs only within a surface', () => {
    const result = diff(
      SCRY_V2,
      "export const f = () => subscribe({ app: 'groups', path: '/v2/groups' }, () => {});"
    );
    expect(result.changed).toEqual([]);
    expect(result.added.map((r) => r.key)).toEqual([
      'subscribe groups /v2/groups',
    ]);
    expect(result.removed.map((r) => r.key)).toEqual([
      'scry groups /v2/groups',
    ]);
  });

  it('names both agents when the request changed agent', () => {
    const result = diff(
      SCRY_V3,
      "export const f = () => scry({ app: 'groups-ui', path: '/v3/groups' });"
    );
    expect(result.changed).toHaveLength(1);
    // Entries are grouped by the agent the request ends up at, so the one it
    // came from has to be in the label or the move is invisible.
    expect(renderText(result, refs)).toContain('  scry %groups-ui');
    expect(renderText(result, refs)).toContain(
      '    %groups -> %groups-ui  /v3/groups'
    );
    expect(renderMarkdown(result, refs)).toContain(
      '- `%groups -> %groups-ui  /v3/groups` —'
    );
  });

  it('names the path alone when the agent did not change', () => {
    const result = diff(SCRY_V2, SCRY_V3);
    expect(renderText(result, refs)).toContain('    /v2/groups -> /v3/groups');
    expect(renderText(result, refs)).not.toContain('%groups ->');
    expect(renderMarkdown(result, refs)).toContain(
      '- `/v2/groups -> /v3/groups` —'
    );
  });

  it('falls back to an add and a remove when the call site also moved', () => {
    const result = diff(SCRY_V2, `const unrelated = 1;\n${SCRY_V3}`);
    expect(result.changed).toEqual([]);
    expect(result.added.map((r) => r.key)).toEqual(['scry groups /v3/groups']);
    expect(result.removed.map((r) => r.key)).toEqual([
      'scry groups /v2/groups',
    ]);
  });
});

// A guard is recorded when a whitelisted poke-params helper branches. Both
// helper bodies are two lines, so the `poke` call stays on the same line and
// only the guard differs between the two fixtures.
const DM = "return { app: 'chat', mark: 'chat-dm-action-2', json: {} };";
const CLUB = "return { app: 'chat', mark: 'chat-club-action-2', json: {} };";
const helper = (first: string, second: string) =>
  [
    'function chatAction(flag: boolean) {',
    `  ${first}`,
    `  ${second}`,
    '}',
    'export const f = (flag: boolean) => poke(chatAction(flag));',
  ].join('\n');
const POKE_SITE = `${FILE}:6`;
const BRANCHED = helper(`if (flag) ${DM}`, CLUB);
const UNBRANCHED = helper('// the club branch is gone', DM);

describe('a request whose key is unchanged', () => {
  it('is changed when it gains a call site', () => {
    const result = diff(
      SCRY_V2,
      `${SCRY_V2}\nexport const g = () => scry({ app: 'groups', path: '/v2/groups' });`
    );
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].after.key).toBe('scry groups /v2/groups');
    expect(result.changed[0].moved).toEqual({
      added: [`${FILE}:3`],
      removed: [],
      guards: [],
    });
  });

  it('is changed when it loses a call site', () => {
    const result = diff(
      `${SCRY_V2}\nexport const g = () => scry({ app: 'groups', path: '/v2/groups' });`,
      SCRY_V2
    );
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].moved).toEqual({
      added: [],
      removed: [`${FILE}:3`],
      guards: [],
    });
  });

  it('is changed when a guard is removed at a site that stayed put', () => {
    const result = diff(BRANCHED, UNBRANCHED);
    expect(result.changed).toHaveLength(1);
    const change = result.changed[0];
    expect(change.after.key).toBe('poke chat chat-dm-action-2');
    expect(change.moved).toEqual({
      added: [],
      removed: [],
      guards: [{ site: POKE_SITE, before: 'flag', after: undefined }],
    });
    // The branch the guard used to protect is gone outright.
    expect(result.removed.map((r) => r.key)).toEqual([
      'poke chat chat-club-action-2',
    ]);
    expect(result.added).toEqual([]);
  });

  it('is changed when a guard is added at a site that stayed put', () => {
    const result = diff(UNBRANCHED, BRANCHED);
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].moved?.guards).toEqual([
      { site: POKE_SITE, before: undefined, after: 'flag' },
    ]);
    expect(result.added.map((r) => r.key)).toEqual([
      'poke chat chat-club-action-2',
    ]);
  });

  it('is not changed when only its line numbers shifted', () => {
    const result = diff(SCRY_V2, `const unrelated = 1;\n${SCRY_V2}`);
    expect(result).toEqual({ added: [], changed: [], removed: [] });
  });

  it('is changed when one of two co-located branches is dropped', () => {
    const club =
      "return { app: 'chat', mark: 'chat-club-action-2', json: {} };";
    const both = [
      'function chatAction(a: boolean, b: boolean) {',
      `  if (a) ${club}`,
      `  if (b) ${club}`,
      `  ${DM}`,
      '}',
      'export const f = (a: boolean, b: boolean) => poke(chatAction(a, b));',
    ].join('\n');
    const one = both.replace(
      `  if (b) ${club}`,
      '  // the second branch is gone'
    );
    const change = diff(both, one).changed.find(
      (c) => c.after.key === 'poke chat chat-club-action-2'
    );
    // Both branches poke the same mark from the same line, so the guard is the
    // only thing telling the two records apart.
    expect(change?.moved?.removed).toEqual([`${FILE}:7`]);
  });

  it('is not changed when a guarded and an unguarded site swap lines', () => {
    const guarded = 'export const f = (a: boolean) => poke(chatAction(a));';
    const plain = `export const g = () => poke({ app: 'chat', mark: 'chat-dm-action-2', json: {} });`;
    const body = (last: string[]) =>
      [
        'function chatAction(a: boolean) {',
        `  if (a) ${DM}`,
        `  ${CLUB}`,
        '}',
        ...last,
      ].join('\n');
    // Matching on file+guard before file+line is what keeps this quiet: pairing
    // by line first would read the swap as two guards changing in place.
    expect(diff(body([guarded, plain]), body([plain, guarded]))).toEqual({
      added: [],
      changed: [],
      removed: [],
    });
  });

  it('renders what moved rather than every site it is made from', () => {
    const result = diff(
      SCRY_V2,
      `${SCRY_V2}\nexport const g = () => scry({ app: 'groups', path: '/v2/groups' });`
    );
    expect(renderText(result, refs)).toBe(
      [
        'Desk requests: base -> head',
        '',
        '0 added, 1 changed, 0 removed',
        '',
        'changed',
        '  scry %groups',
        '    /v2/groups',
        `      call site added: ${FILE}:3`,
      ].join('\n')
    );
    const md = renderMarkdown(result, refs);
    expect(md).toContain('- `/v2/groups`\n');
    expect(md).toContain(`  - call site added: \`${FILE}:3\``);
  });

  it('caps what moved, so a wholesale move cannot flood the comment', () => {
    const calls = (n: number) =>
      Array.from(
        { length: n },
        (_, i) =>
          `export const f${i} = () => scry({ app: 'groups', path: '/v2/groups' });`
      ).join('\n');
    const rendered = renderText(diff(calls(10), calls(1)), refs);
    expect(rendered.match(/call site removed/g)).toHaveLength(6);
    expect(rendered).toContain('+3 more');
  });

  it('sets guard text off as code, so a backtick cannot break the comment', () => {
    const backticked = helper(`if (tag === \`x\`) ${DM}`, CLUB);
    const result = diff(backticked, UNBRANCHED);
    expect(result.changed[0].moved?.guards[0].before).toBe('tag === `x`');
    const note = renderMarkdown(result, refs)
      .split('\n')
      .find((l) => l.includes('guard removed'));
    expect(note).toBe(
      `  - guard removed at \`${POKE_SITE}\`, was: \`tag === 'x'\``
    );
  });
});

it('marks an added request the extractor could not resolve', () => {
  const rendered = renderMarkdown(
    diff(
      SCRY_V2,
      `${SCRY_V2}\nexport const g = (app: string) => scry({ app, path: '/v1/x' });`
    ),
    refs
  );
  expect(rendered).toContain('_(unresolved:');
});

describe('the markdown report', () => {
  const rendered = renderMarkdown(
    diff(
      `${SCRY_V2}\n${POKE_CHAT_1}`,
      `${SCRY_V3}\n${POKE_CHAT_2}\n${SUBSCRIBE_UNREADS}`
    ),
    refs
  );

  it('leads with the refs and the one-line summary', () => {
    expect(rendered.split('\n').slice(0, 5)).toEqual([
      '## Desk requests',
      '',
      '`base` → `head`',
      '',
      '**1 added, 2 changed, 0 removed**',
    ]);
  });

  it('groups entries by kind and agent, each with file:line', () => {
    expect(rendered).toContain('### Added');
    expect(rendered).toContain('**subscribe %channels**');
    expect(rendered).toContain(`- \`/v1/unreads\` — \`${FILE}:4\``);
    expect(rendered).toContain('### Changed');
    expect(rendered).toContain('**scry %groups**');
    expect(rendered).toContain(
      `- \`/v2/groups -> /v3/groups\` — \`${FILE}:2\``
    );
    expect(rendered).toContain('**poke %chat**');
    expect(rendered).toContain(
      `- \`chat-action-1 -> chat-action-2\` — \`${FILE}:3\``
    );
  });

  it('omits a section with nothing in it', () => {
    expect(rendered).not.toContain('### Removed');
  });

  it('scopes the N-1 check to added and changed, and says it is advisory', () => {
    expect(rendered).toContain('For every **added** and **changed** request');
    expect(rendered).toContain(
      'A **removed** request bears only on desk removal, not on this client'
    );
    expect(rendered).toContain('nothing here fails CI');
  });
});

it('names a few call sites and counts the rest', () => {
  const many = Array.from(
    { length: 9 },
    (_, i) =>
      `export const f${i} = () => poke({ app: 'chat', mark: 'chat-action-1', json: {} });`
  ).join('\n');
  const rendered = renderText(diffInventories([], client(many)), refs);
  expect(rendered.match(/thing\.ts:\d+/g)).toHaveLength(6);
  expect(rendered).toContain('+3 more');
});

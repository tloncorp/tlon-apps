import { describe, expect, it } from 'vitest';

import { diffInventories, renderMarkdown, renderText } from './diff';
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
  expect(result.added[0].sites).toEqual([`${FILE}:3`]);
  expect(result.changed).toEqual([]);
  expect(result.removed).toEqual([]);
});

it('reports a request the branch drops', () => {
  const result = diff(`${SCRY_V2}\n${POKE_CHAT_1}`, SCRY_V2);
  expect(result.removed.map((r) => r.key)).toEqual(['poke chat chat-action-1']);
  expect(result.added).toEqual([]);
  expect(result.changed).toEqual([]);
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

  it('falls back to an add and a remove when the call site also moved', () => {
    const result = diff(SCRY_V2, `const unrelated = 1;\n${SCRY_V3}`);
    expect(result.changed).toEqual([]);
    expect(result.added.map((r) => r.key)).toEqual(['scry groups /v3/groups']);
    expect(result.removed.map((r) => r.key)).toEqual([
      'scry groups /v2/groups',
    ]);
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

  it('tells the reader it is advisory', () => {
    expect(rendered).toContain('never fails CI');
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

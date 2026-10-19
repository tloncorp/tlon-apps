import { describe, expect, it } from '@jest/globals';

import { parseE2eGroupCommand } from '../lib/automatedTestGroupCommand';

const BASE = 'io.tlon.groups://e2e/group';

function link(params: Record<string, string>) {
  return `${BASE}?${new URLSearchParams(params).toString()}`;
}

describe('parseE2eGroupCommand', () => {
  it('parses a basic-group create command', () => {
    expect(
      parseE2eGroupCommand(
        `${BASE}?op=create-template&template=basic-group&title=QA-r1234-000033-wpiww0`
      )
    ).toEqual({
      ok: true,
      command: {
        op: 'create-template',
        templateId: 'basic-group',
        title: 'QA-r1234-000033-wpiww0',
      },
    });
  });

  it('accepts any known template', () => {
    expect(
      parseE2eGroupCommand(
        link({ op: 'create-template', template: 'book-club', title: 'Books' })
      )
    ).toEqual({
      ok: true,
      command: {
        op: 'create-template',
        templateId: 'book-club',
        title: 'Books',
      },
    });
  });

  it('ignores links addressed elsewhere', () => {
    const query = '?op=create-template&template=basic-group&title=QA';
    expect(parseE2eGroupCommand(`io.tlon.groups://e2e/db${query}`)).toBeNull();
    expect(
      parseE2eGroupCommand(`io.tlon.groups://e2e/sync${query}`)
    ).toBeNull();
    expect(
      parseE2eGroupCommand(`io.tlon.groups://e2e/group/extra${query}`)
    ).toBeNull();
    expect(
      parseE2eGroupCommand(`io.tlon.groups://other/group${query}`)
    ).toBeNull();
    expect(parseE2eGroupCommand(`https://tlon.io/group${query}`)).toBeNull();
    expect(parseE2eGroupCommand('not a url')).toBeNull();
  });

  it('rejects an unknown or missing op', () => {
    expect(
      parseE2eGroupCommand(
        link({ op: 'delete', template: 'basic-group', title: 'QA' })
      )
    ).toEqual({ ok: false, error: 'unknown op "delete"' });
    expect(
      parseE2eGroupCommand(link({ template: 'basic-group', title: 'QA' }))
    ).toEqual({ ok: false, error: 'unknown op ""' });
  });

  it('rejects an unknown or missing template', () => {
    expect(
      parseE2eGroupCommand(
        link({ op: 'create-template', template: 'no-such', title: 'QA' })
      )
    ).toEqual({ ok: false, error: 'unknown template "no-such"' });
    expect(
      parseE2eGroupCommand(
        link({ op: 'create-template', template: 'constructor', title: 'QA' })
      )
    ).toEqual({ ok: false, error: 'unknown template "constructor"' });
    expect(
      parseE2eGroupCommand(link({ op: 'create-template', title: 'QA' }))
    ).toEqual({ ok: false, error: 'unknown template ""' });
  });

  it('rejects a missing, empty or blank title', () => {
    const error = { ok: false, error: 'title is required' };
    expect(
      parseE2eGroupCommand(
        link({ op: 'create-template', template: 'basic-group' })
      )
    ).toEqual(error);
    expect(
      parseE2eGroupCommand(
        link({ op: 'create-template', template: 'basic-group', title: '' })
      )
    ).toEqual(error);
    expect(
      parseE2eGroupCommand(
        link({ op: 'create-template', template: 'basic-group', title: '   ' })
      )
    ).toEqual(error);
  });

  it('bounds the title at the group name limit, after trimming', () => {
    const atLimit = 'x'.repeat(30);
    expect(
      parseE2eGroupCommand(
        link({
          op: 'create-template',
          template: 'basic-group',
          title: `  ${atLimit}  `,
        })
      )
    ).toEqual({
      ok: true,
      command: {
        op: 'create-template',
        templateId: 'basic-group',
        title: atLimit,
      },
    });
    expect(
      parseE2eGroupCommand(
        link({
          op: 'create-template',
          template: 'basic-group',
          title: 'x'.repeat(31),
        })
      )
    ).toEqual({
      ok: false,
      error: 'title is longer than 30 characters',
    });
  });

  it('round-trips an encoded title', () => {
    const title = 'QA a&b=c?d/é+';
    const result = parseE2eGroupCommand(
      `${BASE}?op=create-template&template=basic-group&title=${encodeURIComponent(title)}`
    );
    expect(result).toEqual({
      ok: true,
      command: { op: 'create-template', templateId: 'basic-group', title },
    });
  });
});

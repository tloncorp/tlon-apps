// tests/prompt.test.ts
import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { UsageError, flag, safeName } from '../src/cli-util';
import { editHidden } from '../src/prompt';

describe('flag', () => {
  it('returns the value, undefined when absent, and a usage error when the value is missing', () => {
    expect(flag(['--scope', '/p'], '--scope')).toBe('/p');
    expect(flag([], '--scope')).toBeUndefined();
    expect(() => flag(['--scope'], '--scope')).toThrow(UsageError);
    expect(() => flag(['--scope', '--yes'], '--scope')).toThrow('--scope needs a value');
  });
  it('safeName keeps file names portable', () => expect(safeName('a b/c:d')).toBe('a_b_c_d'));
});

describe('editHidden', () => {
  it('treats DEL and ^H as backspace and drops escape sequences', () => {
    expect(editHidden('', 'abc\u007fd\bx\r')).toEqual({ s: 'abx', done: true, esc: 0 });
    expect(editHidden('', 'a\u001b[Db\u001b[1;5Cc\n').s).toBe('abc');
  });
  it('keeps escape state across chunks', () => {
    const a = editHidden('', 'k\u001b['); expect(a.done).toBe(false);
    expect(editHidden(a.s, 'Aey\r', a.esc).s).toBe('key');
  });
});

describe('ask', () => {
  it('rejects instead of hanging when stdin ends without an answer', async () => {
    const src = `import { ask } from '${join(import.meta.dir, '..', 'src', 'prompt.ts')}'; ask('Ship URL:', '', '--ship-url').then(() => process.exit(0), (e) => { console.error(e.message); process.exit(3); });`;
    const r = Bun.spawn(['bun', '-e', src], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
    const [err, code] = await Promise.all([new Response(r.stderr).text(), r.exited]);
    expect(code).toBe(3); expect(err).toContain('input ended; pass --ship-url instead');
  });
});

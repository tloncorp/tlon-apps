// tests/redact.test.ts
import { describe, expect, it } from 'bun:test';
import { redact } from '../src/redact';

describe('redact', () => {
  const cases: [string, string][] = [
    ['code lidlut-tabwed-pillex-ridrup here', 'code [redacted:urbit-code] here'],
    ['Cookie: urbauth-~zod=0v3.abc.def; Path=/', 'Cookie: [redacted:urbauth-cookie]; Path=/'],
    ['X-Api-Key: 0v1.2345.abcde', 'X-Api-Key: [redacted:api-key]'],
    ['Authorization: Bearer eyJabc.def', 'Authorization: Bearer [redacted:bearer]'],
    ['key=sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123', 'key=[redacted:provider-key]'],
    ['AKIAIOSFODNN7EXAMPLE', '[redacted:aws-key]'],
    ['ghp_abcdefghijklmnopqrstuvwxyz0123456789', '[redacted:github-token]'],
    ['xoxb-1234-5678-abcdefgh', '[redacted:slack-token]'],
    ['password=hunter2&x=1', 'password=[redacted:password]&x=1'],
    ['plain text with no secrets', 'plain text with no secrets'],
  ];
  for (const [input, want] of cases) it(input.slice(0, 30), () => expect(redact(input)).toBe(want));
  it('does not touch ordinary hyphenated words', () => {
    expect(redact('well-known long-running')).toBe('well-known long-running');
  });
});

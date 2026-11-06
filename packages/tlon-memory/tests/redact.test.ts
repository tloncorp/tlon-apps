// tests/redact.test.ts
import { describe, expect, it } from 'bun:test';
import { redact } from '../src/redact';

describe('redact', () => {
  const cases: [string, string][] = [
    ['code lidlut-tabwed-pillex-ridrup here', 'code [redacted:urbit-code] here'],
    ['Cookie: urbauth-~zod=0v3.abc.def; Path=/', 'Cookie: [redacted:urbauth-cookie]; Path=/'],
    ['X-Api-Key: 0v1.2345.abcde', 'X-Api-Key: [redacted:api-key]'],
    ['curl -H "x-api-key: 0v1.2345~ab+cd"', 'curl -H "x-api-key: [redacted:api-key]'],
    ['{"apiKey": "abc123", "x": 1}', '{"apiKey": "[redacted:api-key]", "x": 1}'],
    ['API_KEY=abc123 next', 'API_KEY=[redacted:api-key] next'],
    ['Authorization: Bearer eyJabc.def', 'Authorization: Bearer [redacted:bearer]'],
    ['Authorization: Bearer abc/def+ghi==', 'Authorization: Bearer [redacted:bearer]'],
    ['Authorization: Basic dXNlcjpwYXNz', 'Authorization: Basic [redacted:basic-auth]'],
    ['key=sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123', 'key=[redacted:provider-key]'],
    ['AKIAIOSFODNN7EXAMPLE', '[redacted:aws-key]'],
    ['ghp_abcdefghijklmnopqrstuvwxyz0123456789', '[redacted:github-token]'],
    ['github_pat_11ABCDEFG0123456789_abcdefghijklmnop', '[redacted:github-token]'],
    ['gho_abcdefghijklmnopqrstuvwxyz0123', '[redacted:github-token]'],
    ['ghs_abcdefghijklmnopqrstuvwxyz0123', '[redacted:github-token]'],
    ['xoxb-1234-5678-abcdefgh', '[redacted:slack-token]'],
    ['password=hunter2&x=1', 'password=[redacted:password]&x=1'],
    ['DB_PASSWORD=hunter2', 'DB_PASSWORD=[redacted:password]'],
    ['  password: hunter2', '  password: [redacted:password]'],
    ['-----BEGIN RSA PRIVATE KEY-----\nMIIEow\nabc\n-----END RSA PRIVATE KEY-----', '[redacted:private-key]'],
    ['-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY----- tail', '[redacted:private-key] tail'],
    ['plain text with no secrets', 'plain text with no secrets'],
  ];
  for (const [input, want] of cases) it(input.slice(0, 30), () => expect(redact(input)).toBe(want));
  it('does not touch ordinary hyphenated words', () => {
    expect(redact('well-known long-running')).toBe('well-known long-running');
  });
  it('leaves moon names alone', () => {
    expect(redact('ship ~doznec-salfun-sampel-palnet is up')).toBe('ship ~doznec-salfun-sampel-palnet is up');
  });
  it('replaces known literal secrets wherever they appear', () => {
    expect(redact('the key is 0v5.abcd.efgh, again 0v5.abcd.efgh', ['0v5.abcd.efgh'])).toBe('the key is [redacted:known-secret], again [redacted:known-secret]');
    expect(redact('nothing here', [''])).toBe('nothing here');
  });
});

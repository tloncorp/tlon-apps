import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { tlonPlugin } from './channel.js';
import { sanitizeTlonReplyText } from './monitor/output.js';

const TRACE_TEXT = [
  '## Report',
  '<tool_call>{"name":"private_exec","arguments":{"cmd":"ls"}}</tool_call>',
  '⚠️ 🛠️ `read private file (agent)` failed',
  'All good.',
].join('\n');

function expectCleaned(text: string) {
  expect(text).toContain('## Report');
  expect(text).toContain('All good.');
  expect(text).not.toContain('tool_call');
  expect(text).not.toContain('private_exec');
  expect(text).not.toContain('🛠️');
}

describe('outbound text sanitization', () => {
  it('strips tool-call blocks and tool-failure banners on the outbound adapter', () => {
    const sanitize = tlonPlugin.outbound?.sanitizeText;
    expect(sanitize).toBeTypeOf('function');
    expectCleaned(
      sanitize!({ text: TRACE_TEXT, payload: { text: TRACE_TEXT } })
    );
  });

  it('cleans an assistant reply with a tool-call block on the monitor path', () => {
    expectCleaned(sanitizeTlonReplyText(TRACE_TEXT, 'final'));
  });

  it('keeps an intentional tool-progress summary on the monitor path', () => {
    expect(sanitizeTlonReplyText('📖 Read: notes/todo.md', 'tool')).toBe(
      '📖 Read: notes/todo.md'
    );
  });
});

// monitorTlonProvider is not unit-testable (see owner-tool-posts-wiring), so
// the deliver callback's call site is pinned at the source level.
describe('monitor deliver sanitization wiring', () => {
  it('sanitizes payload text by kind before the empty-payload check', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(
      path.resolve(here, './monitor/index.ts'),
      'utf8'
    );
    const start = source.indexOf(
      'deliver: async (payload: ReplyPayload, info) => {'
    );
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('if (!replyText && !blob) {', start);
    expect(end).toBeGreaterThan(start);
    const deliver = source.slice(start, end);
    expect(deliver).toMatch(
      /let replyText = sanitizeTlonReplyText\(\s*payload\.text \?\? '',\s*info\.kind\s*\);/
    );
    expect(deliver.match(/payload\.text/g)).toHaveLength(1);
  });
});

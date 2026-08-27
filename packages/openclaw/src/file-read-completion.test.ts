import { describe, expect, it } from 'vitest';

import {
  createFileReadCompletionGuard,
  isIncompleteFileDeliveryReply,
} from './file-read-completion.js';

const CSV = `date,pollen_count,notes
2026-08-01,42,low
2026-08-02,117,high`;

function successfulRead(runId: string, text: string = CSV) {
  return {
    runId,
    toolName: 'read',
    result: { content: [{ type: 'text', text }] },
  };
}

describe('file read completion guard', () => {
  it.each([
    'Opening the CSV now.',
    "I'll read the current CSV and paste its contents.",
    "I'm opening the pollen log now.",
    'That’s the complete revised v0.1.1 text displayed inline.',
    'Here are the requested contents:',
    'The file contents are below.',
  ])('recognizes an incomplete delivery draft: %s', (reply) => {
    expect(isIncompleteFileDeliveryReply(reply)).toBe(true);
  });

  it.each([
    'The CSV contains 31 daily rows and peaks on August 20.',
    'Reading the file, I found 31 rows and a peak on August 20.',
    `${CSV}\n`,
    'I could not read the file because permission was denied.',
  ])('does not flag a substantive final reply: %s', (reply) => {
    expect(isIncompleteFileDeliveryReply(reply)).toBe(false);
  });

  it('requests at most two real-model revisions after a successful read', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('run-1'));

    const first = guard.beforeFinalize({
      runId: 'run-1',
      lastAssistantMessage: 'Opening the CSV now.',
    });
    expect(first).toMatchObject({
      action: 'revise',
      retry: {
        idempotencyKey: 'tlon:file-read-completion:run-1:1',
        maxAttempts: 2,
      },
    });
    expect(first?.retry.instruction).toContain('existing read result');
    expect(first?.retry.instruction).toContain(
      'summary, transformation, or inspection'
    );
    const second = guard.beforeFinalize({
      runId: 'run-1',
      lastAssistantMessage: 'Opening the CSV now.',
    });
    expect(second).toMatchObject({
      action: 'revise',
      retry: {
        idempotencyKey: 'tlon:file-read-completion:run-1:2',
        maxAttempts: 2,
      },
    });
    expect(second?.retry.instruction).toContain('final correction attempt');
    expect(
      guard.beforeFinalize({
        runId: 'run-1',
        lastAssistantMessage: 'Opening the CSV now.',
      })
    ).toBeNull();
  });

  it('does not revise when the final reply contains content from the read', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('run-content'));

    expect(
      guard.beforeFinalize({
        runId: 'run-content',
        lastAssistantMessage: `Here it is:\n\n${CSV}`,
      })
    ).toBeNull();
  });

  it('accepts delivered content after requesting a correction', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('run-corrected'));

    expect(
      guard.beforeFinalize({
        runId: 'run-corrected',
        lastAssistantMessage: 'Opening the CSV now.',
      })
    ).not.toBeNull();
    expect(
      guard.beforeFinalize({
        runId: 'run-corrected',
        lastAssistantMessage: `Here it is:\n\n${CSV}`,
      })
    ).toBeNull();
  });

  it('does not revise a normal summary after a successful read', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('run-summary'));

    expect(
      guard.beforeFinalize({
        runId: 'run-summary',
        lastAssistantMessage:
          'The file has 31 rows. Pollen levels rise sharply in the final week.',
      })
    ).toBeNull();
  });

  it('tracks a successful empty read and asks for an honest empty-file answer', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult({
      runId: 'empty',
      toolName: 'read',
      result: { content: [] },
    });

    const revision = guard.beforeFinalize({
      runId: 'empty',
      lastAssistantMessage: 'Opening the file now.',
    });
    expect(revision?.retry.instruction).toContain('file is empty');
    expect(
      guard.beforeFinalize({
        runId: 'empty',
        lastAssistantMessage: 'The file is empty.',
      })
    ).toBeNull();
  });

  it('recognizes delivered files whose lines are all short', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('short', 'a\nb\nc'));

    expect(
      guard.beforeFinalize({
        runId: 'short',
        lastAssistantMessage: 'Here it is:\n\na\nb\nc',
      })
    ).toBeNull();
  });

  it('allows another read when the successful result was truncated', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead('truncated', 'first chunk\n[Showing lines 1-20 of 40]')
    );

    const revision = guard.beforeFinalize({
      runId: 'truncated',
      lastAssistantMessage: 'Reading the rest now.',
    });
    expect(revision?.retry.instruction).toContain('Continue reading');
    expect(revision?.retry.instruction).not.toContain('Do not call read again');
  });

  it('preserves summaries and transformations instead of demanding a dump', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('summary-progress'));

    const revision = guard.beforeFinalize({
      runId: 'summary-progress',
      lastAssistantMessage: 'Checking the file now.',
    });
    expect(revision?.retry.instruction).toContain("user's original request");
    expect(revision?.retry.instruction).toContain(
      'summary, transformation, or inspection'
    );
    expect(revision?.retry.instruction).toContain('perform that instead');
  });

  it('ignores failed, non-read, and unkeyed tool results', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult({
      ...successfulRead('failed'),
      error: 'permission denied',
    });
    guard.recordToolResult({
      runId: 'details-error',
      toolName: 'read',
      result: {
        content: [{ type: 'text', text: 'Error: missing' }],
        details: { status: 'error' },
      },
    });
    guard.recordToolResult({
      runId: 'other',
      toolName: 'memory_search',
      result: { content: [{ type: 'text', text: CSV }] },
    });
    guard.recordToolResult({
      toolName: 'read',
      result: { content: [{ type: 'text', text: CSV }] },
    });

    for (const runId of ['failed', 'details-error', 'other']) {
      expect(
        guard.beforeFinalize({
          runId,
          lastAssistantMessage: 'Opening the file now.',
        })
      ).toBeNull();
    }
    expect(guard.trackedRunCount()).toBe(0);
  });

  it('clears completed runs and bounds missed cleanup', () => {
    const guard = createFileReadCompletionGuard({ maxTrackedRuns: 2 });
    guard.recordToolResult(successfulRead('oldest'));
    guard.recordToolResult(successfulRead('middle'));
    guard.recordToolResult(successfulRead('newest'));
    expect(guard.trackedRunCount()).toBe(2);

    expect(
      guard.beforeFinalize({
        runId: 'oldest',
        lastAssistantMessage: 'Opening now.',
      })
    ).toBeNull();
    expect(
      guard.beforeFinalize({
        runId: 'newest',
        lastAssistantMessage: 'Opening now.',
      })
    ).not.toBeNull();

    guard.clear('newest');
    expect(guard.trackedRunCount()).toBe(1);
  });
});

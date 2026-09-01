import { describe, expect, it } from 'vitest';

import {
  createFileReadCompletionGuard,
  isIncompleteFileDeliveryReply,
} from './file-read-completion.js';

const CSV = `date,pollen_count,notes
2026-08-01,42,low
2026-08-02,117,high`;

function successfulRead(
  runId: string,
  text: string = CSV,
  path?: string,
  offset?: number
) {
  return {
    runId,
    toolName: 'read',
    ...(path
      ? { params: { path, ...(offset == null ? {} : { offset }) } }
      : {}),
    result: { content: [{ type: 'text', text }] },
  };
}

describe('file read completion guard', () => {
  it.each([
    'Opening the CSV now.',
    "I'll read the current CSV and paste its contents.",
    "I'm opening the pollen log now.",
    "I'm going to read the pollen log now.",
    "I'll now open the pollen log.",
    'Let me go ahead and check the pollen log.',
    'Pasting the CSV now.',
    'Displaying the requested file now.',
    'Showing the records now.',
    'Printing the summary now.',
    "I'll analyze the file now.",
    "I'll summarize the file now.",
    "I'll summarise the file now.",
    "I'll read the file now, then summarize it.",
    "I'll read the file now, and then summarize it.",
    'Reviewing the CSV now.',
    'Processing the data now.',
    'Reading the file is underway.',
    'Parsing the file now.',
    'Scanning the records now.',
    'That’s the complete revised v0.1.1 text displayed inline.',
    'Here are the requested contents:',
    'The file contents are below.',
  ])('recognizes an incomplete delivery draft: %s', (reply) => {
    expect(isIncompleteFileDeliveryReply(reply)).toBe(true);
  });

  it.each([
    '**Opening the CSV now.**',
    '- Opening the CSV now.',
    '> Reading the file now.',
    'NO_REPLY',
    "I've read the file.",
    'I have finished reading the file.',
    'I finished reading the file.',
    'Done reading the file.',
    'The file has been read.',
  ])('recognizes formatted or silent incomplete output: %s', (reply) => {
    expect(isIncompleteFileDeliveryReply(reply)).toBe(true);
  });

  it.each(['', '   \n'])(
    'revises a blank reply after a successful read',
    (reply) => {
      const guard = createFileReadCompletionGuard();
      guard.recordToolResult(successfulRead('blank-reply'));

      expect(
        guard.beforeFinalize({
          runId: 'blank-reply',
          lastAssistantMessage: reply,
        })
      ).not.toBeNull();
    }
  );

  it.each([
    'The CSV contains 31 daily rows and peaks on August 20.',
    'Reading the file, I found 31 rows and a peak on August 20.',
    "I've read the file and found 31 rows with an August 20 peak.",
    'Reading level is grade 5.',
    'Processing took 12 seconds.',
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

  it('does not revise a delivery heading followed by transformed output', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('run-translated'));

    expect(
      guard.beforeFinalize({
        runId: 'run-translated',
        lastAssistantMessage:
          'Here are the requested contents:\n\nDate, compte de pollen, notes\n1 août 2026, 42, faible',
      })
    ).toBeNull();
  });

  it('accepts transformed output on the same line as the delivery claim', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('run-same-line'));

    expect(
      guard.beforeFinalize({
        runId: 'run-same-line',
        lastAssistantMessage:
          'Here are the requested contents: Date, compte de pollen, notes — 1 août 2026, 42, faible',
      })
    ).toBeNull();
  });

  it('rejects a same-line promise without visible output', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('same-line-promise'));

    expect(
      guard.beforeFinalize({
        runId: 'same-line-promise',
        lastAssistantMessage: 'Here are the requested contents: see below.',
      })
    ).not.toBeNull();
  });

  it('rejects an empty delivery heading after a preamble', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('preamble-empty-heading'));

    expect(
      guard.beforeFinalize({
        runId: 'preamble-empty-heading',
        lastAssistantMessage:
          'I finished reading it.\nHere are the requested contents:',
      })
    ).not.toBeNull();
  });

  it('rejects an emphasized empty delivery heading', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('emphasized-empty-heading'));

    expect(
      guard.beforeFinalize({
        runId: 'emphasized-empty-heading',
        lastAssistantMessage: '**Here are the requested contents:**',
      })
    ).not.toBeNull();
  });

  it.each(['```csv\n```', '~~~text\n~~~'])(
    'rejects a delivery heading followed by an empty fenced block: %s',
    (fence) => {
      const guard = createFileReadCompletionGuard();
      guard.recordToolResult(successfulRead('empty-fence'));

      expect(
        guard.beforeFinalize({
          runId: 'empty-fence',
          lastAssistantMessage: `Here are the requested contents:\n${fence}`,
        })
      ).not.toBeNull();
    }
  );

  it.each([
    'Opening the summary now.',
    'Reading the records now.',
    'Displaying the results now.',
  ])(
    'does not mistake a requested object noun for completed work: %s',
    (reply) => {
      const guard = createFileReadCompletionGuard();
      guard.recordToolResult(successfulRead('object-noun'));

      expect(
        guard.beforeFinalize({
          runId: 'object-noun',
          lastAssistantMessage: reply,
        })
      ).not.toBeNull();
    }
  );

  it('does not accept one source anchor as complete raw-file delivery', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('run-partial'));

    expect(
      guard.beforeFinalize({
        runId: 'run-partial',
        lastAssistantMessage: `Here are the requested contents: ${CSV.split('\n')[0]}`,
      })
    ).not.toBeNull();
  });

  it('requires representative content after an explicit full-file claim', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('explicit-full-file'));

    expect(
      guard.beforeFinalize({
        runId: 'explicit-full-file',
        lastAssistantMessage: `The complete file is shown below:\n${CSV.split('\n')[0]}`,
      })
    ).not.toBeNull();
  });

  it('rejects an explicit full-file claim with no representative content', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('unrepresented-full-file'));

    expect(
      guard.beforeFinalize({
        runId: 'unrepresented-full-file',
        lastAssistantMessage:
          'The complete file is shown below:\nPlaceholder text unrelated to the read result.',
      })
    ).not.toBeNull();
  });

  it('requires both ends of a long single-line file', () => {
    const guard = createFileReadCompletionGuard();
    const longLine = `${'a'.repeat(220)}${'z'.repeat(220)}`;
    guard.recordToolResult(successfulRead('long-line', longLine));

    expect(
      guard.beforeFinalize({
        runId: 'long-line',
        lastAssistantMessage: `Here are the requested contents: ${longLine.slice(0, 180)}`,
      })
    ).not.toBeNull();
    expect(
      guard.beforeFinalize({
        runId: 'long-line',
        lastAssistantMessage: `Here are the requested contents: ${longLine}`,
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

  it('accepts a noun-subject result sentence after a read acknowledgment', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('acknowledged-summary'));

    expect(
      guard.beforeFinalize({
        runId: 'acknowledged-summary',
        lastAssistantMessage:
          "I've read the file. The title is Quarterly Report.",
      })
    ).toBeNull();
  });

  it.each([', and', ':', ' and'])(
    'accepts a result joined to the read acknowledgment with %s',
    (separator) => {
      const guard = createFileReadCompletionGuard();
      const runId = `joined-result-${separator}`;
      guard.recordToolResult(successfulRead(runId));

      expect(
        guard.beforeFinalize({
          runId,
          lastAssistantMessage: `I've read the file${separator} the title is Quarterly Report.`,
        })
      ).toBeNull();
    }
  );

  it('accepts a requested extract under a singular delivery heading', () => {
    const guard = createFileReadCompletionGuard();
    const lastRow = CSV.split('\n').at(-1) ?? '';
    guard.recordToolResult(successfulRead('requested-extract'));

    expect(
      guard.beforeFinalize({
        runId: 'requested-extract',
        lastAssistantMessage: `Here is the requested content: ${lastRow}`,
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

  it('rejects an empty-file claim after a non-empty read', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('false-empty'));

    expect(
      guard.beforeFinalize({
        runId: 'false-empty',
        lastAssistantMessage: 'The file is empty.',
      })
    ).not.toBeNull();
  });

  it('does not treat an empty filename in a progress update as an empty-file result', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('empty-name', '', '/tmp/empty.txt'));

    expect(
      guard.beforeFinalize({
        runId: 'empty-name',
        lastAssistantMessage: 'Opening empty.txt now.',
      })
    ).not.toBeNull();
    expect(
      guard.beforeFinalize({
        runId: 'empty-name',
        lastAssistantMessage: 'empty.txt is empty.',
      })
    ).toBeNull();
  });

  it('preserves a successful message-tool-only file delivery', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('message-tool-delivery'));
    guard.recordMessageDelivery({
      content: `Here are the requested contents:\n${CSV}`,
      runId: 'message-tool-delivery',
      sessionKey: 'session:source',
      success: true,
    });

    expect(
      guard.beforeFinalize({
        runId: 'message-tool-delivery',
        lastAssistantMessage: 'NO_REPLY',
        sessionKey: 'session:source',
      })
    ).toBeNull();
  });

  it('still revises after a failed message-tool delivery', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('failed-message-tool-delivery'));
    guard.recordMessageDelivery({
      content: `Here are the requested contents:\n${CSV}`,
      runId: 'failed-message-tool-delivery',
      sessionKey: 'session:source',
      success: false,
    });

    expect(
      guard.beforeFinalize({
        runId: 'failed-message-tool-delivery',
        lastAssistantMessage: 'NO_REPLY',
        sessionKey: 'session:source',
      })
    ).not.toBeNull();
  });

  it('credits a bounded message-tool delivery after checking user intent', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult({
      runId: 'bounded-message-delivery',
      toolName: 'read',
      params: { path: '/tmp/report.txt', limit: 3 },
      result: {
        content: [
          {
            type: 'text',
            text: 'first line\nsecond line\nthird line\n[Showing lines 1-3 of 40]',
          },
        ],
      },
    });
    guard.recordMessageDelivery({
      content:
        'The first three lines are:\nfirst line\nsecond line\nthird line',
      runId: 'bounded-message-delivery',
      sessionKey: 'session:source',
      success: true,
    });

    expect(
      guard.beforeFinalize({
        runId: 'bounded-message-delivery',
        lastAssistantMessage: 'NO_REPLY',
        messages: [{ role: 'user', content: 'Show the first three lines.' }],
        sessionKey: 'session:source',
      })
    ).toBeNull();
  });

  it('still revises after a message-tool progress update', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('message-tool-progress'));
    guard.recordMessageDelivery({
      content: 'Opening the CSV now.',
      runId: 'message-tool-progress',
      sessionKey: 'session:source',
      success: true,
    });

    expect(
      guard.beforeFinalize({
        runId: 'message-tool-progress',
        lastAssistantMessage: 'NO_REPLY',
        sessionKey: 'session:source',
      })
    ).not.toBeNull();
  });

  it('resets message-tool delivery when a later read adds new work', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead('delivery-then-read', CSV, '/tmp/a.csv')
    );
    guard.recordMessageDelivery({
      content: `Here are the requested contents:\n${CSV}`,
      runId: 'delivery-then-read',
      sessionKey: 'session:source',
      success: true,
    });
    guard.recordToolResult(
      successfulRead(
        'delivery-then-read',
        'name,value\nsecond,2\nthird,3',
        '/tmp/b.csv'
      )
    );

    expect(
      guard.beforeFinalize({
        runId: 'delivery-then-read',
        lastAssistantMessage: 'NO_REPLY',
        sessionKey: 'session:source',
      })
    ).not.toBeNull();
  });

  it('does not credit file delivery to a different conversation', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('cross-conversation-delivery'));
    guard.recordMessageDelivery({
      content: `Here are the requested contents:\n${CSV}`,
      runId: 'cross-conversation-delivery',
      sessionKey: 'session:other',
      success: true,
    });

    expect(
      guard.beforeFinalize({
        runId: 'cross-conversation-delivery',
        lastAssistantMessage: 'NO_REPLY',
        sessionKey: 'session:source',
      })
    ).not.toBeNull();
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

  it('does not accept sampled lines as a complete truncated delivery', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'truncated-delivery',
        'first line\nsecond line\nthird line\n[Showing lines 1-20 of 40]'
      )
    );

    expect(
      guard.beforeFinalize({
        runId: 'truncated-delivery',
        lastAssistantMessage:
          'Here are the requested contents:\nfirst line\nsecond line\nthird line',
      })?.retry.instruction
    ).toContain('Continue reading');
  });

  it('does not accept unmarked partial output from a truncated read', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'truncated-plain-output',
        'first line\nsecond line\n[Showing lines 1-20 of 40]'
      )
    );

    expect(
      guard.beforeFinalize({
        runId: 'truncated-plain-output',
        lastAssistantMessage: 'first line\nsecond line',
      })?.retry.instruction
    ).toContain('Continue reading');
  });

  it('accepts a fully represented explicitly bounded read', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult({
      runId: 'bounded-read',
      toolName: 'read',
      params: { path: '/tmp/report.txt', limit: 3 },
      result: {
        content: [
          {
            type: 'text',
            text: 'first line\nsecond line\nthird line\n[Showing lines 1-3 of 40]',
          },
        ],
      },
    });

    expect(
      guard.beforeFinalize({
        runId: 'bounded-read',
        lastAssistantMessage:
          'The requested first three lines are:\nfirst line\nsecond line\nthird line',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Show the first three lines.' }],
          },
        ],
      })
    ).toBeNull();

    expect(
      guard.beforeFinalize({
        runId: 'bounded-read',
        lastAssistantMessage:
          'The first chunk is:\nfirst line\nsecond line\nthird line',
        messages: [{ role: 'user', content: 'Show the complete file.' }],
      })?.retry.instruction
    ).toContain('Continue reading');
  });

  it('does not mistake a bracketed file heading for a truncation footer', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'reading-heading',
        '[Reading list]\nThe Left Hand of Darkness\nKindred'
      )
    );

    expect(
      guard.beforeFinalize({
        runId: 'reading-heading',
        lastAssistantMessage:
          'Here are the requested contents:\n[Reading list]\nThe Left Hand of Darkness\nKindred',
      })
    ).toBeNull();
  });

  it('preserves truncation when a later read result has no marker', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead('multi-read', 'first chunk\n[Showing lines 1-20 of 40]')
    );
    guard.recordToolResult(
      successfulRead('multi-read', 'unrelated short file')
    );

    const revision = guard.beforeFinalize({
      runId: 'multi-read',
      lastAssistantMessage: 'Reading the rest now.',
    });
    expect(revision?.retry.instruction).toContain('Continue reading');
  });

  it('clears truncation when a continuation for the same path reaches EOF', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'continued',
        'first chunk\n[Showing lines 1-20 of 40]',
        '/tmp/report.txt'
      )
    );
    guard.recordToolResult(
      successfulRead('continued', 'final chunk', '/tmp/report.txt', 21)
    );

    expect(
      guard.beforeFinalize({
        runId: 'continued',
        lastAssistantMessage:
          'Here are the requested contents:\nfirst chunk\nfinal chunk',
      })
    ).toBeNull();
  });

  it('requires representative content from every continued read chunk', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'continued-coverage',
        'header one\nheader two\nheader three\nheader four\n[Showing lines 1-20 of 40]',
        '/tmp/report.txt'
      )
    );
    guard.recordToolResult(
      successfulRead(
        'continued-coverage',
        'tail one\ntail two\ntail three\ntail four',
        '/tmp/report.txt',
        21
      )
    );

    expect(
      guard.beforeFinalize({
        runId: 'continued-coverage',
        lastAssistantMessage:
          'Here are the requested file contents:\ntail one\ntail two\ntail three\ntail four',
      })
    ).not.toBeNull();
  });

  it('normalizes equivalent paths when tracking a continuation', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'normalized-path',
        'first chunk\n[Showing lines 1-20 of 40]',
        './report.txt'
      )
    );
    guard.recordToolResult(
      successfulRead('normalized-path', 'final chunk', 'report.txt', 21)
    );

    expect(
      guard.beforeFinalize({
        runId: 'normalized-path',
        lastAssistantMessage:
          'Here are the requested contents:\nfirst chunk\nfinal chunk',
      })
    ).toBeNull();
  });

  it('lets a failed continuation recover at the same expected offset', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'failed-continuation',
        'first chunk\n[Showing lines 1-20 of 40]',
        '/tmp/report.txt'
      )
    );
    guard.recordToolResult({
      runId: 'failed-continuation',
      toolName: 'read',
      params: { path: '/tmp/report.txt', offset: 21 },
      error: 'temporary failure',
    });
    guard.recordToolResult(
      successfulRead(
        'failed-continuation',
        'final chunk',
        '/tmp/report.txt',
        21
      )
    );

    expect(
      guard.beforeFinalize({
        runId: 'failed-continuation',
        lastAssistantMessage:
          'Here are the requested contents:\nfirst chunk\nfinal chunk',
      })
    ).toBeNull();
  });

  it('does not clear truncation when a continuation skips the expected offset', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'skipped-continuation',
        'first chunk\n[Showing lines 1-20 of 40]',
        '/tmp/report.txt'
      )
    );
    guard.recordToolResult(
      successfulRead('skipped-continuation', 'last line', '/tmp/report.txt', 40)
    );

    expect(
      guard.beforeFinalize({
        runId: 'skipped-continuation',
        lastAssistantMessage: 'first chunk\nlast line',
      })?.retry.instruction
    ).toContain('Continue reading');
  });

  it('does not infer a continuation offset from a generic truncation marker', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'generic-truncation',
        'first chunk\n[Truncated output: original character count 4000]',
        '/tmp/report.txt'
      )
    );
    guard.recordToolResult(
      successfulRead(
        'generic-truncation',
        'final chunk',
        '/tmp/report.txt',
        2000
      )
    );

    expect(
      guard.beforeFinalize({
        runId: 'generic-truncation',
        lastAssistantMessage: 'first chunk\nfinal chunk',
      })?.retry.instruction
    ).toContain('Continue reading');
  });

  it('does not clear truncation when the same path is reread at the same offset', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'same-offset',
        'first chunk\n[Showing lines 1-20 of 40]',
        '/tmp/report.txt'
      )
    );
    guard.recordToolResult(
      successfulRead('same-offset', 'first chunk', '/tmp/report.txt')
    );

    expect(
      guard.beforeFinalize({
        runId: 'same-offset',
        lastAssistantMessage: 'first chunk',
      })?.retry.instruction
    ).toContain('Continue reading');
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

  it('does not require an auxiliary read target in the requested file delivery', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'later-target',
        'schema1\nschema2\nschema3\nschema4',
        '/tmp/schema.txt'
      )
    );
    guard.recordToolResult(
      successfulRead('later-target', 'b1\nb2\nb3\nb4\nb5\nb6', '/tmp/b.txt')
    );

    expect(
      guard.beforeFinalize({
        runId: 'later-target',
        lastAssistantMessage:
          'Here are the requested contents:\nb1\nb2\nb3\nb4\nb5\nb6',
      })
    ).toBeNull();
    expect(
      guard.beforeFinalize({
        runId: 'later-target',
        lastAssistantMessage:
          'Here are the requested contents:\nschema1\nschema2\nschema3\nschema4',
      })
    ).toBeNull();
  });

  it('does not select an earlier target from an ambiguous basename alone', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'same-basename',
        'template one\ntemplate two\ntemplate three\ntemplate four',
        '/templates/report.txt'
      )
    );
    guard.recordToolResult(
      successfulRead(
        'same-basename',
        'export one\nexport two\nexport three\nexport four',
        '/exports/report.txt'
      )
    );

    expect(
      guard.beforeFinalize({
        runId: 'same-basename',
        lastAssistantMessage:
          'Here are the requested report.txt contents:\nexport one\nexport two\nexport three\nexport four',
      })
    ).toBeNull();
  });

  it('does not select an earlier target whose name prefixes the requested path', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'prefix-target',
        'old one\nold two\nold three\nold four',
        '/tmp/report'
      )
    );
    guard.recordToolResult(
      successfulRead(
        'prefix-target',
        'new one\nnew two\nnew three\nnew four',
        '/tmp/report.txt'
      )
    );

    expect(
      guard.beforeFinalize({
        runId: 'prefix-target',
        lastAssistantMessage:
          'Here are the requested /tmp/report.txt contents:\nnew one\nnew two\nnew three\nnew four',
      })
    ).toBeNull();
  });

  it('resets stale anchors when an offset-zero reread establishes a fresh version', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'fresh-version',
        'old one\nold two\nold three\nold four',
        '/tmp/report.txt'
      )
    );
    guard.recordToolResult({
      runId: 'fresh-version',
      toolName: 'write',
      params: { path: '/tmp/report.txt' },
      result: { content: [{ type: 'text', text: 'updated' }] },
    });
    guard.recordToolResult(
      successfulRead(
        'fresh-version',
        'new one\nnew two\nnew three\nnew four',
        '/tmp/report.txt'
      )
    );

    expect(
      guard.beforeFinalize({
        runId: 'fresh-version',
        lastAssistantMessage:
          'Here are the requested file contents:\nnew one\nnew two\nnew three\nnew four',
      })
    ).toBeNull();
  });

  it('invalidates truncated read evidence after a successful file mutation', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'mutated-truncation',
        'old one\nold two\nold three\n[Showing lines 1-20 of 40]',
        '/tmp/report.txt'
      )
    );
    guard.recordToolResult({
      runId: 'mutated-truncation',
      toolName: 'write',
      params: { path: '/tmp/report.txt' },
      result: { content: [{ type: 'text', text: 'updated' }] },
    });
    guard.recordToolResult(
      successfulRead(
        'mutated-truncation',
        'new one\nnew two\nnew three\nnew four',
        '/tmp/report.txt'
      )
    );

    expect(
      guard.beforeFinalize({
        runId: 'mutated-truncation',
        lastAssistantMessage:
          'Here are the requested file contents:\nnew one\nnew two\nnew three\nnew four',
      })
    ).toBeNull();
  });

  it('invalidates truncated read evidence after apply_patch', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'patched-truncation',
        'old one\nold two\nold three\n[Showing lines 1-20 of 40]',
        '/tmp/report.txt'
      )
    );
    guard.recordToolResult({
      runId: 'patched-truncation',
      toolName: 'apply_patch',
      params: {
        patch:
          '*** Begin Patch\n*** Update File: tmp/report.txt\n@@\n-old one\n+new one\n*** End Patch',
      },
      result: { content: [{ type: 'text', text: 'Done!' }] },
    });
    guard.recordToolResult(
      successfulRead(
        'patched-truncation',
        'new one\nnew two\nnew three\nnew four',
        '/tmp/report.txt'
      )
    );

    expect(
      guard.beforeFinalize({
        runId: 'patched-truncation',
        lastAssistantMessage:
          'Here are the requested file contents:\nnew one\nnew two\nnew three\nnew four',
      })
    ).toBeNull();
  });

  it('does not select an auxiliary JSON target from shared structural anchors', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'json-target',
        '{\n  "schema": "v1",\n  "auxiliary": true\n}',
        '/tmp/schema.json'
      )
    );
    guard.recordToolResult(
      successfulRead(
        'json-target',
        '{\n  "title": "Quarterly Report",\n  "items": [1, 2, 3]\n}',
        '/tmp/report.json'
      )
    );

    expect(
      guard.beforeFinalize({
        runId: 'json-target',
        lastAssistantMessage:
          'Here are the requested file contents:\n{\n  "title": "Quarterly Report",\n  "items": [1, 2, 3]\n}',
      })
    ).toBeNull();
  });

  it('does not require a later auxiliary target when earlier content is explicit', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'requested-before-auxiliary',
        'report one\nreport two\nreport three\nreport four',
        '/tmp/report.txt'
      )
    );
    guard.recordToolResult(
      successfulRead(
        'requested-before-auxiliary',
        'schema one\nschema two\nschema three\nschema four',
        '/tmp/schema.txt'
      )
    );

    expect(
      guard.beforeFinalize({
        runId: 'requested-before-auxiliary',
        lastAssistantMessage:
          'Here are the requested report.txt contents:\nreport one\nreport two\nreport three\nreport four',
      })
    ).toBeNull();
  });

  it('does not require continuation of a truncated auxiliary read', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead(
        'truncated-auxiliary',
        'schema header\n[Showing lines 1-20 of 200]',
        '/tmp/schema.txt'
      )
    );
    guard.recordToolResult(
      successfulRead(
        'truncated-auxiliary',
        'b1\nb2\nb3\nb4\nb5\nb6',
        '/tmp/requested.csv'
      )
    );

    expect(
      guard.beforeFinalize({
        runId: 'truncated-auxiliary',
        lastAssistantMessage:
          'Here are the requested contents:\nb1\nb2\nb3\nb4\nb5\nb6',
      })
    ).toBeNull();
  });

  it('requires acknowledgment only when an empty target is selected', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead('mixed-targets', 'b1\nb2\nb3\nb4\nb5\nb6', '/tmp/data.txt')
    );
    guard.recordToolResult(
      successfulRead('mixed-targets', '', '/tmp/empty.txt')
    );

    expect(
      guard.beforeFinalize({
        runId: 'mixed-targets',
        lastAssistantMessage:
          'Here are the requested contents:\nb1\nb2\nb3\nb4\nb5\nb6',
      })
    ).toBeNull();
    expect(
      guard.beforeFinalize({
        runId: 'mixed-targets',
        lastAssistantMessage:
          'Here are the requested data.txt and empty.txt contents:\nb1\nb2\nb3\nb4\nb5\nb6',
      })
    ).not.toBeNull();
    expect(
      guard.beforeFinalize({
        runId: 'mixed-targets',
        lastAssistantMessage:
          'empty.txt is empty. Here are the requested contents from data.txt:\nb1\nb2\nb3\nb4\nb5\nb6',
      })
    ).toBeNull();
  });

  it('requires a separate result statement for every empty target', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('two-empty', '', '/tmp/a.txt'));
    guard.recordToolResult(successfulRead('two-empty', '', '/tmp/b.txt'));

    expect(
      guard.beforeFinalize({
        runId: 'two-empty',
        lastAssistantMessage: 'a.txt is empty; Opening b.txt now.',
      })
    ).not.toBeNull();
    expect(
      guard.beforeFinalize({
        runId: 'two-empty',
        lastAssistantMessage: 'a.txt still needs checking, but b.txt is empty.',
      })
    ).not.toBeNull();
    expect(
      guard.beforeFinalize({
        runId: 'two-empty',
        lastAssistantMessage: 'Both a.txt and b.txt are empty.',
      })
    ).toBeNull();
  });

  it('preserves distinct empty targets that share a basename', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(
      successfulRead('same-basename-empty', '', '/tmp/a/config.json')
    );
    guard.recordToolResult(
      successfulRead('same-basename-empty', '', '/tmp/b/config.json')
    );

    expect(
      guard.beforeFinalize({
        runId: 'same-basename-empty',
        lastAssistantMessage:
          '/tmp/a/config.json and /tmp/b/config.json are empty.',
      })
    ).toBeNull();
  });

  it('binds collective emptiness to the conjunctive subject', () => {
    const guard = createFileReadCompletionGuard();
    for (const name of ['a.txt', 'b.txt', 'c.txt']) {
      guard.recordToolResult(successfulRead('three-empty', '', `/tmp/${name}`));
    }

    expect(
      guard.beforeFinalize({
        runId: 'three-empty',
        lastAssistantMessage:
          'a.txt still needs checking, but b.txt and c.txt are empty.',
      })
    ).not.toBeNull();
  });

  it('replaces short empty-target names only at reference delimiters', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('short-empty', '', '/tmp/a'));
    guard.recordToolResult(successfulRead('short-empty', '', '/tmp/data'));

    expect(
      guard.beforeFinalize({
        runId: 'short-empty',
        lastAssistantMessage: '/tmp/a is empty; /tmp/data is empty.',
      })
    ).toBeNull();
  });

  it('treats a gerund result sentence as substantive', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('gerund-result'));

    expect(
      guard.beforeFinalize({
        runId: 'gerund-result',
        lastAssistantMessage: 'Reading the CSV confirms there are 31 rows.',
      })
    ).toBeNull();
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
    expect(guard.trackedRunCount()).toBe(2);
  });

  it('suppresses correction when a later read fails', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult(successfulRead('later-failure'));
    guard.recordToolResult({
      runId: 'later-failure',
      toolName: 'read',
      error: 'permission denied',
    });

    expect(
      guard.beforeFinalize({
        runId: 'later-failure',
        lastAssistantMessage: 'Opening the file now.',
      })
    ).toBeNull();
  });

  it('keeps a read failure sticky across an unrelated later success', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult({
      runId: 'failed-then-success',
      toolName: 'read',
      params: { path: '/tmp/a.txt' },
      error: 'permission denied',
    });
    guard.recordToolResult(
      successfulRead('failed-then-success', CSV, '/tmp/b.txt')
    );

    expect(
      guard.beforeFinalize({
        runId: 'failed-then-success',
        lastAssistantMessage: 'Reading the failed file again now.',
      })
    ).toBeNull();
  });

  it('does not let an unrelated failed read suppress successful-target correction', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult({
      runId: 'failed-auxiliary',
      toolName: 'read',
      params: { path: '/tmp/schema.txt' },
      error: 'permission denied',
    });
    guard.recordToolResult(
      successfulRead(
        'failed-auxiliary',
        'report one\nreport two\nreport three\nreport four',
        '/tmp/report.txt'
      )
    );

    expect(
      guard.beforeFinalize({
        runId: 'failed-auxiliary',
        lastAssistantMessage: 'Opening report.txt now.',
      })
    ).not.toBeNull();
  });

  it('clears a read failure after a successful retry of the same target', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult({
      runId: 'same-target-retry',
      toolName: 'read',
      params: { path: '/tmp/a.txt' },
      error: 'permission denied',
    });
    guard.recordToolResult(
      successfulRead('same-target-retry', CSV, '/tmp/a.txt')
    );

    expect(
      guard.beforeFinalize({
        runId: 'same-target-retry',
        lastAssistantMessage: 'Opening the file now.',
      })
    ).not.toBeNull();
  });

  it('does not treat an opaque non-text read result as an empty file', () => {
    const guard = createFileReadCompletionGuard();
    guard.recordToolResult({
      runId: 'non-text',
      toolName: 'read',
      result: {
        content: [{ type: 'resource', resource: { uri: 'file.bin' } }],
      },
    });

    expect(
      guard.beforeFinalize({
        runId: 'non-text',
        lastAssistantMessage: 'Opening the file now.',
      })
    ).toBeNull();
    expect(guard.trackedRunCount()).toBe(1);
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

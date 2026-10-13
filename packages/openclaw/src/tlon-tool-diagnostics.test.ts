import { describe, expect, it } from 'vitest';

import { summarizeTlonCommand } from './tlon-tool-command.js';
import {
  buildTlonToolDiagnosticRecord,
  resolveTlonToolOutcome,
} from './tlon-tool-diagnostics.js';

describe('tlon tool OpenTelemetry diagnostics', () => {
  it('emits a semantic error record without raw command, result, or error text', () => {
    const secretCode = 'sampel-ticlyt-migfun-falmel';
    const targetShip = '~sampel-palnet';
    const rawOutput = 'private profile payload';
    const summary = summarizeTlonCommand(
      `--code ${secretCode} contacts get ${targetShip}`
    );

    const record = buildTlonToolDiagnosticRecord(summary, {
      durationMs: 417,
      toolCallId: 'tool-call-17',
      runId: 'run-3',
      sessionId: 'session-5',
      result: {
        content: [{ type: 'text', text: rawOutput }],
        details: { error: true },
      },
      error: `CLI failed for ${targetShip}: ${rawOutput}`,
    });

    expect(record).toEqual({
      level: 'ERROR',
      message: 'tlon.tool.execution',
      loggerName: 'tlon.tool',
      attributes: {
        'tlon.tool.event': 'tlon.tool.execution',
        'tlon.tool.summary_key': 'contacts.get',
        'tlon.tool.subcommand': 'contacts',
        'tlon.tool.operation': 'get',
        'tlon.tool.intent': 'read',
        'tlon.tool.outcome': 'error',
        'tlon.tool.known_subcommand': true,
        'tlon.tool.blocked_send_operation': false,
        'tlon.tool.duration_ms': 417,
        'tlon.tool.failure_kind': 'tool_result_error',
        toolCallId: 'tool-call-17',
        runId: 'run-3',
        sessionId: 'session-5',
      },
    });

    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain(secretCode);
    expect(serialized).not.toContain(targetShip);
    expect(serialized).not.toContain(rawOutput);
  });

  it('preserves a safe blocked reason and semantic command fields', () => {
    const privateNest = 'diary/~bot/private-notebook';
    const summary = summarizeTlonCommand(
      `notes migrate-apply ${privateNest} --yes`
    );
    const record = buildTlonToolDiagnosticRecord(summary, {
      durationMs: 3,
      result: {
        content: [{ type: 'text', text: `Ask the owner about ${privateNest}` }],
        details: {
          status: 'blocked',
          blocked: true,
          reason: 'migration_operation',
        },
      },
      error: `Blocked migration of ${privateNest}`,
    });

    expect(record.level).toBe('WARN');
    expect(record.attributes).toMatchObject({
      'tlon.tool.summary_key': 'notes.migrate-apply',
      'tlon.tool.intent': 'write',
      'tlon.tool.outcome': 'blocked',
      'tlon.tool.failure_kind': 'migration_operation',
    });
    expect(JSON.stringify(record)).not.toContain(privateNest);
  });

  it('uses a generic block kind for unrecognized result reasons', () => {
    const record = buildTlonToolDiagnosticRecord(
      summarizeTlonCommand('groups delete ~host/group'),
      {
        result: {
          details: {
            status: 'blocked',
            reason: 'contains-private-target-name',
          },
        },
      }
    );

    expect(record.attributes['tlon.tool.failure_kind']).toBe('blocked');
    expect(JSON.stringify(record)).not.toContain(
      'contains-private-target-name'
    );
  });

  it('marks invalid commands without retaining their text', () => {
    const privateCommand = 'definitely-private-command';
    const record = buildTlonToolDiagnosticRecord(
      summarizeTlonCommand(`${privateCommand} --token hidden-value`),
      { result: { details: { error: true } } }
    );

    expect(record.attributes).toMatchObject({
      'tlon.tool.summary_key': 'unknown.invalid',
      'tlon.tool.subcommand': 'unknown',
      'tlon.tool.operation': 'invalid',
      'tlon.tool.outcome': 'error',
      'tlon.tool.failure_kind': 'invalid_command',
    });
    expect(JSON.stringify(record)).not.toContain(privateCommand);
    expect(JSON.stringify(record)).not.toContain('hidden-value');
  });

  it('projects bounded semantic detail for successful calls', () => {
    const record = buildTlonToolDiagnosticRecord(
      summarizeTlonCommand(
        'channels create ~host/group --kind notes --description private-copy'
      ),
      { durationMs: 28, result: { details: undefined } }
    );

    expect(record).toMatchObject({
      level: 'INFO',
      attributes: {
        'tlon.tool.summary_key': 'channels.create',
        'tlon.tool.outcome': 'ok',
        'tlon.tool.channel_kind': 'notes',
        'tlon.tool.has_title': false,
        'tlon.tool.has_description': true,
        'tlon.tool.duration_ms': 28,
      },
    });
    expect(JSON.stringify(record)).not.toContain('private-copy');
    expect(record.attributes).not.toHaveProperty('tlon.tool.failure_kind');
  });

  it('recognizes the host terminal-result contract', () => {
    expect(
      resolveTlonToolOutcome({ result: { details: { status: 'blocked' } } })
    ).toBe('blocked');
    expect(
      resolveTlonToolOutcome({ result: { details: { status: 'timed_out' } } })
    ).toBe('error');
    expect(
      resolveTlonToolOutcome({ result: { details: { success: false } } })
    ).toBe('error');
    expect(
      resolveTlonToolOutcome({ result: { details: { exitCode: 2 } } })
    ).toBe('error');
    expect(resolveTlonToolOutcome({ result: { details: { ok: true } } })).toBe(
      'ok'
    );
  });
});
